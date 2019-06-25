FROM node:8

RUN mkdir /code
WORKDIR /code
COPY . /code/
RUN npm install -g node-gyp
RUN npm install
RUN apt-get install libtool pkg-config autoconf automake git

EXPOSE 8080
# CMD [ "node", "index.js" ]


