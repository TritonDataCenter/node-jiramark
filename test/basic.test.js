/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2019, Joyent, Inc.
 */

'use strict';

var toHTML = require('..').markupToHTML;
var test = require('tape');

test('Single Paragraph', function (t) {
    t.equals(toHTML('hello'), '<p>hello</p>');
    t.equals(toHTML('hello world'), '<p>hello world</p>');
    t.equals(toHTML('hello world\n'), '<p>hello world</p>');
    t.equals(toHTML('hello world,\nand good morning!'),
        '<p>hello world, and good morning!</p>');
    t.equals(toHTML('hello world,\nand\ngood\nmorning!'),
        '<p>hello world, and good morning!</p>');

    t.end();
});

test('Sentences w/ special characters', function (t) {
    t.equals(toHTML('how are you?'), '<p>how are you?</p>');
    t.equals(toHTML('cat & dog'), '<p>cat &#38; dog</p>');
    t.equals(toHTML('a no-op function'), '<p>a no-op function</p>');
    t.equals(toHTML('this function pre- and post-processes'),
        '<p>this function pre- and post-processes</p>');
    t.equals(toHTML('use the -a flag to do this'),
        '<p>use the -a flag to do this</p>');
    t.equals(toHTML('In JIRA-1234 and JIRA-5678'),
        '<p>In JIRA-1234 and JIRA-5678</p>');

    t.end();
});

test('HTML Entities', function (t) {
    t.equals(toHTML('The backslash character (&#92;)'),
        '<p>The backslash character (&#92;)</p>');
    t.equals(toHTML('ab&copy;&amp;cd'),
        '<p>ab&copy;&amp;cd</p>');

    t.end();
});

test('Escaping characters', function (t) {
    t.equals(toHTML('\\{\\{noformat\\}\\}'), '<p>{{noformat}}</p>');
    t.equals(toHTML('\\* this is not a list'), '<p>* this is not a list</p>');

    t.end();
});

test('Multiple Paragraphs', function (t) {
    t.equals(toHTML('this is paragraph 1\n\nthis is paragraph 2'),
        '<p>this is paragraph 1</p>\n<p>this is paragraph 2</p>');
    t.equals(toHTML('this\nis\nparagraph\n1\n\nthis\nis\nparagraph\n2'),
        '<p>this is paragraph 1</p>\n<p>this is paragraph 2</p>');
    t.equals(toHTML('this\nis\nparagraph\n1\n\n\nthis\nis\nparagraph\n2'),
        '<p>this is paragraph 1</p>\n<p>this is paragraph 2</p>');

    t.end();
});

test('Simple Formatting', function (t) {
    t.equals(toHTML('{{hello}}'), '<p><code>hello</code></p>');
    t.equals(toHTML('??hello??'), '<p><cite>hello</cite></p>');
    t.equals(toHTML('*hello*'), '<p><b>hello</b></p>');
    t.equals(toHTML('_hello_'), '<p><i>hello</i></p>');
    t.equals(toHTML('~hello~'), '<p><sub>hello</sub></p>');
    t.equals(toHTML('^hello^'), '<p><sup>hello</sup></p>');
    t.equals(toHTML('-hello-'), '<p><span class="deleted">hello</span></p>');
    t.equals(toHTML('+hello+'), '<p><span class="inserted">hello</span></p>');

    // Single word in a sentence
    t.equals(toHTML('*hello* world'), '<p><b>hello</b> world</p>');
    t.equals(toHTML('hello *world*'), '<p>hello <b>world</b></p>');

    // Span of words in a sentence
    t.equals(toHTML('a *hello world* example'),
        '<p>a <b>hello world</b> example</p>');
    t.equals(toHTML('a _hello world_ example'),
        '<p>a <i>hello world</i> example</p>');

    // Some slightly more complicated examples
    t.equals(toHTML('a *hello _world_* example'),
        '<p>a <b>hello <i>world</i></b> example</p>');
    t.equals(toHTML('a _*hello* world_ example'),
        '<p>a <i><b>hello</b> world</i> example</p>');
    t.equals(toHTML('a _*hello* *world*_ example'),
        '<p>a <i><b>hello</b> <b>world</b></i> example</p>');

    t.end();
});

test('Multiple Formatting', function (t) {
    t.equals(toHTML('_*hello*_'), '<p><i><b>hello</b></i></p>');
    t.equals(toHTML('*_hello_*'), '<p><b><i>hello</i></b></p>');
    t.equals(toHTML('{{*hello*}}'), '<p><code><b>hello</b></code></p>');
    t.equals(toHTML('*{{hello}}*'), '<p><b><code>hello</code></b></p>');
    t.end();
});

test('Headings', function (t) {
    // Different headings
    t.equals(toHTML('h1. Hello'), '<h1>Hello</h1>');
    t.equals(toHTML('h2. Hello'), '<h2>Hello</h2>');
    t.equals(toHTML('h3. Hello'), '<h3>Hello</h3>');
    t.equals(toHTML('h4. Hello'), '<h4>Hello</h4>');
    t.equals(toHTML('h5. Hello'), '<h5>Hello</h5>');
    t.equals(toHTML('h6. Hello'), '<h6>Hello</h6>');

    // Multiple words in headings
    t.equals(toHTML('h1. Hello World'), '<h1>Hello World</h1>');

    // Formatting in headings
    t.equals(toHTML('h1. *Hello* World'), '<h1><b>Hello</b> World</h1>');
    t.equals(toHTML('h1. Hello [World|http://github.com]'),
        '<h1>Hello <a href="http://github.com">World</a></h1>');

    t.end();
});

test('Blockquotes', function (t) {
    t.equals(toHTML('bq. Hello World'),
        '<blockquote>Hello World</blockquote>');
    t.equals(toHTML('bq. Hello *World*'),
        '<blockquote>Hello <b>World</b></blockquote>');

    // Multiple blockquotes in a row produce separate blocks
    t.equals(toHTML('bq. Hello\nbq. World'),
        '<blockquote>Hello</blockquote>\n<blockquote>World</blockquote>');
    t.equals(toHTML('bq. Hello\nbq. World\nbq. Foo'),
        '<blockquote>Hello</blockquote>\n' +
        '<blockquote>World</blockquote>\n' +
        '<blockquote>Foo</blockquote>');

    t.end();
});

test('{noformat} blocks', function (t) {
    // No formatting is applied w/in the block
    t.equal(toHTML('{noformat}bq. hello{noformat}'),
        '<pre>\nbq. hello\n</pre>');

    // First three newlines should be elided from output
    t.equal(toHTML('{noformat}\nbq. hello{noformat}'),
        '<pre>\nbq. hello\n</pre>');
    t.equal(toHTML('{noformat}\n\nbq. hello{noformat}'),
        '<pre>\nbq. hello\n</pre>');
    t.equal(toHTML('{noformat}\n\n\nbq. hello{noformat}'),
        '<pre>\nbq. hello\n</pre>');
    t.equal(toHTML('{noformat}\n\n\n\nbq. hello{noformat}'),
        '<pre>\n&#10;bq. hello\n</pre>');
    t.equal(toHTML('{noformat}\n\n\n\n\nbq. hello{noformat}'),
        '<pre>\n&#10;&#10;bq. hello\n</pre>');

    t.end();
});

test('{code} blocks', function (t) {
    t.equal(toHTML('{code}\n(+ 1 2)\n{code}'),
        '<pre>\n(+ 1 2)&#10;\n</pre>');

    // First three newlines should be elided from output
    t.equal(toHTML('{code}\nbq. hello{code}'),
        '<pre>\nbq. hello\n</pre>');
    t.equal(toHTML('{code}\n\nbq. hello{code}'),
        '<pre>\nbq. hello\n</pre>');
    t.equal(toHTML('{code}\n\n\nbq. hello{code}'),
        '<pre>\nbq. hello\n</pre>');
    t.equal(toHTML('{code}\n\n\n\nbq. hello{code}'),
        '<pre>\n&#10;bq. hello\n</pre>');

    // Trailing newlines are not elided
    t.equal(toHTML('{code}\n\n\n\nbq. hello\n\n{code}'),
        '<pre>\n&#10;bq. hello&#10;&#10;\n</pre>');

    // Options (currently we do nothing with them)
    t.equal(toHTML('{code:title=Foo.java|borderStyle=solid}int a = 5;{code}'),
        '<pre>\nint a = 5;\n</pre>');

    t.end();
});

test('{quote} blocks', function (t) {
    t.equal(toHTML('{quote}hello world{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');
    t.equal(toHTML('{quote}hello world\n{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');
    t.equal(toHTML('{quote}\nhello world\n{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');

    t.end();
});

test('{panel} blocks', function (t) {
    t.equal(toHTML('{panel}hello world{panel}'),
        '<div class="panel">\n<p>hello world</p>\n</div>');

    // Options (currently we do nothing with them)
    t.equal(toHTML('{panel:title=Foo &amp; Bar}hello world{panel}'),
        '<div class="panel">\n<p>hello world</p>\n</div>');
    t.equal(toHTML('{panel:title=F=B|borderStyle=dashed}hello world{panel}'),
        '<div class="panel">\n<p>hello world</p>\n</div>');

    t.end();
});

test('{color} blocks', function (t) {
    t.equal(toHTML('{color:red}hello{color}'),
        '<div style="color: red">\n<p>hello</p>\n</div>');
    t.equal(toHTML('{color:blue}hello{color}'),
        '<div style="color: blue">\n<p>hello</p>\n</div>');
    t.equal(toHTML('{color:#ffffff}hello{color}'),
        '<div style="color: #ffffff">\n<p>hello</p>\n</div>');
    t.end();
});

test('Nested blocks', function (t) {
    var beg = '{quote}here is the command:';
    var end = '{noformat}$ ls -l{noformat}{quote}';
    t.equals(toHTML(beg + ' ' + end),
        '<blockquote>\n<p>here is the command: </p>\n' +
        '<pre>\n$ ls -l\n</pre>\n</blockquote>');
    t.equals(toHTML(beg + end),
        '<blockquote>\n<p>here is the command:</p>\n' +
        '<pre>\n$ ls -l\n</pre>\n</blockquote>');
    t.equals(toHTML(beg + '\n' + end),
        '<blockquote>\n<p>here is the command:</p>\n' +
        '<pre>\n$ ls -l\n</pre>\n</blockquote>');
    t.end();
});

test('Lists', function (t) {
    // Single item lists
    t.equals(toHTML('# Hello World'),
        '<ol>\n<li>Hello World</li>\n</ol>');
    t.equals(toHTML('- Hello World'),
        '<ul>\n<li>Hello World</li>\n</ul>');
    t.equals(toHTML('* Hello World'),
        '<ul>\n<li>Hello World</li>\n</ul>');

    // Formatting in lists
    t.equals(toHTML('# *Hello* World'),
        '<ol>\n<li><b>Hello</b> World</li>\n</ol>');
    t.equals(toHTML('- Hello -World-'),
        '<ul>\n<li>Hello <span class="deleted">World</span></li>\n</ul>');
    t.equals(toHTML('* *Hello* World'),
        '<ul>\n<li><b>Hello</b> World</li>\n</ul>');

    // Multiple items in a list
    t.equals(toHTML('# Hello\n# World'),
        '<ol>\n<li>Hello</li>\n<li>World</li>\n</ol>');
    t.equals(toHTML('- Hello\n- World'),
        '<ul>\n<li>Hello</li>\n<li>World</li>\n</ul>');
    t.equals(toHTML('* Hello\n* World'),
        '<ul>\n<li>Hello</li>\n<li>World</li>\n</ul>');

    // Nested lists
    t.equals(toHTML('# A sublist:\n** Thing A\n** Thing B'),
        '<ol>\n' +
        '<li>A sublist:\n' +
        '<ul>\n' +
        '<li>Thing A</li>\n' +
        '<li>Thing B</li>\n</ul></li>\n' +
        '</ol>');
    t.equals(toHTML('# A sublist:\n** Thing A\n** Thing B\n# Last item'),
        '<ol>\n<li>A sublist:\n' +
        '<ul>\n<li>Thing A</li>\n' +
        '<li>Thing B</li>\n</ul></li>\n' +
        '<li>Last item</li>\n</ol>');
    t.equals(toHTML('* Top\n** Middle\n*** Bottom'),
        '<ul>\n<li>Top\n' +
        '<ul>\n<li>Middle\n' +
        '<ul>\n<li>Bottom</li>\n</ul></li>\n</ul></li>\n</ul>');
    t.equals(
        toHTML(
            '* Top 1\n** Middle 1\n*** Bottom 1\n' +
            '*** Bottom 2\n** Middle 2\n* Top 2'),
        '<ul>\n<li>Top 1\n' +
        '<ul>\n<li>Middle 1\n' +
        '<ul>\n<li>Bottom 1</li>\n<li>Bottom 2</li>\n</ul></li>\n' +
        '<li>Middle 2</li>\n</ul></li>\n' +
        '<li>Top 2</li>\n</ul>');

    // Switch list types in sublist
    t.equals(toHTML('* Top\n** Item A\n*# Item 1\n*# Item 2\n** Item B'),
        '<ul>\n<li>Top\n' +
        '<ul>\n<li>Item A</li>\n</ul>\n' +
        '<ol>\n<li>Item 1</li>\n<li>Item 2</li>\n</ol>\n' +
        '<ul>\n<li>Item B</li>\n</ul></li>\n</ul>');

    t.end();
});

test('Tables', function (t) {
    // XXX: Not yet implemented
    t.end();
});

test('Links', function (t) {
    // Just URLs
    t.equals(toHTML('[http://github.com]'),
        '<p><a href="http://github.com">http://github.com</a></p>');
    t.equals(toHTML('[https://example.com/foo?bar=baz&quux=m#hello]'),
        '<p><a href="https://example.com/foo?bar=baz&quux=m#hello">' +
        'https://example.com/foo?bar=baz&#38;quux=m#hello</a></p>');

    // URLs with text
    t.equals(toHTML('[GitHub|http://github.com]'),
        '<p><a href="http://github.com">GitHub</a></p>');
    t.equals(toHTML('[GitHub Website|http://github.com]'),
        '<p><a href="http://github.com">GitHub Website</a></p>');

    // In the middle of a sentence
    t.equals(toHTML('Go to the [GitHub|http://github.com] homepage'),
        '<p>Go to the <a href="http://github.com">GitHub</a> homepage</p>');

    t.end();
});
