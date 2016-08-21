'use strict';
const vm     = require('vm');
const logger = require('../logger');

module.exports = (req, res, rules) => {
  // Only use the first (more than 1 doesn't make sense anyway.
  let rule = rules[0];
  if (typeof rule.content !== 'string') return;
  res.send(rule.content);
}
