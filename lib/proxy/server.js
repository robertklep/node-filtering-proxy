'use strict';
const assert  = require('assert');
const express = require('express');
const logger  = require('./logger');

class Server {
  initialize(options) {
    if (this.instantiated || options['--test']) return this;
    this.instantiated = true;
    this.options      = options;

    // Set up Express app and HTTP server.
    this.app    = express();
    this.server = this.app.listen(this.options['--port'], this.options['--host'], () => {
      let address = this.server.address();
      logger.debug('proxy running on http://%s:%s', address.address, address.port);
    });

    this.app.disable('x-powered-by');
    this.app.disable('etag');

    return this;
  }

  on(event, handler) {
    assert(this.instantiated, 'Call .initialize() first');
    return this.server.on(event, handler);
  }

  use() {
    assert(this.instantiated, 'Call .initialize() first');
    return this.app.use.apply(this.app, arguments);
  }
}

module.exports = new Server();
