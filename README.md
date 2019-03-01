<!--
    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
    Copyright (c) 2019, Joyent, Inc.
-->

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

You'll also want to insert CSS into the page to help format things the way you
want. Here's an example to start with:

```css
div.panel {
  border: 2px solid black;
  margin-left: 1em;
  margin-right: 1em;
}
div.code, div.preformatted {
  font-family: Monospace;
}
div.panel, pre {
  background-color: #eeeeee;
}
div.panel div {
  padding: 9px 12px;
}
div.panel div.panelHeader {
  border-bottom: 2px solid black;
}
th, tr {
  border: 1px solid black;
  padding: 3px 4px;
}
th {
  background-color: #eeeeee;
  text-align: center;
}
```

## License

This Source Code Form is subject to the terms of the Mozilla Public License, v.
2.0.  For the full license text see LICENSE, or http://mozilla.org/MPL/2.0/.

Copyright (c) 2018, Joyent, Inc.

## Bugs

See <https://github.com/joyent/node-jiramark/issues>.
