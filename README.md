# jiramark

`jiramark` is a library for parsing the
[JIRA markup language](https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=all).
This library may fail to parse some markup since it doesn't fall back as
gracefully with weird input in the same way that JIRA does. If you have any
examples of sane markup that you think this library could handle, please open
an [issue](https://github.com/joyent/node-jiramark/issues).

## Installation

Install [node.js](http://nodejs.org/), then:

    npm install jiramark

## API

### `markupToHTML(input)`

This will return a string representing an approximation of the JIRA markup in
HTML. If the input cannot be parsed, then an explanatory `Error` will be thrown.

## License

This Source Code Form is subject to the terms of the Mozilla Public License, v.
2.0.  For the full license text see LICENSE, or http://mozilla.org/MPL/2.0/.

Copyright (c) 2018, Joyent, Inc.

## Bugs

See <https://github.com/joyent/node-jiramark/issues>.
