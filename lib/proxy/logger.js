'use strict';
const bunyan = require('bunyan');

// Initialize logger.
let logger = module.exports = bunyan.createLogger({
  name        : 'filtering-proxy',
  level       : 'info',
  stream      : process.stdout,
  serializers : bunyan.stdSerializers
});

logger.init = function(opts) {
  let level = opts['--log-level'] || null;
  if (level) {
    logger.level(level);
  }
  return logger;
};