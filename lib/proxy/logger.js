'use strict';
const bunyan = require('bunyan');

// Initialize logger.
let logger = null;
module.exports = proxy => {
  let level = proxy.opts ? proxy.opts['--log-level'] : null;
  if (! logger) {
    logger = bunyan.createLogger({
      name        : 'filtering-proxy',
      level       : level || 'info',
      stream      : process.stdout,
      serializers : bunyan.stdSerializers
    });
  }
  if (level) {
    logger.level(level);
  }
  return logger;
}
