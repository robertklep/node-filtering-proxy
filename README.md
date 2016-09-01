## Filtering proxy

This Node.js based HTTP/HTTPS proxy allows you to rewrite HTTP requests and responses based on rules (*if request matches this hostname, block the request*, etc). You can also add/remove/modify content on specific pages.

It has limited support for filtering HTTPS requests, in that you can use it
to block request to particular hostnames.

### Installation

First, make sure that recent versions of Node and NPM [are installed](http://nodejs.org/).

Next, install directly from the GitHub repository:

```
[sudo] npm install robertklep/node-filtering-proxy -g
```

`sudo` may or may not be necessary. Try without first, you may already have the right permissions to write to the global installation path.

### Configuration

TODO

### Running

```
filtering-proxy – a filtering HTTP/HTTPS proxy

Usage: filtering-proxy [options]

Options:
  -P PORT --port PORT         Port to listen on [default: 3033]
  -H HOST --host HOST         Hostname to listen on [default: localhost]
  -l LEVEL --log-level LEVEL  Log level [default: info]
  -r FILE --rules-file FILE   File that contains filter rules [default: ~/.filtering-proxy/rules.js]
  -U URL --upstream URL       Upstream proxy URL
  -p FILE --pac-file FILE     PAC file for forwarding to upstream proxies
  -t URL --test URL           Test URL against rules (and exit)
  -h --help                   Show this screen
  -v --version                Show version

```
