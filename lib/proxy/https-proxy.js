'use strict';
const net = require('net');

module.exports = proxy => {
  let logger    = proxy.logger;
  let forwarder = proxy.forwarder;
  let urlparse  = proxy.utils.urlparse;

  return (req, socket) => {
    logger.trace({ url : req.url }, 'HTTPS request');
    let endpoint = urlparse('https://' + req.url);

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
