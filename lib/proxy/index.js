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

  // Done.
  return this;
}
