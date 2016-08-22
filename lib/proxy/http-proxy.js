'use strict';
const httpProxy      = require('http-proxy');
const zlib           = require('zlib');
const unstream       = require('unstream');
const hijackResponse = require('hijackresponse');
const charset        = require('charset');
const iconv          = require('iconv-lite');
const logger         = require('./logger');
const urlparse       = require('./utils').urlparse;
const forwarder      = require('./forwarder');
const rulesEngine    = require('./rules-engine');
const server         = require('./server');
const modifiers      = require('./modifiers');

const setFilterHeader = (res, msg) => res.set('x-filter', [ res.get('x-filter'), msg ].join(', '));

class HttpProxy {
  initialize(options) {
    if (this.instantiated || options['--test']) return this;
    this.instantiated = true;

    // Proxy WS requests.
    server.on('upgrade', this.ws.bind(this));

    // Handle HTTP requests.
    server.use(this.http());

    // Create proxy instance.
    this.proxy = httpProxy.createProxyServer({ xfwd : false });

    // Done.
    return this;
  }

  // Forward request to another proxy.
  forward(req, res, forwardProxy) {
    this.proxy.web(req, res, {
      target      : forwardProxy,
      toProxy     : true,
      prependPath : false,
    });
  }

  // Proxy the request ourselves.
  target(req, res) {
    let parsed = urlparse(req.url);
    this.proxy.web(req, res, {
      target : [ parsed.protocol, '//', parsed.hostname, ':', parsed.port || 80 ].join(''),
    });
  }

  http() {
    let forward = this.forward.bind(this);
    let target  = this.target.bind(this);

    // Stack of middleware to handle HTTP requests (reject, modify, ...).
    return [
      // Find matching rules for this request.
      function findRulesForRequest(req, res, next) {
        req.rules = rulesEngine.match(req.url);
        next();
      },
      // Reject request outright?
      function rejectionMiddleware(req, res, next) {
        let reject = (req.rules.actions.whitelist || []).length === 0 && (req.rules.actions.block || []).length !== 0;
        if (reject) {
          logger.trace({ url : req.url }, 'block');
          setFilterHeader(res, 'reject');
          return res.sendStatus(404);
        }
        next();
      },
      // Send back a pre-determined response.
      function replaceMiddleware(req, res, next) {
        if (! req.rules.actions.replace) return next();
        logger.trace({ url : req.url, num : req.rules.actions.replace.length }, 'replace');

        // Replace the response.
        setFilterHeader(res, 'replace');
        modifiers.replace(req, res, req.rules.actions.replace);

        // Pass long, unless the response has finished (which usually will be the case).
        if (! res.finished) {
          next();
        }
      },
      // Modify request?
      function modifyRequestMiddleware(req, res, next) {
        if (! req.rules.actions.request) return next();
        logger.trace({ url : req.url, num : req.rules.actions.request.length }, 'modify request');

        // Modify the request.
        setFilterHeader(res, 'request');
        modifiers.request(req, res, req.rules.actions.request);

        // Pass long, unless the response has finished.
        if (! res.finished) {
          next();
        }
      },
      // Modify response?
      function modifyResponseMiddleware(req, res, next) {
        if (! req.rules.actions.modify) return next();
        logger.trace({ url : req.url, num : req.rules.actions.modify.length }, 'modify response');
        hijackResponse(res, function (err, res) {
          if (err) {
            res.unhijack(); // Make the original res object work again
            return next(err);
          }

          // Only hijack text/* responses.
          if (! (res.get('content-type') || '').startsWith('text/')) {
            return res.unhijack();
          }

          // Build a pipeline.
          setFilterHeader(res, 'modify');
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
            body = modifiers.response(req, res, body, req.rules.actions.modify);

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
        forwarder.lookup(req.url).then(forwardProxy => {
          if (forwardProxy) {
            setFilterHeader(res, 'forward');
            logger.trace({ url : req.url, forwardProxy : forwardProxy, scheme : 'http' }, 'forward');
            forward(req, res, forwardProxy);
          } else {
            setFilterHeader(res, 'passed');
            logger.trace({ url : req.url, scheme : 'http' }, 'pass');
            target(req, res);
          }
        }).catch(err => {
          logger.error({ err : err }, 'forwarder error');
        });
      },
      // Generic error handler
      function errorHandler(err, req, res, next) {
        logger.error({ err : err }, 'Express error');
        res.sendStatus(500);
      }
    ]
  }

  ws(req, socket, head) {
    return this.proxy.ws(req, socket, head);
  }
}

module.exports = new HttpProxy();
