let axios = require('axios');
let redis = require('redis');
let config = require('./config.json');
let base_api_url = process.env.AS_HOST || "http://localhost:8000";

const AUTHENTICATION_URL = 'mqtt/login/',
      AUTHORIZATION_URL = 'mqtt/auth/',
      REDIS_TIMEOUT = '5',
      DEBUG = process.env.BROKER_DEBUG || true,
      API_URL = base_api_url + '/api/v1';

const HTTP = axios.create({
  baseURL:  API_URL,
  // `timeout` specifies the number of milliseconds before the request times out.
  // If the request takes longer than `timeout`, the request will be aborted.
  timeout: 10000,
  headers: {
    'Api-Token': config.api.token,
    'Api-Secret-Key': config.api.secret_key
  }
});

let redis_client = redis.createClient({
  port: config.redis.port,
  host: config.redis.host
});

if (DEBUG) {
  redis_client.flushdb; // clean cache
}

/**
 * Call the authorization service to check if the client
 * can subscribe to the given topic.
 * Save the response in redis for "timeout" seconds.
 * Return true or false accordingly.
 *
 * @param {string} subscriber Subscriber's username
 * @param {string} topic Topic it wants to subscribe
 */
async function canSubscribe(subscriber, topic) {
  return await HTTP.post(AUTHORIZATION_URL, {
    username: subscriber,
    topic: topic
  })
  .then(function (response) {
    redis_client.setex(`${subscriber}:subscribe:${topic}`, REDIS_TIMEOUT, response.status < 300);
    return response.status < 300;
  })
  .catch(function (error) {
    redis_client.setex(`${subscriber}:subscribe:${topic}`, REDIS_TIMEOUT, false);
    return false;
  })
}

/**
 * Call the authorization service to check if the user with the given
 * credentials exists.
 * Return true or false accordingly.
 *
 * @param {string} username
 * @param {string} password
 */
async function canAuthenticate(username, password) {
  return await HTTP.post(AUTHENTICATION_URL, {
    username: username,
    password: password
  })
  .then(function (response) {
    return response.status === 200;
  })
  .catch(function (error) {
    //console.error("ERROR:", authentication_url);
    //console.error(error);
    return false;
  })
}

// In this case the client authorized as alice can publish to /users/alice taking
// the username from the topic and verifing it is the same of the authorized user
function canPublish(username, topic) {
  const authorized = username === topic.split('/')[1];
  if (authorized) {
    return true;
  } else {
    return false;
  }
}

/**
 * @param {*} client
 * @param {*} packet { topic: '/hello/alice',
                       payload: <Buffer 43 69 61 6f 20 64 61 20 61 6c 69 63 65>,
                       qos: 0,
                       messageId: 1
                      }
 * @param {*} callback
 */
async function canGoForward (username, packet) {
  return redis_client.get(`${username}:subscribe:${packet.topic}`, (err, result) => { 
    if (result === 'false') {
      return false;
    } else if (result === 'true') {
      return true;
    } else {
      let response = canSubscribe(username, packet.topic);
      return response;
    }
  })
}

module.exports = {
  canAuthenticate: canAuthenticate,
  canSubscribe: canSubscribe,
  canGoForward: canGoForward,
  canPublish: canPublish
}
