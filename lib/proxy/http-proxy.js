'use strict';
const httpProxy = require('http-proxy');
const url       = require('url');

module.exports = proxy => {
  // Create proxy instance.
  let server = httpProxy.createProxyServer({ xfwd : false });
  server.forward = (req, res, forwardProxy) => {
    server.web(req, res, {
      target      : forwardProxy,
      toProxy     : true,
      prependPath : false,
    });
  };
  server.target = (req, res) => {
    let parsed = url.parse(req.url);
    server.web(req, res, {
      target : [ parsed.protocol, '//', parsed.hostname, ':', parsed.port || 80 ].join(''),
    });
  };
  return server;
}
