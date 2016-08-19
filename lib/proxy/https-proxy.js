'use strict';
const net = require('net');

module.exports = proxy => {
  let logger    = proxy.logger;
  let forwarder = proxy.forwarder;
  let urlparse  = proxy.utils.urlparse;
  let rules     = proxy.rules;

  return (req, socket) => {
    logger.trace({ url : req.url }, 'HTTPS request');
    let endpoint      = urlparse('https://' + req.url);

    // Check for matching rules and act accordingly.
    let matchingRules = rules.match(endpoint);
    let reject        = (matchingRules.actions.whitelist || []).length === 0 && (matchingRules.actions.block || []).length !== 0;
    if (reject) {
      logger.trace({ url : req.url }, 'block');
      socket.write('HTTP/1.1 404 Not Found\r\nProxy-Agent: node-rewriting-proxy\r\n\r\n');
      return socket.end();
    }

    socket.on('error', err => {
      logger.debug({ err : err }, 'socket error');
    });

    forwarder(endpoint.protocol + '//' + endpoint.hostname).then(forwardProxy => {
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
  };
};
