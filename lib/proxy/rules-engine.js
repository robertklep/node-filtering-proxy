'use strict';
const _        = require('lodash');
const assert   = require('assert');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const chokidar = require('chokidar');
const memoize  = require('memoizerific');
const isMatch  = require('micromatch').isMatch;
const toml     = require('toml-j0.4');
const logger   = require('./logger');
const urlparse = require('./utils').urlparse;

const match = memoize(2000)((str, pattern) => isMatch(str.replace(/\//g, '__'), pattern.replace(/\//g, '__')));

class RuleEngine {
  initialize(options) {
    if (this.instantiated) return this;
    this.instantiated = true;
    this.options      = options;

    // Normalize path to rules file.
    this.filePath = path.normalize(this.options['--rules-file'].replace(/^~/, os.homedir()));

    // Memoize matcher function.
    this.match = memoize(2000)(this.match.bind(this));

    // Load rules file.
    this.watcher = null;
    this.loadRulesFile();

    // Done
    return this;
  }

  loadRulesFile() {
    // Try to load TOML rules file.
    let rules;
    try {
      rules = toml.parse(fs.readFileSync(this.filePath, 'utf-8')).rules;
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
        if (value && value[0] === '/') {
          try {
            let matcher  = new RegExp(value.replace(/^\/|\/$/, ''));
            matcher.test = memoize(2000)(matcher.test.bind(matcher));
            rule[type]   = matcher;
          } catch(e) {}
        }
      });
    });

    // Update instance.
    this.rules = rules;

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

  match(url) {
    assert(this.instantiated, 'Call .initialize() first');

    let parsed  = urlparse(url);
    //let simple  = parsed.hostname + (parsed.path === '/' ? '' : parsed.path);
    let simple  = parsed.hostname + parsed.path;
    let matches = this.rules.filter(rule => {
      if (rule.pattern) {
        return match(simple, rule.pattern);
      }
      let matches = [ 'hostname', 'path' ].reduce((acc, type) => {
        let value = rule[type];
        if (value instanceof RegExp) {
          acc[type] = value.test(parsed[type]);
        } else if (typeof value === 'string') {
          acc[type] = match(parsed[type], value);
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
