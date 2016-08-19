'use strict';
const vm     = require('vm');
const logger = require('./logger');

module.exports = (req, res, body, rules) => {
  return rules.reduce((body, rule) => modifyResponse(req, res, body, rule), body);
};

function modifyResponse(req, res, body, rule) {
  // Perform modification.
  [ 'js', 'css', 'transform' ].forEach(function(type) {
    (rule[type] || []).forEach(function(mod) {
      if (type === 'js' || type === 'css') {
        // Content to place inside the body.
        let element = type === 'js' ? 'script' : 'style';
        let content = `
<!-- node-rewriting-proxy:${ type } -->
<${ element }>
${ mod.modification }
</${ element }>
`;

        // Determine where to insert the content.
        let modification = {
          'body-start' : [ /<\s*body.*?>/i,      '$&' + content ],
          'body-end'   : [ /<\s*\/\s*body.*?>/i, content + '$&' ],
          'head-start' : [ /<\s*head.*?>/i,      '$&' + content ],
          'head-end'   : [ /<\s*\/\s*head.*?>/i, content + '$&' ],
          'start'      : [ /^/,                  content        ],
          'end'        : [ /$/,                  content        ],
        }[mod.placement];

        // Inject.
        if (modification) {
          body = body.replace(modification[0], modification[1]);
        }
      } else if (type === 'transform') {
        body = transformResponse(req, res, body, mod);
      }
    });
  });
  return body;
}

function transformResponse(req, res, body, rule) {
  let code    = rule.modification;
  let sandbox = {
    console  : console,
    request  : req,
    response : res,
    html     : body,
    body     : body,
    headers  : res.headers,
    replace  : (from, to) => {
      body = body.replace(from, to);
      return body;
    },
    gb : {
      request         : req,
      response        : res,
      addStyleElement : css => {
        body = body.replace(/<\s*\/\s*head.*?>/i, `<style>${ css }</style>$&`);
        return body;
      },
      insertAtHeadStart : html => {
        body = body.replace(/<head.*?>/i, '$&' + html);
        return body;
      }
    },
  };
  try {
    vm.runInNewContext(code, sandbox, rule.id);
  } catch(err) {
    logger.error({ err : err, rule : rule }, 'transform execution error');
  }
  return body;
}
