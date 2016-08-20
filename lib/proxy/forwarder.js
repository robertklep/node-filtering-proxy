'use strict';
const fs       = require('fs');
const pac      = require('pac-resolver');
const cache    = require('lru-cache')(2000);
const assert   = require('assert');
const logger   = require('./logger');
const urlparse = require('./utils').urlparse;

class Forwarder {
  initialize(options) {
    if (this.instantiated) return this;
    this.instantiated  = true;
    this.pacFile       = options['--pac-file'];
    this.upstreamProxy = options['--upstream'] || null;

    // Load PAC file, or default to a no-op.
    this.FindProxyForURL = (url, host, cb) => cb();
    if (this.pacFile) {
      this.FindProxyForURL = pac(fs.readFileSync(this.pacFile, 'utf-8'));
      logger.debug('loaded PAC');
    }
  }

  lookup(url) {
    assert(this.instantiated, 'Call .initialize() first');
    let parsed = urlparse(url);
    let key    = [ parsed.protocol, '//', parsed.host, parsed.pathname ];

    // Check cache
    let cached = cache.get(key);
    if (cached) return Promise.resolve(cached);

    return new Promise(resolve => {
      this.FindProxyForURL(url, parsed.hostname, (err, proxyString) => {
        let forwardProxy = this.upstreamProxy;

        // Pick one of the proxies that can handle this URL.
        if (! err && proxyString && proxyString.length) {
          let proxies  = (proxyString.match(/PROXY\s+[^;]+/g) || []).map(m => m.split(' ')[1]);
          forwardProxy = proxies.length ? `http://${ proxies[ Math.random() * proxies.length | 0 ] }` : null;
        }

        // Update LRU cache.
        cache.set(key, forwardProxy);

        // Resolve the promise.
        resolve(forwardProxy);
      });
    })
  }
}

module.exports = new Forwarder();
