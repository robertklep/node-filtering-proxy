'use strict';
const memoize = require('lru-memoize');
const parse   = require('url').parse;

module.exports = {
  urlparse : memoize(2000)(url => parse(url))
};
