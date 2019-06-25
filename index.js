const mosca = require('mosca');
const redis = require('redis');
const config = require('./config.json');
const utils = require('./utils.js');
const SECURE_KEY = config.secure_key;
const SECURE_CERT = config.secure_cert;

const backend = {
  type: 'redis',
  redis: redis,
  host: config.redis.host,
  port: config.redis.port,
  db: config.redis.db,
  return_buffers: true, // to handle binary payloads
  ttl: {
    subscriptions: 2000
  }
};

const moscaSettings = {
  port: 1883,
  backend: backend,
  interfaces: [
    {
      type: "mqtts",
      port: 8443,
      credentials: {
        keyPath: SECURE_KEY,
        certPath: SECURE_CERT,
      }
    }
  ]
};


const server = new mosca.Server(moscaSettings);


/**
 * Check if a packet can go forward, from the broker to the subscribers
 * @param {Client} client 
 * @param {Object} packet 
 * @param {Function} callback 
 */
var authorizeForward = function(client, packet, callback) {
  let canGoForward = utils.canGoForward(client.user, packet);
  canGoForward.then((res) => {
    callback(null, res);
  })
}


/**
 * Check if a user can subscribe to a topic (calling the authorization service)
 * @param {Client} client 
 * @param {string} topic 
 * @param {Function} callback 
 */
var authorizeSubscribe = function(client, topic, callback) {
  let canSub = utils.canSubscribe(client.user, topic);
  canSub.then((res) => {
    callback(null, res);
  });
}


/**
 * Check if a user can publish on the selected topic
 * @param {Client} client 
 * @param {string} topic 
 * @param {Object} payload 
 * @param {Function} callback 
 */
var authorizePublish = function(client, topic, payload, callback) {
  let canPub = utils.canPublish(client.user, topic);
  callback(null, canPub);
}


/**
 * Check if the given username and password are valid
 * and set client.user to the username
 *
 * @param {Client} client
 * @param {string} username
 * @param {string} password
 * @param {Function} callback
 */
function authenticate(client, username, password, callback) {
  const authenticate = utils.canAuthenticate(username, password.toString());
  authenticate.then((res) => {
    if (res) {
      client.user = username;
    }
    callback(null, res);
  })
}


function setup() {
  server.authenticate = authenticate;
  server.authorizePublish = authorizePublish;
  server.authorizeSubscribe = authorizeSubscribe;
  server.authorizeForward = authorizeForward;
}

server.on('ready', setup);
