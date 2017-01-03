'use strict';
const fs        = require('fs');
const pac       = require('pac-resolver');
const cache     = require('lru-cache')(2000);
const logger    = require('./logger')();
const singleton = require('./utils').singleton;
const urlparse  = require('./utils').urlparse;

class Forwarder {
  constructor(options) {
    this.pacFile       = options['--pac-file'];
    this.upstreamProxy = options['--upstream'] || null;

    // Load PAC file, or default to a no-op.
    this.FindProxyForURL = (url, host, cb) => cb();
    if (this.pacFile) {
      try {
        this.FindProxyForURL = pac(fs.readFileSync(this.pacFile, 'utf-8'));
      } catch(e) {
        console.error('Error loading PAC');
        throw e;
      }
      logger.debug('loaded PAC');
    }
  }

  lookup(url) {
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

module.exports = singleton(options => new Forwarder(options));
