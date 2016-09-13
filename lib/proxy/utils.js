'use strict';
const memoize = require('memoizerific');
const parse   = require('url').parse;

module.exports = {
  singleton : fn => {
    let instance = null;
    return function() {
      if (! instance) {
        instance = fn.apply(this, arguments);
      }
      return instance;
    }
  },
  urlparse : memoize(2000)(parse)
};
