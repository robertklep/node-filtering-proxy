'use strict';
const fs    = require('fs');
const pac   = require('pac-resolver');
const cache = require('lru-cache')(2000);

module.exports = proxy => {
  let pacFile       = proxy.opts['--pac-file'];
  let upstreamProxy = proxy.opts['--upstream'] || null;

  // Load PAC file, or default to a no-op.
  let FindProxyForURL = (url, host, cb) => cb();
  if (pacFile) {
    FindProxyForURL = pac(fs.readFileSync(pacFile, 'utf-8'));
    proxy.logger.debug('loaded PAC');
  }

  // Return the forward proxy lookup function.
  return url => {
    let parsed = proxy.utils.urlparse(url);
    let key    = [ parsed.protocol, '//', parsed.host, parsed.pathname ];

    // Check cache
    let cached = cache.get(key);
    if (cached) return Promise.resolve(cached);

    return new Promise(resolve => {
      FindProxyForURL(url, parsed.hostname, (err, proxyString) => {
        let forwardProxy = upstreamProxy;

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
};
