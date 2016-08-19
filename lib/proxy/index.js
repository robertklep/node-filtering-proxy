'use strict';
const url       = require('url');
const express   = require('express');
const transform = require('express-transform').default;

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
  let logger = this.logger = require('./logger');
  logger.init(this.opts);

  // Load rules.
  let rules = this.rules = require('./rules')(this);

  // Set up Express app and HTTP server.
  this.app    = express();
  this.server = this.app.listen(opts['--port'], opts['--host'], () => {
    let address = this.server.address();
    logger.debug('proxy running on http://%s:%s', address.address, address.port);
  });

  this.app.disable('x-powered-by');
  this.app.disable('etag');
//  this.app.use(transform());

  // Load other parts.
  let forwarder  = this.forwarder  = require('./forwarder')  (this);
  let httpProxy  = this.httpProxy  = require('./http-proxy') (this);
  let httpsProxy = this.httpsProxy = require('./https-proxy')(this);

  // Handle CONNECT requests.
  this.server.on('connect', httpsProxy);

  // Proxy WS requests.
  this.server.on('upgrade', httpProxy.ws);

  // Handle HTTP requests.
  this.app.use(httpProxy.http);

  // Done.
  return this;
}
