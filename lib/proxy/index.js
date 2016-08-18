'use strict';
const url     = require('url');
const express = require('express');
const request = require('request');

module.exports = opts => {
  return { run : () => new createProxy(opts) }
};

function createProxy(opts) {
  this.opts = opts;

  process.on('uncaughtException', err => {
    console.log('UNCAUGHT', err.stack);
  });

  // Attach utilities.
  let utils = this.utils = require('./utils');

  // Create logger early.
  let logger = this.logger = require('./logger')(this);

  // Set up Express app and HTTP server.
  this.app    = express();
  this.server = this.app.listen(opts['--port'], opts['--host'], () => {
    let address = this.server.address();
    logger.debug('proxy running on http://%s:%s', address.address, address.port);
  });

  this.app.disable('x-powered-by');
  this.app.disable('etag');

  // Load other parts.
  let forwarder  = this.forwarder  = require('./forwarder')  (this);
  let httpProxy  = this.httpProxy  = require('./http-proxy') (this);
  let httpsProxy = this.httpsProxy = require('./https-proxy')(this);

  // Proxy WS requests.
  this.server.on('upgrade', (req, socket, head) => httpProxy.ws(req, socket, head));

  // Handle CONNECT requests.
  this.server.on('connect', (req, socket) => httpsProxy(req, socket));

  // Handle HTTP requests.
  this.app.use((req, res, next) => {
    // MOVE THIS TO http-proxy.js
    forwarder(req.url).then(forwardProxy => {
      if (forwardProxy) {
        logger.trace({ url : req.url, forwardProxy : forwardProxy, scheme : 'http' }, 'forward');
        httpProxy.forward(req, res, forwardProxy);
      } else {
        logger.trace({ url : req.url, scheme : 'http' }, 'proxy');
        httpProxy.target(req, res);
      }
    });
  });

  return this;
}
