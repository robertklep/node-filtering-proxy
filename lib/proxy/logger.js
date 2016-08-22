'use strict';
const bunyan    = require('bunyan');
const singleton = require('./utils').singleton;

module.exports = singleton(options => {
  let level = options['--log-level'] || 'info';
  return bunyan.createLogger({
    name        : 'filtering-proxy',
    level       : level,
    stream      : process.stdout,
    serializers : bunyan.stdSerializers
  });
});
