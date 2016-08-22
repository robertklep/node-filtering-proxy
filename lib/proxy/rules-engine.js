'use strict';
const _        = require('lodash');
const assert   = require('assert');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const chokidar = require('chokidar');
const memoize  = require('memoizerific');
const isMatch  = require('micromatch').isMatch;
const logger   = require('./logger');
const urlparse = require('./utils').urlparse;

class RuleEngine {
  initialize(options) {
    if (this.instantiated) return this;
    this.instantiated = true;
    this.options      = options;

    // Normalize path to rules file.
    this.filePath = path.normalize(this.options['--rules-file'].replace(/^~/, os.homedir()));

    // Load rules file.
    this.watcher = null;
    this.loadRulesFile();

    // Done
    return this;
  }

  loadRulesFile() {
    // Try to load rules file.
    let rules;
    let filePath = require.resolve(this.filePath);
    try {
      // Remove cached version of module.
      delete require.cache[filePath];

      // Just a regular module.
      rules = require(filePath);
      logger.debug({ count : rules.length }, 'loaded rules');
    } catch(err) {
      logger.error({ err : err }, 'error loading rules file');
      if (! this.watcher) process.exit(1);
      return;
    }

    // Sort rules on priority.
    rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Convert `hostname` and `path` to regular expressions if necessary.
    rules.forEach(rule => {
      [ 'hostname', 'path' ].forEach(type => {
        let value = rule[type];
        // Memoize regular expression tests.
        if (value instanceof RegExp) {
          value.test = memoize(2000)(value.test.bind(value));
        }
      });
    });

    // Update instance.
    this.rules = rules;

    // Memoize matcher functions.
    this.match        = memoize(2000)(this._match.bind(this));
    this.patternMatch = memoize(2000)(this._patternMatch.bind(this));

    // Start watcher?
    if (! this.watcher) {
      this.watch();
    }
  }

  watch() {
    this.watcher = chokidar.watch(this.filePath, { ignoreInitial : true }).on('all', () => {
      logger.debug('reloading rules file');
      this.loadRulesFile();
    });
  }

  _patternMatch(str, pattern) {
    return isMatch(str.replace(/\//g, '__'), pattern.replace(/\//g, '__'));
  }

  _match(url) {
    assert(this.instantiated, 'Call .initialize() first');

    let parsed  = urlparse(url);
    //let simple  = parsed.hostname + (parsed.path === '/' ? '' : parsed.path);
    let simple  = parsed.hostname + parsed.path;
    let matches = this.rules.filter(rule => {
      if (rule.pattern) {
        return this.patternMatch(simple, rule.pattern);
      }
      let matches = [ 'hostname', 'path' ].reduce((acc, type) => {
        let value = rule[type];
        if (value instanceof RegExp) {
          acc[type] = value.test(parsed[type]);
        } else if (typeof value === 'string') {
          acc[type] = this.patternMatch(parsed[type], value);
        } else {
          acc[type] = true;
        }
        return acc;
      }, {});
      return matches.path && matches.hostname;
    });

    // Group matches by action.
    matches.actions = _.groupBy(matches, 'action');

    // Done.
    return matches;
  }
}

module.exports = new RuleEngine();
