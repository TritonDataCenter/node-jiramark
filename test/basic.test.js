/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2019, Joyent, Inc.
 */

'use strict';

var mod_url = require('url');
var toHTML = require('..').markupToHTML;
var test = require('tape');

// --- Helpers

function createPanelBlock(names, contents, header) {
    var html = '<div class="';
    var i;

    for (i = 0; i < names.length; ++i) {
        html += names[i] + ' ';
    }

    html += '">\n';

    if (header) {
        html += '<div class="';
        for (i = 0; i < names.length; ++i) {
            html += names[i] + 'Header ';
        }
        html += '"><b>' + header + '</b></div>\n';
    }

    html += '<div class="';
    for (i = 0; i < names.length; ++i) {
        html += names[i] + 'Content ';
    }
    html += '">\n' + contents + '\n</div>\n</div>';

    return html;
}

function code(contents, header) {
    return createPanelBlock(['code', 'panel'], contents, header);
}

function noformat(contents, header) {
    contents = '<pre>' + contents + '</pre>';

    return createPanelBlock(['preformatted', 'panel'], contents, header);
}

function panel(contents, header) {
    return createPanelBlock(['panel'], contents, header);
}

function table(rows) {
    var html = '<table><tbody>\n';
    for (var i = 0; i < rows.length; ++i) {
        html += '<tr>' + rows[i] + '</tr>\n';
    }
    html += '</tbody></table>';
    return html;
}


// --- Tests

test('Single Paragraph', function (t) {
    t.equals(toHTML('hello'), '<p>hello</p>');
    t.equals(toHTML('hello world'), '<p>hello world</p>');
    t.equals(toHTML('hello world\n'), '<p>hello world</p>');
    t.equals(toHTML('hello world, and good morning!'),
        '<p>hello world, and good morning!</p>');

    // Line breaks within paragraphs are preserved
    t.equals(toHTML('hello world,\nand good morning!'),
        '<p>hello world,<br />\nand good morning!</p>');
    t.equals(toHTML('hello world,\nand\ngood\nmorning!'),
        '<p>hello world,<br />\nand<br />\ngood<br />\nmorning!</p>');

    // Leading lines at start of document are okay
    t.equals(toHTML('\nhello world'), '<p>hello world</p>');
    t.equals(toHTML('\n\n\nhello world'), '<p>hello world</p>');

    // Formatting at start of line that could be confused for bullets
    t.equals(toHTML('hello world,\n*and*\n-good morning!-'),
        '<p>hello world,<br />\n' +
        '<b>and</b><br />\n' +
        '<del>good morning!</del></p>');

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
    t.equals(toHTML('Use either a || b with it'),
        '<p>Use either a || b with it</p>');
    t.equals(toHTML('Call open() with O_APPEND | O_CREAT'),
        '<p>Call open() with O_APPEND | O_CREAT</p>');
    t.equals(toHTML('notice that **double stars** do nothing'),
        '<p>notice that **double stars** do nothing</p>');
    t.equals(toHTML('Use the doThing(arg[, opt]) function'),
        '<p>Use the doThing(arg[, opt]) function</p>');
    t.equals(toHTML('Array access is arr[idx]'),
        '<p>Array access is arr[idx]</p>');
    t.equals(toHTML('__ctype_mask[EOF] has been working by accident'),
        '<p>__ctype_mask[EOF] has been working by accident</p>');

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
    t.equals(toHTML('\\_emphasis\\_'), '<p>_emphasis_</p>');
    t.equals(toHTML('\\* this is not a list'), '<p>* this is not a list</p>');
    t.equals(toHTML('{{\\_id}} is _virtualised_'),
        '<p><code>_id</code> is <i>virtualised</i></p>');

    t.end();
});

test('Multiple Paragraphs', function (t) {
    t.equals(toHTML('this is paragraph 1\n\nthis is paragraph 2'),
        '<p>this is paragraph 1</p>\n<p>this is paragraph 2</p>');

    // Lines that are nothing but space can separate blocks
    t.equals(toHTML('this is paragraph 1\n    \nthis is paragraph 2'),
        '<p>this is paragraph 1</p>\n<p>this is paragraph 2</p>');
    t.equals(toHTML('this is paragraph 1\n\t\t\nthis is paragraph 2'),
        '<p>this is paragraph 1</p>\n<p>this is paragraph 2</p>');
    t.equals(toHTML('this is paragraph 1\n\u00a0\nthis is paragraph 2'),
        '<p>this is paragraph 1</p>\n<p>this is paragraph 2</p>');

    // Line breaks within a paragraph are preserved
    t.equals(toHTML('this\nis\nparagraph\n1\n\nthis\nis\nparagraph\n2'),
        '<p>this<br />\nis<br />\nparagraph<br />\n1</p>\n' +
        '<p>this<br />\nis<br />\nparagraph<br />\n2</p>');
    t.equals(toHTML('this\nis\nparagraph\n1\n\n\nthis\nis\nparagraph\n2'),
        '<p>this<br />\nis<br />\nparagraph<br />\n1</p>\n' +
        '<p>this<br />\nis<br />\nparagraph<br />\n2</p>');

    t.end();
});

test('Monospaced text', function (t) {
    t.equals(toHTML('{{hello}}'),
        '<p><code>hello</code></p>');
    t.equals(toHTML('{{open}}/{{close}}'),
        '<p><code>open</code>/<code>close</code></p>');
    t.equals(toHTML('{{ | sort}}'),
        '<p><code> | sort</code></p>');
    t.equals(toHTML('{{\\_id}}'),
        '<p><code>_id</code></p>');
    t.equals(toHTML('Use {{FOO_BAR}} and {{BAZ_QUUX}} here.'),
        '<p>Use <code>FOO_BAR</code> and <code>BAZ_QUUX</code> here.</p>');

    t.end();
});

test('Simple Formatting', function (t) {
    t.equals(toHTML('??hello??'), '<p><cite>hello</cite></p>');
    t.equals(toHTML('*hello*'), '<p><b>hello</b></p>');
    t.equals(toHTML('_hello_'), '<p><i>hello</i></p>');
    t.equals(toHTML('~hello~'), '<p><sub>hello</sub></p>');
    t.equals(toHTML('^hello^'), '<p><sup>hello</sup></p>');
    t.equals(toHTML('-hello-'), '<p><del>hello</del></p>');
    t.equals(toHTML('+hello+'), '<p><ins>hello</ins></p>');

    // Single word in a sentence
    t.equals(toHTML('*hello* world'), '<p><b>hello</b> world</p>');
    t.equals(toHTML('hello *world*'), '<p>hello <b>world</b></p>');

    // Span of words in a sentence
    t.equals(toHTML('a *hello world* example'),
        '<p>a <b>hello world</b> example</p>');
    t.equals(toHTML('a _hello world_ example'),
        '<p>a <i>hello world</i> example</p>');

    // Formatting can start after certain characters
    t.equals(toHTML('Formatting in parens (*like*) (_this_)'),
        '<p>Formatting in parens (<b>like</b>) (<i>this</i>)</p>');

    t.end();
});

test('Multiple Formatting', function (t) {
    t.equals(toHTML('_*hello*_'), '<p><i><b>hello</b></i></p>');
    t.equals(toHTML('*_hello_*'), '<p><b><i>hello</i></b></p>');
    t.equals(toHTML('{{*hello*}}'), '<p><code><b>hello</b></code></p>');
    t.equals(toHTML('*{{hello}}*'), '<p><b><code>hello</code></b></p>');

    // Some slightly more complicated examples
    t.equals(toHTML('a *hello _world_* example'),
        '<p>a <b>hello <i>world</i></b> example</p>');
    t.equals(toHTML('a _*hello* world_ example'),
        '<p>a <i><b>hello</b> world</i> example</p>');
    t.equals(toHTML('a _*hello* *world*_ example'),
        '<p>a <i><b>hello</b> <b>world</b></i> example</p>');

    // Formatting can begin immediately after ending a previous format
    t.equals(toHTML('+a+*b*-c-{{d}}'),
        '<p><ins>a</ins><b>b</b><del>c</del><code>d</code></p>');
    t.equals(toHTML('hello +a+*b*-c-{{d}}'),
        '<p>hello <ins>a</ins><b>b</b><del>c</del><code>d</code></p>');
    t.equals(toHTML('*a**b**c**d*'),
        '<p><b>a</b><b>b</b><b>c</b><b>d</b></p>');
    t.equals(toHTML('hello *a**b**c**d*'),
        '<p>hello <b>a</b><b>b</b><b>c</b><b>d</b></p>');

    t.end();
});

test('Format characters intended as literals', function (t) {
    // Using "~" as "approximately" in a sentence.
    t.equals(toHTML('The results are ~5 and ~7.'),
        '<p>The results are ~5 and ~7.</p>');
    t.equals(toHTML('~The results are ~5 and ~7~.'),
        '<p><sub>The results are ~5 and ~7</sub>.</p>');
    t.equals(toHTML('-The results are ~5 and ~7-.'),
        '<p><del>The results are ~5 and ~7</del>.</p>');
    t.equals(toHTML('+The results are ~5 and ~7+.'),
        '<p><ins>The results are ~5 and ~7</ins>.</p>');

    // Using "-" as "negative" in a sentence.
    t.equals(toHTML('The results are -5 and -7.'),
        '<p>The results are -5 and -7.</p>');
    t.equals(toHTML('~The results are -5 and -7~.'),
        '<p><sub>The results are -5 and -7</sub>.</p>');
    t.equals(toHTML('-The results are -5 and -7-.'),
        '<p><del>The results are -5 and -7</del>.</p>');
    t.equals(toHTML('+The results are -5 and -7+.'),
        '<p><ins>The results are -5 and -7</ins>.</p>');

    // Using "+" as "positive" in a sentence.
    t.equals(toHTML('The results are +5 and +7.'),
        '<p>The results are +5 and +7.</p>');
    t.equals(toHTML('~The results are +5 and +7~.'),
        '<p><sub>The results are +5 and +7</sub>.</p>');
    t.equals(toHTML('-The results are +5 and +7-.'),
        '<p><del>The results are +5 and +7</del>.</p>');
    t.equals(toHTML('+The results are +5 and +7+.'),
        '<p><ins>The results are +5 and +7</ins>.</p>');

    // Using "??" for emphasizing a question.
    t.equals(toHTML('Question?? Another question??'),
        '<p>Question?? Another question??</p>');

    // Writing out equations.
    t.equals(toHTML('2 + 3 * 4 + 5'),
        '<p>2 + 3 * 4 + 5</p>');

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

    // After a paragraph
    t.equals(toHTML('Previous section sentence.\nh1. Hello'),
        '<p>Previous section sentence.</p>\n' +
        '<h1>Hello</h1>');

    t.end();
});

test('Blockquotes', function (t) {
    t.equals(toHTML('bq.Hello World'),
        '<blockquote>Hello World</blockquote>');
    t.equals(toHTML('bq. Hello World'),
        '<blockquote>Hello World</blockquote>');
    t.equals(toHTML('bq. Hello *World*'),
        '<blockquote>Hello <b>World</b></blockquote>');

    // After paragraph
    t.equals(toHTML('The man then said:\nbq. Hello *World*'),
        '<p>The man then said:</p>\n' +
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
        noformat('bq. hello'));

    // Different simple newline combos
    t.equal(toHTML('Example: {noformat}bq. hello{noformat}'),
        '<p>Example: </p>\n' +
        noformat('bq. hello'));
    t.equal(toHTML('Example:\n{noformat}bq. hello{noformat}'),
        '<p>Example:</p>\n' +
        noformat('bq. hello'));
    t.equal(toHTML('Example:\n{noformat}\nbq. hello\n{noformat}'),
        '<p>Example:</p>\n' +
        noformat('bq. hello&#10;'));

    // First three newlines should be elided from output
    t.equal(toHTML('{noformat}\nbq. hello{noformat}'),
        noformat('bq. hello'));
    t.equal(toHTML('{noformat}\n\nbq. hello{noformat}'),
        noformat('bq. hello'));
    t.equal(toHTML('{noformat}\n\n\nbq. hello{noformat}'),
        noformat('bq. hello'));
    t.equal(toHTML('{noformat}\n\n\n\nbq. hello{noformat}'),
        noformat('&#10;bq. hello'));
    t.equal(toHTML('{noformat}\n\n\n\n\nbq. hello{noformat}'),
        noformat('&#10;&#10;bq. hello'));

    // Leading spaces before opening
    t.equal(toHTML('    {noformat}bq. hello{noformat}'),
        noformat('bq. hello'));
    t.equal(toHTML('\t{noformat}bq. hello{noformat}'),
        noformat('bq. hello'));

    // Inner curly characters
    t.equal(toHTML('{noformat}}{{noformat}'),
        noformat('}{'));

    t.end();
});

test('{code} blocks', function (t) {
    t.equal(toHTML('{code}\n(+ 1 2)\n{code}'),
        code('<pre>(+ 1 2)&#10;</pre>'));

    // First three newlines should be elided from output
    t.equal(toHTML('{code}\nbq. hello{code}'),
        code('<pre>bq. hello</pre>'));
    t.equal(toHTML('{code}\n\nbq. hello{code}'),
        code('<pre>bq. hello</pre>'));
    t.equal(toHTML('{code}\n\n\nbq. hello{code}'),
        code('<pre>bq. hello</pre>'));
    t.equal(toHTML('{code}\n\n\n\nbq. hello{code}'),
        code('<pre>&#10;bq. hello</pre>'));

    // Trailing newlines are not elided
    t.equal(toHTML('{code}\n\n\n\nbq. hello\n\n{code}'),
        code('<pre>&#10;bq. hello&#10;&#10;</pre>'));

    // Options (currently only support title)
    t.equal(toHTML('{code:sql}SELECT * FROM foo;{code}'),
        code('<pre>SELECT * FROM foo;</pre>'));
    t.equal(toHTML('{code:title=Foo.java|borderStyle=solid}int a = 5;{code}'),
        code('<pre>int a = 5;</pre>', 'Foo.java'));

    t.end();
});

test('{quote} blocks', function (t) {
    t.equal(toHTML('{quote}hello world{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');
    t.equal(toHTML('{quote}hello world\n{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');
    t.equal(toHTML('{quote}\nhello world\n{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');
    t.equal(toHTML('{quote}\r\nhello world\r\n{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');

    // Runs of multiple newlines
    t.equal(toHTML('{quote}\n\nhello world\n{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');
    t.equal(toHTML('{quote}\n\n\nhello world\n\n\n{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');

    // Leading spaces before opening
    t.equal(toHTML('    {quote}hello world{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');
    t.equal(toHTML('\t{quote}hello world{quote}'),
        '<blockquote>\n<p>hello world</p>\n</blockquote>');

    t.end();
});

test('{panel} blocks', function (t) {
    t.equal(toHTML('{panel}hello world{panel}'),
        panel('<p>hello world</p>'));

    // Options (currently only support title)
    t.equal(toHTML('{panel:title=Foo &amp; Bar}hello world{panel}'),
        panel('<p>hello world</p>', 'Foo &amp; Bar'));
    t.equal(toHTML('{panel:title=F=B|borderStyle=dashed}hello world{panel}'),
        panel('<p>hello world</p>', 'F=B'));

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
        noformat('$ ls -l') + '\n' +
        '</blockquote>');
    t.equals(toHTML(beg + end),
        '<blockquote>\n<p>here is the command:</p>\n' +
        noformat('$ ls -l') + '\n' +
        '</blockquote>');
    t.equals(toHTML(beg + '\n' + end),
        '<blockquote>\n<p>here is the command:</p>\n' +
        noformat('$ ls -l') + '\n' +
        '</blockquote>');
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

    // Formatting in the first word of an item
    t.equals(toHTML('# *Hello* World'),
        '<ol>\n<li><b>Hello</b> World</li>\n</ol>');
    t.equals(toHTML('* *Hello* World'),
        '<ul>\n<li><b>Hello</b> World</li>\n</ul>');
    t.equals(toHTML('- -Hello World-'),
        '<ul>\n<li><del>Hello World</del></li>\n</ul>');

    // Blocks in an item
    t.equals(toHTML('- {noformat}hello{noformat}'),
        '<ul>\n<li>' + noformat('hello') + '</li>\n</ul>');
    t.equals(toHTML('- Example: {noformat}hello{noformat}'),
        '<ul>\n<li>Example: <br />\n' + noformat('hello') + '</li>\n</ul>');
    t.equals(toHTML('- Example:\n{noformat}hello{noformat}'),
        '<ul>\n<li>Example:<br />\n' + noformat('hello') + '</li>\n</ul>');

    // Multiple items in a list
    t.equals(toHTML('# Hello\n# World'),
        '<ol>\n<li>Hello</li>\n<li>World</li>\n</ol>');
    t.equals(toHTML('- Hello\n- World'),
        '<ul>\n<li>Hello</li>\n<li>World</li>\n</ul>');
    t.equals(toHTML('* Hello\n* World'),
        '<ul>\n<li>Hello</li>\n<li>World</li>\n</ul>');

    // Multi-line items
    t.equals(
        toHTML(
            '# Item\n  A\n' +
            '# Item B\n{noformat}\nfoo\n{noformat}\nAfter\n\n' +
            'Not in the list'),
        '<ol>\n<li>Item<br />\nA</li>\n' +
        '<li>Item B<br />\n' +
        noformat('foo&#10;') +
        '<br />\nAfter</li>\n</ol>\n' +
        '<p>Not in the list</p>');

    // Paragraph just before list
    t.equals(toHTML('List:\n# Hello\n# World'),
        '<p>List:</p>\n' +
        '<ol>\n<li>Hello</li>\n<li>World</li>\n</ol>');
    t.equals(toHTML('List:\n- Hello\n- World'),
        '<p>List:</p>\n' +
        '<ul>\n<li>Hello</li>\n<li>World</li>\n</ul>');
    t.equals(toHTML('List:\n* Hello\n* World'),
        '<p>List:</p>\n' +
        '<ul>\n<li>Hello</li>\n<li>World</li>\n</ul>');

    // Lines that are just spaces can be a separator
    t.equals(toHTML('* Hello\n   \nWorld'),
        '<ul>\n<li>Hello</li>\n</ul>\n<p>World</p>');

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

    // Spaces before bullets
    t.equals(toHTML(' * *Top*\n * *  *Middle*\n   * * *   *Bottom*'),
        '<ul>\n<li><b>Top</b>\n' +
        '<ul>\n<li><b>Middle</b>\n' +
        '<ul>\n<li><b>Bottom</b></li>\n</ul></li>\n</ul></li>\n</ul>');

    t.end();
});

test('Tables', function (t) {
    // Single row
    t.equals(toHTML('|a|b|c|'),
        table(['<td>a</td><td>b</td><td>c</td>']));
    t.equals(toHTML('||a||b||c||'),
        table(['<th>a</th><th>b</th><th>c</th>']));

    // Multiple adjacent pipes creates a single table header
    t.equals(toHTML('|||a|||b|||c|||'),
        table(['<th>a</th><th>b</th><th>c</th>']));
    t.equals(toHTML('||||a||||b||||c||||'),
        table(['<th>a</th><th>b</th><th>c</th>']));

    // Multiple rows
    t.equals(toHTML('||a||b||c||\n|d|e|f|\n|g|h|i|'), table([
        '<th>a</th><th>b</th><th>c</th>',
        '<td>d</td><td>e</td><td>f</td>',
        '<td>g</td><td>h</td><td>i</td>']));

    // Bars aren't needed to end a line when one starts the next
    t.equals(toHTML('||a||b||c\n|d|e|f\n'), table([
        '<th>a</th><th>b</th><th>c</th>',
        '<td>d</td><td>e</td><td>f</td>']));

    // Headers are in the first column
    t.equals(toHTML('||a|b|\n||c|d|\n||e|f|'), table([
        '<th>a</th><td>b</td>',
        '<th>c</th><td>d</td>',
        '<th>e</th><td>f</td>']));

    // Empty cells
    t.equals(toHTML('||a||b||c||\n| | | |'), table([
        '<th>a</th><th>b</th><th>c</th>',
        '<td> </td><td> </td><td> </td>']));

    // Formatting in cells
    t.equals(toHTML('||~a~|| *b* ||{{c}}||\n|^d^| -e- |+f+|'), table([
        '<th><sub>a</sub></th><th> <b>b</b> </th><th><code>c</code></th>',
        '<td><sup>d</sup></td><td> <del>e</del> </td><td><ins>f</ins></td>']));

    // Paragraph just before table
    t.equals(toHTML('A table:\n||a||b||c||\n|d|e|f|'),
        '<p>A table:</p>\n' + table([
        '<th>a</th><th>b</th><th>c</th>',
        '<td>d</td><td>e</td><td>f</td>']));

    // Paragraph just after table
    t.equals(toHTML('||a||b||c||\n|d|e|f|\nConsider above table.'), table([
        '<th>a</th><th>b</th><th>c</th>',
        '<td>d</td><td>e</td><td>f</td>']) +
        '\n<p>Consider above table.</p>');

    // Blocks
    t.equals(toHTML('|bq. This is a quote|'), table([
        '<td><blockquote>This is a quote</blockquote></td>' ]));
    t.equals(toHTML('|h1. This is a header|'), table([
        '<td><h1>This is a header</h1></td>' ]));
    t.equals(toHTML('|{noformat}a{noformat}{noformat}b{noformat}|'),
        table(['<td>' + noformat('a') + '<br />' + noformat('b') + '</td>']));
    t.equals(toHTML('|{noformat}a{noformat}\n{noformat}b{noformat}|'),
        table(['<td>' + noformat('a') + '<br />' + noformat('b') + '</td>']));

    // Multiline cells
    t.equals(toHTML('|h1. Header\nText|'), table([
        '<td><h1>Header</h1><br />Text</td>' ]));
    t.equals(toHTML('|This is a\nmultiline paragraph|'), table([
        '<td>This is a<br />multiline paragraph</td>' ]));
    t.equals(toHTML('|This is a\nmultiline\nparagraph|'), table([
        '<td>This is a<br />multiline<br />paragraph</td>' ]));

    // Table nested inside cell
    t.equals(toHTML('|{panel}\n||a|b|\n||c|d|\n{panel}|'),
        table(['<td>' +
        panel(table([ '<th>a</th><td>b</td>', '<th>c</th><td>d</td>'])) +
        '</td>']));

    // Unordered list inside a cell
    t.equals(toHTML('| - foo |'), table([
        '<td><ul>\n<li>foo </li>\n</ul></td>']));
    t.equals(toHTML('| - foo\n- bar|'), table([
        '<td><ul>\n<li>foo</li>\n<li>bar</li>\n</ul></td>']));
    t.equals(toHTML('| - foo\n- bar\n|'), table([
        '<td><ul>\n<li>foo</li>\n<li>bar</li>\n</ul></td>']));

    // Ordered list inside a cell
    t.equals(toHTML('| # foo |'), table([
        '<td><ol>\n<li>foo </li>\n</ol></td>']));
    t.equals(toHTML('| # foo\n# bar|'), table([
        '<td><ol>\n<li>foo</li>\n<li>bar</li>\n</ol></td>']));
    t.equals(toHTML('| # foo\n# bar\n|'), table([
        '<td><ol>\n<li>foo</li>\n<li>bar</li>\n</ol></td>']));

    // Bullet characters inside a cell that don't start a list
    t.equals(toHTML('| A | - | - |\n| B | - | - |'), table([
        '<td> A </td><td> - </td><td> - </td>',
        '<td> B </td><td> - </td><td> - </td>']));
    t.equals(toHTML('| A | * | * |\n| B | * | * |'), table([
        '<td> A </td><td> * </td><td> * </td>',
        '<td> B </td><td> * </td><td> * </td>']));
    t.equals(toHTML('| A | # | # |\n| B | # | # |'), table([
        '<td> A </td><td> # </td><td> # </td>',
        '<td> B </td><td> # </td><td> # </td>']));

    t.end();
});

test('Bare URLs', function (t) {
    // HTTP(S)
    t.equals(toHTML('http://example.com'),
        '<p><a href="http://example.com">http://example.com</a></p>');
    t.equals(toHTML('https://example.com'),
        '<p><a href="https://example.com">https://example.com</a></p>');
    t.equals(toHTML('https://example.com/foo?bar=baz&quux=m#hello'),
        '<p><a href="https://example.com/foo?bar=baz&quux=m#hello">' +
        'https://example.com/foo?bar=baz&#38;quux=m#hello</a></p>');

    // FTP
    t.equals(toHTML('ftp://ftp.gnu.org/gnu/grep/'),
        '<p><a href="ftp://ftp.gnu.org/gnu/grep/">' +
        'ftp://ftp.gnu.org/gnu/grep/</a></p>');
    t.equals(toHTML('ftps://ftp.gnu.org/gnu/grep/'),
        '<p><a href="ftps://ftp.gnu.org/gnu/grep/">' +
        'ftps://ftp.gnu.org/gnu/grep/</a></p>');

    // IRC
    t.equals(toHTML('irc://irc.freenode.net:6667/smartos'),
        '<p><a href="irc://irc.freenode.net:6667/smartos">' +
        'irc://irc.freenode.net:6667/smartos</a></p>');

    // Local file:// URL
    t.equals(toHTML('file:///home/cpm/src/node-jiramark'),
        '<p><a href="file:///home/cpm/src/node-jiramark">' +
        'file:///home/cpm/src/node-jiramark</a></p>');

    // JIRA DWIM behaviour for ending bare URLs
    t.equals(toHTML('(See http://example.com)'),
        '<p>(See <a href="http://example.com">http://example.com</a>)</p>');
    t.equals(toHTML('Use http://example.com!'),
        '<p>Use <a href="http://example.com">http://example.com</a>!</p>');
    t.equals(toHTML('Try http://example.com.'),
        '<p>Try <a href="http://example.com">http://example.com</a>.</p>');
    t.equals(toHTML('Use http://example.com, or https://example.com.'),
        '<p>Use <a href="http://example.com">http://example.com</a>, or ' +
        '<a href="https://example.com">https://example.com</a>.</p>');
    t.equals(toHTML('The site is \'http://example.com\''),
        '<p>The site is &#39;<a href="http://example.com">' +
        'http://example.com</a>&#39;</p>');

    t.end();
});

test('Links', function (t) {
    // Several different protocols
    t.equals(toHTML('[http://github.com]'),
        '<p><a href="http://github.com">http://github.com</a></p>');
    t.equals(toHTML('[https://example.com/foo?bar=baz&quux=m#hello]'),
        '<p><a href="https://example.com/foo?bar=baz&quux=m#hello">' +
        'https://example.com/foo?bar=baz&#38;quux=m#hello</a></p>');

    // Relative reference
    t.equals(toHTML('[//example.com]'),
        '<p><a href="//example.com">//example.com</a></p>');

    // Fragment reference
    t.equals(toHTML('[#hello]'),
        '<p><a href="#hello">hello</a></p>');
    t.equals(toHTML('[#/c/2115/1/usr/src/uts/common/exec/elf/elf.c]'),
        '<p><a href="#/c/2115/1/usr/src/uts/common/exec/elf/elf.c">' +
        '/c/2115/1/usr/src/uts/common/exec/elf/elf.c</a></p>');

    // URLs with text
    var jnj = 'joyent/node-jiramark';
    t.equals(toHTML('[GitHub|http://github.com]'),
        '<p><a href="http://github.com">GitHub</a></p>');
    t.equals(toHTML('[GitHub Website|http://github.com]'),
        '<p><a href="http://github.com">GitHub Website</a></p>');
    t.equals(toHTML('[' + jnj + '|https://github.com/' + jnj + ']'),
        '<p><a href="https://github.com/' + jnj + '">' + jnj + '</a></p>');
    t.equals(toHTML('[joyent/node\\-jiramark|https://github.com/' + jnj + ']'),
        '<p><a href="https://github.com/' + jnj + '">' + jnj + '</a></p>');
    t.equals(toHTML('[' + jnj + '#1|https://github.com/' + jnj + '/issues/1]'),
        '<p><a href="https://github.com/' + jnj + '/issues/1">' +
        jnj + '#1</a></p>');

    // Spaces are okay around the URL
    t.equals(toHTML('[ http://github.com]'),
        '<p><a href="http://github.com">http://github.com</a></p>');
    t.equals(toHTML('[http://github.com ]'),
        '<p><a href="http://github.com">http://github.com</a></p>');
    t.equals(toHTML('[    http://github.com    ]'),
        '<p><a href="http://github.com">http://github.com</a></p>');
    t.equals(toHTML('[GitHub| http://github.com]'),
        '<p><a href="http://github.com">GitHub</a></p>');
    t.equals(toHTML('[GitHub|http://github.com ]'),
        '<p><a href="http://github.com">GitHub</a></p>');
    t.equals(toHTML('[GitHub|    http://github.com    ]'),
        '<p><a href="http://github.com">GitHub</a></p>');

    // In the middle of a sentence
    t.equals(toHTML('Go to the [GitHub|http://github.com] homepage'),
        '<p>Go to the <a href="http://github.com">GitHub</a> homepage</p>');

    // Formatting links
    t.equals(toHTML('[{{GitHub}} site|http://github.com]'),
        '<p><a href="http://github.com"><code>GitHub</code> site</a></p>');
    t.equals(toHTML('{{[GitHub|http://github.com]}}'),
        '<p><code><a href="http://github.com">GitHub</a></code></p>');
    t.equals(toHTML('{{[GitHub|http://github.com] site}}'),
        '<p><code><a href="http://github.com">GitHub</a> site</code></p>');
    t.equals(toHTML('[*GitHub site*|http://github.com]'),
        '<p><a href="http://github.com"><b>GitHub site</b></a></p>');
    t.equals(toHTML('*[GitHub|http://github.com]* site'),
        '<p><b><a href="http://github.com">GitHub</a></b> site</p>');

    // Subscript in link is not username reference
    t.equals(toHTML('[~GitHub site~|http://github.com]'),
        '<p><a href="http://github.com"><sub>GitHub site</sub></a></p>');

    // Escaped characters in link text
    t.equals(toHTML('*[a \\] b|http://example.com]* site'),
        '<p><b><a href="http://example.com">a ] b</a></b> site</p>');
    t.equals(toHTML('*[a \\[ b|http://example.com]* site'),
        '<p><b><a href="http://example.com">a [ b</a></b> site</p>');
    t.equals(toHTML('*[a \\* b|http://example.com]* site'),
        '<p><b><a href="http://example.com">a * b</a></b> site</p>');

    // Unrecognized schemes don't turn into links
    t.equals(toHTML('[tel:+1-201-555-0123]'),
        '<p>[tel:+1-201-555-0123]</p>');
    t.equals(toHTML('[urn:oasis:names:specification:docbook:dtd:xml:4.1.2]'),
        '<p>[urn:oasis:names:specification:docbook:dtd:xml:4.1.2]</p>');
    t.equals(toHTML('[news:comp.infosystems.www.servers.unix]'),
        '<p>[news:comp.infosystems.www.servers.unix]</p>');
    t.equals(toHTML('[mxc://example.com/foobarbaz]'),
        '<p>[mxc://example.com/foobarbaz]</p>');

    t.end();
});

test('Attachments', function (t) {
    // Just filename
    t.equals(toHTML('[^foo.gif]'),
        '<p><a href="#">foo.gif</a></p>');

    // With text
    t.equals(toHTML('[example|^foo.gif]'),
        '<p><a href="#">example</a></p>');

    // Spaces are okay around the filename
    t.equals(toHTML('[^  foo.gif]'),
        '<p><a href="#">foo.gif</a></p>');
    t.equals(toHTML('[^foo.gif  ]'),
        '<p><a href="#">foo.gif</a></p>');
    t.equals(toHTML('[^  foo.gif  ]'),
        '<p><a href="#">foo.gif</a></p>');
    t.equals(toHTML('[example|^  foo.gif]'),
        '<p><a href="#">example</a></p>');
    t.equals(toHTML('[example|^foo.gif  ]'),
        '<p><a href="#">example</a></p>');
    t.equals(toHTML('[example|^  foo.gif  ]'),
        '<p><a href="#">example</a></p>');

    t.end();
});

test('Embedding', function (t) {
    // Basic
    t.equals(toHTML('!foo.gif!'),
        '<p>[Attachment: <tt>foo.gif</tt>]</p>');
    t.equals(toHTML('!example.mov!'),
        '<p>[Attachment: <tt>example.mov</tt>]</p>');

    // URL
    t.equals(toHTML('!http://www.host.com/image.gif!'),
        '<p>[Attachment: <tt>http://www.host.com/image.gif</tt>]</p>');

    // Filenames with spaces
    t.equals(toHTML('!Screenshot-2018-6-6 - PG Stats(1).png|thumbnail!'),
        '<p>[Attachment: <tt>Screenshot-2018-6-6 - PG Stats(1).png</tt>]</p>');

    // Options
    t.equals(toHTML('!foo.gif|thumbnail!'),
        '<p>[Attachment: <tt>foo.gif</tt>]</p>');
    t.equals(toHTML('!media.wmv|id=media!'),
        '<p>[Attachment: <tt>media.wmv</tt>]</p>');
    t.equals(toHTML('!foo.gif|align=right, vspace=4!'),
        '<p>[Attachment: <tt>foo.gif</tt>]</p>');

    t.end();
});

test('Overriding HTML tags/attributes', function (t) {
    var ops = {
        formatLink: function (link, text) {
            return '<a rel="noopener noreferrer" target="_blank" href="' +
                link + '">' + text + '</a>';
        },
        formatAttachmentLink: function (href, text) {
            return '<a href="attachments/' + href + '">' + text + '</a>';
        },
        formatEmbedded: function (href, opts) {
            var url = mod_url.parse(href);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                return '<img href="' + href + '" />';
            }

            if (opts.length > 0 && opts[0] === 'thumbnail') {
                return '<img href="thumbnails/' + href + '" />';
            } else {
                return '<img href="attachments/' + href + '" />';
            }
        }
    };

    // Normal links
    t.equals(toHTML('http://example.com', ops),
        '<p><a rel="noopener noreferrer" target="_blank" ' +
        'href="http://example.com">http://example.com</a></p>');
    t.equals(toHTML('[http://example.com]', ops),
        '<p><a rel="noopener noreferrer" target="_blank" ' +
        'href="http://example.com">http://example.com</a></p>');
    t.equals(toHTML('[example|http://example.com]', ops),
        '<p><a rel="noopener noreferrer" target="_blank" ' +
        'href="http://example.com">example</a></p>');

    // Links to attachments
    t.equals(toHTML('[^foo.gif]', ops),
        '<p><a href="attachments/foo.gif">foo.gif</a></p>');
    t.equals(toHTML('[example|^foo.gif]', ops),
        '<p><a href="attachments/foo.gif">example</a></p>');

    // Embedding
    t.equals(toHTML('!foo.gif!', ops),
        '<p><img href="attachments/foo.gif" /></p>');
    t.equals(toHTML('!foo.gif|thumbnail!', ops),
        '<p><img href="thumbnails/foo.gif" /></p>');
    t.equals(toHTML('!http://www.host.com/image.gif!', ops),
        '<p><img href="http://www.host.com/image.gif" /></p>');

    t.end();
});

test('User References', function (t) {
    t.equals(toHTML('[~john.smith]'), '<p>@john.smith</p>');

    t.end();
});
