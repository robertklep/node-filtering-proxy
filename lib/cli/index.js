'use strict';
const fs     = require('fs');
const path   = require('path');
const docopt = require('docopt').docopt;
const opts   = docopt(fs.readFileSync(__dirname + '/docopt.txt', 'utf8'), {
  version : require('../../package').version
});

module.exports = require('../proxy')(opts);
