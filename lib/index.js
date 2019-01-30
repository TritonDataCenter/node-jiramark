/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2019, Joyent, Inc.
 */

'use strict';

var mod_fs = require('fs');
var mod_ent = require('ent');
var mod_ohm = require('ohm-js');
var mod_path = require('path');

var filename = mod_path.resolve(__dirname, 'jira.ohm');
var source = mod_fs.readFileSync(filename);
var grammar = mod_ohm.grammar(source);

var COLOR_RE = /^([a-z]+|#[a-f]{6})$/i;

function optionStrToArr(opts) {
    return opts.split('|').map(function (opt) {
        var idx = opt.indexOf('=');
        if (idx === -1) {
            return [ opt ];
        }

        return [ opt.slice(0, idx), opt.slice(idx + 1) ];
    });
}

function nodeToOptions(node) {
    return optionStrToArr(nodesToHTML(node.children[2], ''));
}

function bulletToTag(bullet) {
    var last = bullet.slice(-1);

    switch (last) {
    case '#':
        return 'ol';
    case '-':
    case '*':
        return 'ul';
    default:
        throw new Error('unknown bullet: ' + JSON.stringify(bullet));
    }
}

function nodeToHTML(node) {
    return node.toHTML();
}

function nodesToHTML(node, sep) {
    return node.children.map(nodeToHTML).join(sep);
}

var semantics = grammar.createSemantics().addOperation('toHTML', {
    Document: function (blocks, block) {
        var ha = blocks.toHTML();
        var hb = block.toHTML();
        var sep = '';

        if (ha.length > 0 && hb.length > 0) {
            sep = '\n';
        }

        return ha + sep + hb;
    },
    blocks: function (blocks, _nl) {
        return nodesToHTML(blocks, '\n');
    },
    block_header: function (h, _sp, sentence) {
        var lvl = h.sourceString.slice(0, 2);
        return '<' + lvl + '>' + sentence.toHTML() + '</' + lvl + '>';
    },
    block_noformat: function (contents) {
        return '<pre>\n' + contents.toHTML() + '\n</pre>';
    },
    block_code: function (contents) {
        return '<pre>\n' + contents.toHTML() + '\n</pre>';
    },
    block_color: function (contents) {
        var opts = nodeToOptions(contents);
        var open = '<div';
        if (opts.length > 0 && COLOR_RE.test(opts[0])) {
            open += ' style="color: ' + opts[0] + '"';
        }
        return open + '>\n' + contents.toHTML() + '\n</div>';
    },
    block_quote: function (contents) {
        var inner = contents.toHTML();
        return '<blockquote>\n' + inner + '\n</blockquote>';
    },
    block_panel: function (contents) {
        var inner = contents.toHTML();
        return '<div class="panel">\n' + inner + '\n</div>';
    },
    block_blockquote: function (_bq, _sp, contents) {
        return '<blockquote>' + contents.toHTML() + '</blockquote>';
    },
    block_list: function (bullets, _sp, items, _nls) {
        var liLevel = 0;
        var tags = [];
        var html = '';

        function close() {
            html += '\n</' + tags.pop() + '>';
        }

        function openl(tag) {
            tags.push(tag);
            if (html.length !== 0) {
                html += '\n';
            }
            html += '<' + tag + '>';
        }

        for (var i = 0; i < bullets.children.length; ++i) {
            var bullet = bullets.children[i].sourceString;
            var tag = bulletToTag(bullet);

            /* Close down to the current level, if needed. */
            while (bullet.length < tags.length) {
                html += '</li>';
                close();
            }

            while (bullet.length > tags.length) {
                openl(tag);
            }

            if (liLevel >= tags.length) {
                html += '</li>';
                liLevel -= 1;
            }

            /* If the list type has changed, re-open with the new tag. */
            if (tags.length > 0 && tags[tags.length - 1] !== tag) {
                close();
                openl(tag);
            }

            html += '\n<li>' + items.children[i].toHTML();
            liLevel += 1;
        }

        while (tags.length > 0) {
            html += '</li>';
            close();
        }

        return html;
    },
    block_paragraph: function (a, _nls) {
        return '<p>' + nodesToHTML(a, ' ') + '</p>';
    },
    readUntil: function (_lo, _lb, _o, _lc, _nl, contents, _ro, _rb, _rc) {
        return mod_ent.encode(contents.sourceString);
    },
    namedBlock: function (_lo, _l, _o, _lc, _nl, ba, _nls, bb, _ro, _r, _rc) {
        var ia = nodesToHTML(ba, '\n');
        var ib = bb.toHTML();
        var sep = '';
        if (ia.length > 0 && ib.length > 0) {
            sep = '\n';
        }

        return ia + sep + ib;
    },
    upToThreeNl: function (_nl1, _nl2, _nl3) {
        /*
         * For whatever reason, JIRA ignores the initial three
         * newlines within {code}/{noformat} blocks.
         */
        return '';
    },
    options: function (_colon, text) {
        return text.toHTML();
    },
    words: function (sentence) {
        return nodesToHTML(sentence, '');
    },
    word: function (contents) {
        return contents.toHTML();
    },
    word_link1: function (_lb, txt, _bar, uri, _rb) {
        var inner = nodesToHTML(txt, '');
        return '<a href="' + uri.sourceString + '">' + inner + '</a>';
    },
    word_link2: function (_lb, uri, _rb) {
        var inner = mod_ent.encode(uri.sourceString);
        return '<a href="' + uri.sourceString + '">' + inner + '</a>';
    },
    word_basic: function (chars) {
        return nodesToHTML(chars, '');
    },
    simpleWord_monospace: function (_l, contents, _r) {
        return '<code>' + nodesToHTML(contents, '') + '</code>';
    },
    simpleWord_citation: function (_l, contents, _r) {
        return '<cite>' + nodesToHTML(contents, '') + '</cite>';
    },
    simpleWord_strong: function (_l, contents, _r) {
        return '<b>' + nodesToHTML(contents, '') + '</b>';
    },
    simpleWord_emphasis: function (_l, contents, _r) {
        return '<i>' + nodesToHTML(contents, '') + '</i>';
    },
    simpleWord_subscript: function (_l, contents, _r) {
        return '<sub>' + nodesToHTML(contents, '') + '</sub>';
    },
    simpleWord_superscript: function (_l, contents, _r) {
        return '<sup>' + nodesToHTML(contents, '') + '</sup>';
    },
    simpleWord_deleted: function (_l, contents, _r) {
        var inner = nodesToHTML(contents, '');
        return '<span class="deleted">' + inner + '</span>';
    },
    simpleWord_inserted: function (_l, contents, _r) {
        var inner = nodesToHTML(contents, '');
        return '<span class="inserted">' + inner + '</span>';
    },
    ident: function (w) {
        return w.toHTML();
    },
    chars: function (chars) {
        return nodesToHTML(chars, '');
    },
    entchar: function (_amp, _hash, _ent, _semi) {
        return this.sourceString;
    },
    regchar: function (c) {
        return mod_ent.encode(c.sourceString);
    },
    escchar: function (_, c) {
        return mod_ent.encode(c.sourceString);
    },
    reserved: function (_) {
        return mod_ent.encode(this.sourceString);
    },
    _terminal: function () {
        return mod_ent.encode(this.sourceString);
    }
});

function jiraMarkupToHTML(str) {
    var m = grammar.match(str + '\n');
    if (m.failed()) {
        throw new Error(m.shortMessage);
    }

    return semantics(m).toHTML();
}

module.exports = {
    markupToHTML: jiraMarkupToHTML
};
