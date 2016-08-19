'use strict';
const httpProxy      = require('http-proxy');
const zlib           = require('zlib');
const unstream       = require('unstream');
const hijackResponse = require('hijackresponse');
const charset        = require('charset');
const iconv          = require('iconv-lite');
const logger         = require('./logger');
const modifyResponse = require('./modify-response');
//const modifyRequest = require('./modify-request');

module.exports = proxy => {
  let forwarder = proxy.forwarder;
  let rules     = proxy.rules;
  let urlparse  = proxy.utils.urlparse;

  // Create proxy instance.
  let server = httpProxy.createProxyServer({ xfwd : false });

  // Forward request to another proxy.
  function forward(req, res, forwardProxy) {
    server.web(req, res, {
      target      : forwardProxy,
      toProxy     : true,
      prependPath : false,
    });
  };

  // Proxy the request ourselves.
  function target(req, res) {
    let parsed = urlparse(req.url);
    server.web(req, res, {
      target : [ parsed.protocol, '//', parsed.hostname, ':', parsed.port || 80 ].join(''),
    });
  };

  // Handle requests.
  return {
    // Stack of middleware to handle HTTP requests (reject, modify, ...).
    http : [
      // Find matching rules for this request.
      function findRulesForRequest(req, res, next) {
        req.rules = rules.match(req.url);
        next();
      },
      // Reject request outright?
      function rejectionMiddleware(req, res, next) {
        let reject = (req.rules.actions.whitelist || []).length === 0 && (req.rules.actions.block || []).length !== 0;
        if (reject) {
          logger.trace({ url : req.url }, 'block');
          return res.sendStatus(404);
        }
        next();
      },
      // Modify request?
      function modifyRequestMiddleware(req, res, next) {
        if (! req.rules.actions.request) return next();
        console.error('should modify request!', req.url);
        next();
      },
      // Modify response?
      function modifyResponseMiddleware(req, res, next) {
        if (! req.rules.actions.modify) return next();
        hijackResponse(res, function (err, res) {
          if (err) {
            res.unhijack(); // Make the original res object work again
            return next(err);
          }

          // Only hijack text/* responses.
          if (! res.get('content-type').startsWith('text/')) {
            return res.unhijack();
          }

          // Build a pipeline.
          let stream = res;

          // Uncompress stream if necessary (TODO: deflate)
          if (res.get('content-encoding') === 'gzip') {
            res.removeHeader('content-encoding');
            res.removeHeader('content-length');
            stream = stream.pipe(zlib.createGunzip());
          }

          // Pipe through the transformer stream.
          stream = stream.pipe(unstream((body, callback) => {
            // Determine character encoding.
            let encoding = charset(res.get('content-type'));
            let recode   = false;

            // Convert to proper JS string.
            if (encoding && encoding !== 'utf-8' && encoding !== 'utf8' && iconv.encodingExists(encoding)) {
              body   = iconv.decode(body, encoding);
              recode = true;
            } else {
              body = body.toString();
            }

            // Modify the body by passing it through the modification rules.
            body = modifyResponse(req, res, body, req.rules.actions.modify);

            // Recode to original character set if necessary.
            if (recode) {
              body = iconv.encode(body, encoding);
            }

            // Done.
            return callback(null, body);
          }));

          // Stream back as response, unless the modification ended the response.
          if (! res.finished) {
            stream.pipe(res);
          }
        });
        next();
      },
      // If we got have, either forward or proxy the request.
      function handleRequest(req, res, next) {
        // Check for forwarding proxy and handle request.
        forwarder(req.url).then(forwardProxy => {
          if (forwardProxy) {
            logger.trace({ url : req.url, forwardProxy : forwardProxy, scheme : 'http' }, 'forward');
            forward(req, res, forwardProxy);
          } else {
            logger.trace({ url : req.url, scheme : 'http' }, 'proxy');
            target(req, res);
          }
        }).catch(err => {
          logger.error({ err : err }, 'forwarder error');
        });
      },
    ],
    ws(req, socket, head) {
      return server.ws(req, socket, head);
    }
  }
}
