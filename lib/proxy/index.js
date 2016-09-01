'use strict';

module.exports = opts => {
  return { run : () => new createProxy(opts) }
};

function createProxy(options) {
  process.on('uncaughtException', err => {
    console.log('UNCAUGHT', err.stack);
  });

  // Test?
  if (options['--test']) {
    require('./logger')(options);
    let rulesEngine = require('./rules-engine')(options);
    let matches = rulesEngine.match(options['--test']);
    delete matches.actions;
    console.log( require('util').inspect(matches, { depth : Infinity }) );
    process.exit(0);
  }

  // Initialize all sub parts.
  [ 'logger', 'server', 'rules-engine', 'forwarder', 'http-proxy', 'https-proxy' ].forEach(part => {
    this[part] = require('./' + part)(options);
  });

  // Done.
  return this;
}
