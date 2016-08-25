'use strict';
const express     = require('express');
const compression = require('compression');
const singleton   = require('./utils').singleton;
const logger      = require('./logger')();

class Server {
  constructor(options) {
    this.options = options;

    // Set up Express app and HTTP server.
    this.app    = express();
    this.server = this.app.listen(this.options['--port'], this.options['--host'], () => {
      let address = this.server.address();
      logger.debug('proxy running on http://%s:%s', address.address, address.port);
    });

    this.app.disable('x-powered-by');
    this.app.disable('etag');
    this.app.use(compression());

    return this;
  }

  on(event, handler) {
    return this.server.on(event, handler);
  }

  use() {
    return this.app.use.apply(this.app, arguments);
  }
}

module.exports = singleton(options => new Server(options));
