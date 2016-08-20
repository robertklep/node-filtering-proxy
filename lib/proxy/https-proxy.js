'use strict';
const net         = require('net');
const assert      = require('assert');
const logger      = require('./logger');
const urlparse    = require('./utils').urlparse;
const forwarder   = require('./forwarder');
const rulesEngine = require('./rules-engine');
const server      = require('./server');

class HttpsProxy {
  initialize(options) {
    if (this.instantiated) return this;
    this.instantiated = true;
    server.on('connect', this.handle.bind(this));
  }

  handle(req, socket) {
    logger.trace({ url : req.url }, 'HTTPS request');
    let endpoint = urlparse('https://' + req.url);

    // Check for matching rules and act accordingly.
    let rules  = rulesEngine.match(endpoint);
    let reject = (rules.actions.whitelist || []).length === 0 && (rules.actions.block || []).length !== 0;
    if (reject) {
      logger.trace({ url : req.url }, 'block');
      socket.write('HTTP/1.1 404 Not Found\r\nProxy-Agent: node-rewriting-proxy\r\n\r\n');
      return socket.end();
    }

    socket.on('error', err => {
      logger.debug({ err : err }, 'socket error');
    });

    forwarder.lookup(endpoint.protocol + '//' + endpoint.hostname).then(forwardProxy => {
      if (forwardProxy) {
        logger.trace({ url : req.url, forwardProxy : forwardProxy, scheme : 'https' }, 'forward');
        endpoint = urlparse(forwardProxy);
      } else {
        logger.trace({ url : req.url, scheme : 'https' }, 'proxy');
      }

      net.connect(endpoint.port || 443, endpoint.hostname, function() {
        if (forwardProxy) {
          this.write(`CONNECT ${ req.url } HTTP/1.1\r\n\r\n`);
        } else {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        }
        this.pipe(socket);
        socket.pipe(this);
      }).on('error', err => {
        logger.debug({ err : err }, 'server socket error');
      });

    });
  }
}

module.exports = new HttpsProxy();
