'use strict';

module.exports = opts => {
  return { run : () => new createProxy(opts) }
};

function createProxy(options) {
  process.on('uncaughtException', err => {
    console.log('UNCAUGHT', err.stack);
  });

  // Initialize all sub parts.
  [ 'logger', 'server', 'rules-engine', 'forwarder', 'http-proxy', 'https-proxy' ].forEach(part => {
    this[part] = require('./' + part).initialize(options);
  });

  // Test URL?
  if (options['--test']) {
    console.log( this['rules-engine'].match(options['--test']) );
    process.exit(0);
  }

  // Done.
  return this;
}
