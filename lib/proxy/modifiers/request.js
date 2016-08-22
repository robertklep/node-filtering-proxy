'use strict';
const vm     = require('vm');
const logger = require('../logger')();

module.exports = (req, res, rules) => {
  rules.forEach(rule => modifyRequest(req, res, rule));
};

function modifyRequest(req, res, rule) {
  let sandbox = {
    console  : console,
    request  : req,
    response : res,
    gb       : {
      request  : req,
      response : res,
      log      : console.log.bind(console)
    },
    set t(body) { res.send(body) }
  };
  try {
    vm.runInNewContext(rule.handler, sandbox, rule.id);
  } catch(err) {
    logger.error({ err : err, rule : rule }, 'request execution error');
  }
}
