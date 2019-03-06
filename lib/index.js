/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2019, Joyent, Inc.
 */

'use strict';

var assert = require('assert-plus');
var mod_fs = require('fs');
var mod_ent = require('ent');
var mod_jsprim = require('jsprim');
var mod_ohm = require('ohm-js');
var mod_path = require('path');

var filename = mod_path.resolve(__dirname, 'jira.ohm');
var source = mod_fs.readFileSync(filename);
var grammar = mod_ohm.grammar(source);

var escapeHTML = mod_ent.encode;

/* BEGIN JSSTYLED */
var COLOR_RE = /^([a-z]+|#[a-f]{6})$/i;
var EMBED_OPTS_RE = /,\s*/;
/* END JSSTYLED */

var DEFAULT_OPS = {
    formatLink: function formatLink(href, text) {
        return '<a href="' + href + '">' + text + '</a>';
    },
    formatAttachmentLink: function formatLink(_href, text) {
        return '<a href="#">' + text + '</a>';
    },
    formatEmbedded: function formatLink(href) {
        return '[Attachment: <tt>' + escapeHTML(href) + '</tt>]';
    }
};

var curops = null;

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
    return optionStrToArr(nodesToHTML(node.children[3], ''));
}

function getValOfKeyFromOpts(opts, key) {
    var title = null;

    for (var i = 0; i < opts.length; ++i) {
        var opt = opts[i];
        if (opt[0] === key && opt.length === 2) {
            title = opt[1];
            break;
        }
    }

    return title;
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

function createPanelBlock(names, opts, contents) {
    var title = getValOfKeyFromOpts(opts, 'title');
    var html = '<div class="';
    var i;

    for (i = 0; i < names.length; ++i) {
        html += names[i] + ' ';
    }

    html += '">\n';

    if (title !== null) {
        html += '<div class="';
        for (i = 0; i < names.length; ++i) {
            html += names[i] + 'Header ';
        }
        html += '"><b>' + title + '</b></div>\n';
    }

    html += '<div class="';
    for (i = 0; i < names.length; ++i) {
        html += names[i] + 'Content ';
    }
    html += '">\n' + contents + '\n</div>\n</div>';

    return html;
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
    blocks: function (_nl1, blocks, _nl2) {
        return nodesToHTML(blocks, '\n');
    },
    tblock_paragraph: function (a, _nls) {
        return '<p>' + nodesToHTML(a, '<br />\n') + '</p>';
    },
    block_header: function (h, _sp, sentence) {
        var lvl = h.sourceString.slice(0, 2);
        return '<' + lvl + '>' + sentence.toHTML() + '</' + lvl + '>';
    },
    block_noformat: function (contents) {
        var opts = nodeToOptions(contents);
        var inner = '<pre>' + contents.toHTML() + '</pre>';

        return createPanelBlock(['preformatted', 'panel'], opts, inner);
    },
    block_code: function (contents) {
        var opts = nodeToOptions(contents);
        var inner = '<pre>' + contents.toHTML() + '</pre>';

        return createPanelBlock(['code', 'panel'], opts, inner);
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
        var opts = nodeToOptions(contents);

        return createPanelBlock(['panel'], opts, contents.toHTML());
    },
    block_blockquote: function (_bq, _sp, contents) {
        return '<blockquote>' + contents.toHTML() + '</blockquote>';
    },
    block_table: function (rows) {
        return '<table><tbody>\n' +
            nodesToHTML(rows, '\n') + '\n</tbody></table>';
    },
    bullet: function (_sp, point, rest) {
        return point.toHTML() + rest.toHTML();
    },
    row: function (cells, _end) {
        return '<tr>' + nodesToHTML(cells, '') + '</tr>';
    },
    cell: function (sep, content1, _nl, content2) {
        var inner = content1.toHTML();
        var rest = nodesToHTML(content2, '<br />');
        if (rest !== '') {
            inner += '<br />' + rest;
        }
        if (sep.sourceString.length > 1) {
            return '<th>' + inner + '</th>';
        } else {
            return '<td>' + inner + '</td>';
        }
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
            var bullet = bullets.children[i].sourceString.replace(/\s/g, '');
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

            html += '\n<li>' + nodesToHTML(items.children[i], '<br />\n');
            liLevel += 1;
        }

        while (tags.length > 0) {
            html += '</li>';
            close();
        }

        return html;
    },
    readUntil: function (_s, _lo, _lb, _o, _lc, _nl, contents, _ro, _rb, _rc) {
        return escapeHTML(contents.sourceString);
    },
    namedBlock: function (_s, _lo, _l, _o, _lc, _n, ba, _ns, bb, _ro, _r, _rc) {
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
        return nodesToHTML(text, '');
    },
    words_type1: function (formatted, sentence) {
        return nodesToHTML(formatted, '') + nodesToHTML(sentence, '');
    },
    words_type2: function (sentence) {
        return nodesToHTML(sentence, '');
    },
    markupWord_link: function (_lb, txt, _s1, uri, _s2, _rb) {
        if (txt.numChildren > 0) {
            return curops.formatLink(uri.sourceString, txt.toHTML());
        } else {
            return curops.formatLink(uri.sourceString, uri.toHTML());
        }
    },
    markupWord_attachment: function (_lb, txt, _caret, _s1, uri, _s2, _rb) {
        if (txt.numChildren > 0) {
            return curops.formatAttachmentLink(uri.sourceString, txt.toHTML());
        } else {
            return curops.formatAttachmentLink(uri.sourceString, uri.toHTML());
        }
    },
    markupWord_embed: function (_lb, uri, _bar, opts, _rb) {
        var options = [];
        if (opts.numChildren > 0) {
            options = nodesToHTML(opts.child(0), '').split(EMBED_OPTS_RE);
        }
        return curops.formatEmbedded(uri.sourceString, options);
    },
    markupWord_user: function (_lb, user, _rb) {
        return '@' + escapeHTML(user.sourceString);
    },
    markupWord_formatted: function (sp, fmt) {
        return sp.toHTML() + nodesToHTML(fmt, '');
    },
    markupWordUntil_multiple: function (first, rest, _st) {
        return first.toHTML() + nodesToHTML(rest, '');
    },
    markupWordUntil_simple: function (contents, _st) {
        return nodesToHTML(contents, '');
    },
    markupWordOne_formlit: function (a, b) {
        return a.toHTML() + b.toHTML();
    },
    markupWord_monospace: function (_l, contents) {
        return '<code>' + contents.toHTML() + '</code>';
    },
    formatted_citation: function (_l, contents) {
        return '<cite>' + nodesToHTML(contents, '') + '</cite>';
    },
    formatted_strong: function (_l, contents) {
        return '<b>' + contents.toHTML() + '</b>';
    },
    formatted_emphasis: function (_l, contents) {
        return '<i>' + contents.toHTML() + '</i>';
    },
    formatted_subscript: function (_l, contents) {
        return '<sub>' + contents.toHTML() + '</sub>';
    },
    formatted_superscript: function (_l, contents) {
        return '<sup>' + contents.toHTML() + '</sup>';
    },
    formatted_deleted: function (_l, contents) {
        return '<del>' + contents.toHTML() + '</del>';
    },
    formatted_inserted: function (_l, contents) {
        return '<ins>' + contents.toHTML() + '</ins>';
    },
    bareurl: function (_scheme, _sep, _url) {
        var inner = escapeHTML(this.sourceString);
        return curops.formatLink(this.sourceString, inner);
    },
    uri_complete: function (_scheme, _sep, _uri) {
        return escapeHTML(this.sourceString);
    },
    uri_relative: function (_sep, _uri) {
        return escapeHTML(this.sourceString);
    },
    uri_fragment: function (_hash, frag) {
        return escapeHTML(frag.sourceString);
    },
    urichars: function (chars) {
        return nodesToHTML(chars, '');
    },
    ident: function (c) {
        return c.toHTML();
    },
    entchar: function (_amp, _hash, _ent, _semi) {
        return this.sourceString;
    },
    regchar: function (c) {
        return escapeHTML(c.sourceString);
    },
    escchar: function (_, c) {
        return escapeHTML(c.sourceString);
    },
    _terminal: function () {
        return escapeHTML(this.sourceString);
    }
});

function jiraMarkupToHTML(str, ops) {
    assert.string(str, 'str');
    assert.optionalObject(ops, 'ops');

    curops = mod_jsprim.mergeObjects(ops, null, DEFAULT_OPS);

    var m = grammar.match(str + '\n');
    if (m.failed()) {
        throw new Error(m.shortMessage);
    }

    return semantics(m).toHTML();
}

module.exports = {
    markupToHTML: jiraMarkupToHTML
};
