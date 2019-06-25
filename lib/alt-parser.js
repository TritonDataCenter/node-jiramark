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
var mod_jsprim = require('jsprim');
var mod_ohm = require('ohm-js');
var mod_path = require('path');
var mod_util = require('util');

var filename = mod_path.resolve(__dirname, 'jira.ohm');
var source = mod_fs.readFileSync(filename);

// JSSTYLED
var ESCAPE_RE = /[-[\]{}()*+?.,\\^$|#\s]/g;

function escapeRegExp(text) {
    return text.replace(ESCAPE_RE, '\\$&');
}

function unescapeChar(s) {
    if (s.charAt(0) !== '\\') {
        return s;
    }

    switch (s.charAt(1)) {
        case 'b': return '\b';
        case 'f': return '\f';
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        case 'v': return '\v';
        case 'x': return String.fromCharCode(parseInt(s.substring(2, 4), 16));
        case 'u': return String.fromCharCode(parseInt(s.substring(2, 6), 16));
        default: return s.charAt(1);
    }
}


// --- Results for calling .parse()

function InputView(str, begin, end) {
    this.iv_str = str;
    this.iv_begin = begin;
    this.iv_end = end;
    this.iv_rest = str.substring(end);
}

InputView.prototype.toString = function () {
    return this.iv_str.substring(this.iv_begin, this.iv_end);
};

InputView.prototype.getEnd = function () {
    return this.iv_end;
};

InputView.prototype.extend = function (end) {
    if (end < this.iv_end) {
        throw new Error('cannot move InputView backwards!');
    }
    return new InputView(this.iv_str, this.iv_begin, end);
};

InputView.prototype.range = function (length) {
    return new InputView(this.iv_str, this.iv_begin, this.iv_end + length);
};

InputView.prototype.next = function () {
    return new InputView(this.iv_str, this.iv_end, this.iv_end);
};



InputView.prototype.rest = function () {
    return this.iv_rest;
};

InputView.prototype.hasMore = function () {
    return this.iv_rest.length > 0;
};


function ParseNode(view, rname, iname) {
    this.pt_view = view;
    this.pt_rname = rname || null;
    this.pt_iname = iname || null;
}

ParseNode.prototype.setRuleName = function (name) {
    if (this.pt_rname !== null) {
        throw new Error('cannot set rule name twice!');
    }

    this.pt_rname = name;

    return this;
};

ParseNode.prototype.setInlineName = function (name) {
    if (this.pt_iname !== null) {
        throw new Error('cannot set rule inline name twice!');
    }

    this.pt_iname = name;

    return this;
};

ParseNode.prototype.explain = function () {
    return this;
};

ParseNode.prototype.group = function () {
    return this;
};

ParseNode.prototype.wrap = function () {
    var tall = new ParseShortNode(this, this.pt_view);
    var wide = new ParseWideNode([tall], this.pt_view);

    return wide;
};

ParseNode.prototype.unwrapShort = function () {
    return this;
};

ParseNode.prototype.hasMore = function () {
    return this.pt_view.hasMore();
};

Object.defineProperties(ParseNode.prototype, {
    children: {
        get: function () { throw new Error('not yet implemented'); }
    },
    numChildren: {
        get: function () { throw new Error('not yet implemented'); }
    },
    sourceString: {
        get: function () {
            if (this.pt_view !== null) {
                return this.pt_view.toString();
            } else {
                throw new Error('ParseNode has no source string!');
            }
        }
    },
    primitiveValue: {
        get: function () { throw new Error('not yet implemented'); }
    }
});

function ParseLazyNode(grammar, params, pred, oview, length, rname, iname) {
    this.pln_grammar = grammar;
    this.pln_params = params;
    this.pln_pred = pred;
    this.pln_view = oview;
    this.pln_result = null;

    ParseNode.call(this, oview.range(length), rname, iname);
}
mod_util.inherits(ParseLazyNode, ParseNode);

ParseLazyNode.prototype._force = function () {
    var g = this.pln_grammar;
    var p = this.pln_params;
    var v = this.pln_view;
    var r = this.pln_pred.parse(g, p, v);

    if (r.failed()) {
        throw new Error('Internal error! Failed to collapse lazy node.');
    } else {
        return r.setRuleName(this.pt_rname);
    }
};

ParseLazyNode.prototype.visit = function (visitor) {
    return this._force().visit(visitor);
};

function ParseMultiNode(children, view, rname, iname) {
    this.pt_children = children;

    ParseNode.call(this, view, rname, iname);
}
mod_util.inherits(ParseMultiNode, ParseNode);

ParseMultiNode.prototype.visit = function (visitor) {
    var children = this.children;
    var name = this.pt_rname;
    if (this.pt_iname !== null) {
        name += '_' + this.pt_iname;
    }

    if (name !== null && mod_jsprim.hasKey(visitor, name)) {
        return visitor[name].apply(this, children);
    } else if (children.length === 1) {
        return children[0].visit(visitor);
    } else {
        throw new Error('missing visitor method for ' +
            JSON.stringify(name));
    }
};

ParseMultiNode.prototype.mergeWith = function (start, others) {
    if (this.pt_children.length !== others.length) {
        throw new Error('Cannot merge node with a different length!');
    }

    var children = this.pt_children.slice();
    for (var i = 0; i < others.length; ++i) {
        var mn = others[i].getTallNodes();
        children[i] = children[i].prefixWith(others[i].pt_view, mn);
    }
    return new ParseWideNode(children,
        start.extend(this.pt_view.getEnd()), this.pt_rname, this.pt_iname);
};

ParseMultiNode.prototype.parseAndMerge = function (grammar, params, expr) {
    var result = expr.parse(grammar, params, this.pt_view.next());

    return result.mergeWith(this.pt_view, this.pt_children);
};

ParseMultiNode.prototype.parseAndConcat = function (grammar, params, expr) {
    var result = expr.parse(grammar, params, this.pt_view.next());

    return result.prefixWith(this.pt_view, this.pt_children);
};

ParseMultiNode.prototype.failed = function () {
    return false;
};

ParseMultiNode.prototype.child = function (idx) {
    var child = this.pt_children[idx];
    if (child) {
        child = child.unwrapShort();
    }
    return child;
};

Object.defineProperties(ParseMultiNode.prototype, {
    children: {
        get: function () {
            var children = this.pt_children.map(function (c) {
                return c.unwrapShort();
            });
            return children;
        }
    },
    numChildren: {
        get: function () { return this.pt_children.length; }
    },
    sourceString: {
        get: function () { return this.pt_view.toString(); }
    },
    primitiveValue: {
        get: function () { throw new Error('not yet implemented'); }
    }
});

function ParseWideNode(children, view, rname, iname) {
    this.pt_cname = 'ParseWideNode';
    ParseMultiNode.call(this, children, view, rname, iname);
}
mod_util.inherits(ParseWideNode, ParseMultiNode);


ParseWideNode.prototype.prefixWith = function (start, others) {
    return new ParseWideNode(others.concat(this.pt_children),
        start.extend(this.pt_view.getEnd()), this.pt_rname, this.pt_iname);
};

ParseWideNode.prototype.group = function () {
    var view = this.pt_view;
    var grouped = this.pt_children.map(function (node) {
        return new ParseShortNode(node, view);
    });

    return new ParseWideNode(grouped, view, this.pt_rname, this.pt_iname);
};


function ParseTallNode(children, view, rname, iname) {
    this.pt_cname = 'ParseTallNode';
    ParseMultiNode.call(this, children, view, rname, iname);
}
mod_util.inherits(ParseTallNode, ParseMultiNode);

ParseTallNode.prototype.visit = function (visitor) {
    return this.children.map(function (node) {
        return node.visit(visitor);
    });
};

ParseTallNode.prototype.getTallNodes = function () {
    return this.pt_children;
};

ParseTallNode.prototype.prefixWith = function (start, others) {
    return new ParseTallNode(others.concat(this.pt_children),
        start.extend(this.pt_view.getEnd()), this.pt_rname, this.pt_iname);
};

function ParseShortNode(node, view) {
    ParseTallNode.call(this, [ node ], view, null, null);
    this.pt_cname = 'ParseShortNode';
}
mod_util.inherits(ParseShortNode, ParseTallNode);

ParseShortNode.prototype.unwrapShort = function () {
    return this.pt_children[0].unwrapShort();
};

function ParseTerminal(text, view) {
    this.pt_cname = 'ParseTerminal';
    this.pt_text = text;

    ParseNode.call(this, view, null, null);
}
mod_util.inherits(ParseTerminal, ParseNode);

ParseTerminal.prototype.visit = function (visitor) {
    return visitor._terminal.apply(this);
};

ParseTerminal.prototype.mergeWith = function (_start, _others) {
    throw new Error('cannot merge terminal node');
};

ParseTerminal.prototype.prefixWith = function (_start, _others) {
    throw new Error('cannot add prefix to terminal node');
};

ParseTerminal.prototype.parseAndMerge = function (grammar, params, expr) {
    var result = expr.parse(grammar, params, this.pt_view.next());

    return result.mergeWith(this.pt_view, [this]);
};

ParseTerminal.prototype.parseAndConcat = function (grammar, params, expr) {
    var result = expr.parse(grammar, params, this.pt_view.next());

    return result.prefixWith(this.pt_view, [this]);
};

ParseTerminal.prototype.failed = function () {
    return false;
};

Object.defineProperties(ParseTerminal.prototype, {
    children: {
        get: function () { throw new Error('not yet implemented'); }
    },
    sourceString: {
        get: function () { return this.pt_text; }
    },
    primitiveValue: {
        get: function () { return this.pt_text; }
    }
});

function ParseError(why, cause) {
    this.pe_why = why;
    this.pe_cause = cause || null;

    ParseNode.call(this, null, null, null);
}
mod_util.inherits(ParseError, ParseNode);

ParseError.prototype.visit = function () {
    throw new Error('failed to parse input: ' + this.toString());
};

ParseError.prototype.setRuleName = function (_) {
    return this;
};

ParseError.prototype.setInlineName = function (_) {
    return this;
};

ParseError.prototype.mergeWith = function (_start, _others) {
    return this;
};

ParseError.prototype.prefixWith = function (_start, _others) {
    return this;
};

ParseError.prototype.parseAndMerge = function (_grammar, _params, _expr) {
    return this;
};

ParseError.prototype.parseAndConcat = function (_grammar, _params, _expr) {
    return this;
};

ParseError.prototype.failed = function () {
    return true;
};

ParseError.prototype.explain = function (why) {
    return new ParseError(why.getErrorMsg(), this);
};

ParseError.prototype.toString = function () {
    var str = this.pe_why;
    if (this.pe_cause !== null) {
        str += ': ' + this.pe_cause.toString();
    }
    return str;
};

ParseError.prototype.hasMore = function () {
    return false;
};

ParseError.prototype.wrap = function () {
    return this;
};

function createEmptySlots(width, view) {
    var arr = new Array(width);

    for (var i = 0; i < width; ++i) {
        arr[i] = new ParseTallNode([], view);
    }

    return new ParseWideNode(arr, view);
}

// --- Parsing expressions

function ParseExpression(width) {
    this.pe_width = width;
}

ParseExpression.prototype.getWidth = function () {
    return this.pe_width;
};

ParseExpression.prototype.parse = function () {
    throw new Error('not yet implemented');
};

ParseExpression.prototype.substitute = function () {
    throw new Error('not yet implemented');
};

ParseExpression.prototype.getRegExStr = function (_) {
    return null;
};

function ZeroOrMore(pred) {
    this.zom_pred = pred;

    ParseExpression.call(this, pred.getWidth());
}
mod_util.inherits(ZeroOrMore, ParseExpression);

ZeroOrMore.prototype.parse = function (grammar, params, view) {
    var result = createEmptySlots(this.getWidth(), view);
    var next = result;

    do {
        result = next;
        if (!result.hasMore()) {
            break;
        }
        next = result.parseAndMerge(grammar, params, this.zom_pred);
    } while (!next.failed());

    return result.explain(this).group();
};

ZeroOrMore.prototype.getErrorMsg = function () {
    return 'expected zero or more';
};

ZeroOrMore.prototype.getRegExStr = function (grammar) {
    var rs = this.zom_pred.getRegExStr(grammar);
    if (rs === null) {
        return null;
    }
    return rs + '*';
};

function OneOrMore(pred) {
    this.oom_pred = pred;

    ParseExpression.call(this, pred.getWidth());
}
mod_util.inherits(OneOrMore, ParseExpression);

OneOrMore.prototype.parse = function (grammar, params, view) {
    var result = createEmptySlots(this.getWidth(), view);
    var next = result.parseAndMerge(grammar, params, this.oom_pred);

    do {
        result = next;
        if (!result.hasMore()) {
            break;
        }
        next = result.parseAndMerge(grammar, params, this.oom_pred);
    } while (!next.failed());

    return result.explain(this).group();
};

OneOrMore.prototype.getErrorMsg = function () {
    return 'expected one or more';
};

OneOrMore.prototype.getRegExStr = function (grammar) {
    var rs = this.oom_pred.getRegExStr(grammar);
    if (rs === null) {
        return null;
    }
    return rs + '+';
};

function ZeroOrOne(pred) {
    this.zoo_pred = pred;

    ParseExpression.call(this, pred.getWidth());
}
mod_util.inherits(ZeroOrOne, ParseExpression);

ZeroOrOne.prototype.parse = function (grammar, params, view) {
    var empty = createEmptySlots(this.getWidth(), view);
    var next = empty.parseAndMerge(grammar, params, this.zoo_pred).group();

    return (next.failed() ? empty : next);
};

ZeroOrOne.prototype.getRegExStr = function (grammar) {
    var rs = this.zoo_pred.getRegExStr(grammar);
    if (rs === null) {
        return null;
    }
    return rs + '?';
};

function NegLookahead(pred) {
    this.nl_pred = pred;

    ParseExpression.call(this, 0);
}
mod_util.inherits(NegLookahead, ParseExpression);

NegLookahead.prototype.parse = function (grammar, params, view) {
    var result = this.nl_pred.parse(grammar, params, view);
    if (result.failed()) {
        return new ParseWideNode([], view);
    } else {
        return new ParseError('failed NegLookahead');
    }
};

function PosLookahead(pred) {
    this.pl_pred = pred;

    ParseExpression.call(this, pred.getWidth());
}
mod_util.inherits(PosLookahead, ParseExpression);

PosLookahead.prototype.parse = function (grammar, params, view) {
    var result = this.pl_pred.parse(grammar, params, view);
    if (result.failed()) {
        return new ParseError('failed PosLookahead');
    } else {
        // XXX: fix me
        result.pt_view = view;
        return result;
    }
};

function FormalsApply(name, idx) {
    this.fa_name = name;
    this.fa_idx = idx;

    ParseExpression.call(this, 1);
}
mod_util.inherits(FormalsApply, ParseExpression);

FormalsApply.prototype.parse = function (grammar, params, view) {
    if (params[this.fa_idx] === undefined) {
        throw new Error('missing parameter for ' +
            JSON.stringify(this.fa_name));
    }

    var result = params[this.fa_idx].parse(grammar, params, view);
    return result.explain(this).wrap();
};

FormalsApply.prototype.getErrorMsg = function () {
    return 'failed to apply ' + JSON.stringify(this.fa_name) +
        '(param #' + this.fa_idx + ')';
};

FormalsApply.prototype.substitute = function (params) {
    if (params[this.fa_idx] === undefined) {
        throw new Error('missing parameter for ' +
            JSON.stringify(this.fa_name));
    }

    return params[this.fa_idx];
};


function RuleApply(name, args) {
    this.ra_name = name;
    this.ra_args = args;

    ParseExpression.call(this, 1);
}
mod_util.inherits(RuleApply, ParseExpression);

RuleApply.prototype._subbed = function (params) {
    return this.ra_args.map(function (a) {
        return a.substitute(params);
    });
};

RuleApply.prototype.parse = function (grammar, params, view) {
    var result = grammar.apply(this.ra_name, this._subbed(params), view);

    return result.explain(this).wrap();
};

RuleApply.prototype.substitute = function (params) {
    return new RuleApply(this.ra_name, this._subbed(params));
};

RuleApply.prototype.getErrorMsg = function () {
    return 'failed to apply ' + JSON.stringify(this.ra_name);
};

RuleApply.prototype.getRegExStr = function (grammar) {
    return grammar.getRule(this.ra_name).getRegExStr(grammar);
};


function Alternative(choices) {
    this.alt_choices = choices;

    // XXX: This isn't quite right. It should be the first non-named sequence.
    ParseExpression.call(this, choices[0].getWidth());
}
mod_util.inherits(Alternative, ParseExpression);

Alternative.prototype.parse = function (grammar, params, view) {
    for (var i = 0; i < this.alt_choices.length; ++i) {
        var result = this.alt_choices[i].parse(grammar, params, view);
        if (!result.failed()) {
            return result;
        }
    }

    return new ParseError('failed alternative');
};

Alternative.prototype.substitute = function (params) {
    return new Alternative(this.alt_choices.map(function (a) {
        return a.substitute(params);
    }));
};

Alternative.prototype.getRegExStr = function (grammar) {
    var parts = new Array(this.alt_choices.length);

    for (var i = 0; i < this.alt_choices.length; ++i) {
        var rs = this.alt_choices[i].getRegExStr(grammar);
        if (rs === null) {
            return null;
        }
        parts[i] = rs;
    }

    return ('(?:' + parts.join('|') + ')');
};

function Sequence(parts) {
    this.seq_parts = parts;

    var width = 0;
    for (var i = 0; i < parts.length; ++i) {
        width += parts[i].getWidth();
    }
    ParseExpression.call(this, width);
}
mod_util.inherits(Sequence, ParseExpression);

Sequence.prototype.parse = function (grammar, params, view) {
    var result = new ParseWideNode([], view);

    for (var i = 0; i < this.seq_parts.length; ++i) {
        result = result.parseAndConcat(grammar, params, this.seq_parts[i]);
    }

    return result;
};

Sequence.prototype.substitute = function (params) {
    return new Sequence(this.seq_parts.map(function (a) {
        return a.substitute(params);
    }));
};

Sequence.prototype.getRegExStr = function (grammar) {
    var parts = new Array(this.seq_parts.length);

    for (var i = 0; i < this.seq_parts.length; ++i) {
        var rs = this.seq_parts[i].getRegExStr(grammar);
        if (rs === null) {
            return null;
        }
        parts[i] = rs;
    }

    return ('(?:' + parts.join('') + ')');
};

function NamedSequence(name, body) {
    this.nseq_name = name;
    this.nseq_body = body;

    ParseExpression.call(this, body.getWidth());
}
mod_util.inherits(NamedSequence, ParseExpression);

NamedSequence.prototype.parse = function (grammar, params, view) {
    var result = this.nseq_body.parse(grammar, params, view);

    return result.setInlineName(this.nseq_name);
};

NamedSequence.prototype.getRegExStr = function (grammar) {
    return this.nseq_body.getRegExStr(grammar);
};

// Basic terminal expressions

function Range(from, to) {
    var ef = escapeRegExp(from);
    var et = escapeRegExp(to);

    this.rng_from = from;
    this.rng_to = to;

    this.rng_restr = '[' + ef + '-' + et + ']';
    this.rng_repat = new RegExp('^' + this.rng_restr);

    ParseExpression.call(this, 1);
}
mod_util.inherits(Range, ParseExpression);

Range.prototype.parse = function (_grammar, _params, view) {
    var m = this.rng_repat.exec(view.rest());
    if (m === null) {
        return new ParseError('expected a character in the range ' +
            JSON.stringify(this.rng_from) + '..' + JSON.stringify(this.rng_to));
    }
    var result = new ParseTerminal(m[0], view.range(m[0].length));
    return result.wrap();
};

Range.prototype.substitute = function (_) {
    return this;
};

Range.prototype.getRegExStr = function (_) {
    return this.rng_restr;
};

function Terminal(str) {
    this.term_str = str;
    this.term_restr = escapeRegExp(str);
    this.term_repat = new RegExp('^' + this.term_restr);

    ParseExpression.call(this, 1);
}
mod_util.inherits(Terminal, ParseExpression);

Terminal.prototype.parse = function (_grammar, _params, view) {
    if (!this.term_repat.test(view.rest())) {
        return new ParseError('expected ' + JSON.stringify(this.term_str));
    }
    var result = new ParseTerminal(this.term_str,
        view.range(this.term_str.length));

    return result.wrap();
};

Terminal.prototype.substitute = function (_) {
    return this;
};

Terminal.prototype.getRegExStr = function (_) {
    return this.term_restr;
};

function RegExPred(pattern) {
    this.rep_str = pattern;
    this.rep_pat = new RegExp('^' + pattern);
}
mod_util.inherits(RegExPred, ParseExpression);

RegExPred.prototype.parse = function (_grammar, _params, view) {
    var m = this.rep_pat.exec(view.rest());
    if (m === null) {
        return new ParseError('failed to match pattern ' +
            JSON.stringify(this.rep_str));
    }
    var result = new ParseTerminal(m[0], view.range(m[0].length));
    return result.wrap();
};

RegExPred.prototype.substitute = function (_) {
    return this;
};

RegExPred.prototype.getRegExStr = function (_) {
    return this.rep_str;
};


// -- Grammar and rules

var ALNUM_DESC = 'an alphanumeric character';
var ANY_DESC = 'any character';

var DEFAULT_RULES = [
    new Rule('alnum', [], ALNUM_DESC, new RegExPred('[a-zA-Z0-9]')),
    new Rule('nonlcurly', [], '', new RegExPred('[^{]')),
    new Rule('any', [], ANY_DESC, new RegExPred('[^]'))
];

function Grammar(name, rules) {
    assert.string(name, 'name');
    assert.arrayOfObject(rules, 'rules');

    var self = this;

    self.g_name = name;
    self.g_rules = {};
    self.g_default = rules[0].name();

    function addRule(rule) {
        self.g_rules[rule.name()] = rule;
    }

    DEFAULT_RULES.forEach(addRule);

    rules.forEach(addRule);

    this._buildRegExCaches();
}

var currentRuleName, currentRuleFormals;

Grammar.prototype.getRule = function (name) {
    if (!mod_jsprim.hasKey(this.g_rules, name)) {
        throw new Error('unknown rule: ' + JSON.stringify(name));
    }

    return this.g_rules[name];
};

Grammar.prototype.parse = function (str) {
    var result = this.apply(this.g_default, [], new InputView(str, 0, 0));
    if (result.hasMore()) {
        return new ParseError('failed to parse remaining ' +
            JSON.stringify(result.pt_view.rest()));
    }
    return result;
};

Grammar.prototype.apply = function (name, params, view) {
    return this.getRule(name).parse(this, params, view.next());
};

Grammar.prototype._buildRegExCaches = function () {
    var names = Object.keys(this.g_rules);
    var rules = new Array(names.length);
    var restr = new Array(names.length);
    var keepGoing, i, ns;

    for (i = 0; i < rules.length; ++i) {
        rules[i] = this.g_rules[names[i]];
    }

    for (i = 0; i < rules.length; ++i) {
        restr[i] = rules[i].getRegExStr(this);
    }

    do {
        keepGoing = false;

        for (i = 0; i < rules.length; ++i) {
            ns = rules[i].getRegExStr(this);
            keepGoing = keepGoing || restr[i] !== ns;
            restr[i] = ns;
        }
    } while (keepGoing);
};

function Rule(name, formals, desc, body) {
    assert.string(name, 'name');
    assert.array(formals, 'formals');
    assert.string(desc, 'desc');
    assert.object(body, 'body');

    this.r_name = name;
    this.r_formals = formals;
    this.r_desc = desc;
    this.r_body = body;

    this.r_reproc = false;
    this.r_restr = null;
    this.r_repat = null;
}

Rule.prototype.name = function () {
    return this.r_name;
};

Rule.prototype.parse = function (grammar, params, view) {
    if (params.length !== this.r_formals.length) {
        throw new Error('expected ' + this.r_formals.length +
            ' parameters, but got ' + params.length);
    }

    if (this.r_repat !== null) {
        var m = this.r_repat.exec(view.rest());
        if (m === null) {
            return new ParseError(this.getErrorMsg());
        } else {
            return new ParseLazyNode(grammar, params, this.r_body,
                view, m[0].length, this.r_name, null);
        }
    }

    var result = this.r_body.parse(grammar, params, view);

    return result.explain(this).setRuleName(this.r_name);
};

Rule.prototype.getErrorMsg = function () {
    return 'expected to find ' + this.r_name;
};

Rule.prototype.getRegExStr = function (grammar) {
    var rs = this.r_restr;

    if (rs !== null || this.r_reproc) {
        /*
         * If we've already calculated the RegEx string,
         * or if we've started to recur, return now.
         */
        return rs;
    }

    this.r_reproc = true;
    rs = this.r_body.getRegExStr(grammar);
    this.r_reproc = false;

    if (rs === null) {
        return null;
    }

    this.r_restr = rs;
    this.r_repat = new RegExp('^' + rs);

    return rs;
};

var ohmSemantics = mod_ohm.ohmGrammar.createSemantics();
var compileSemantics = ohmSemantics.addOperation('__compile', {
    Grammar: function (n, _s, _lc, rs, _rc) {
        return new Grammar(n.__compile(), rs.__compile());
    },

    SuperGrammar: function (_, _n) {
        throw new Error('not yet implemented');
    },

    Rule_define: function (n, fs, d, _, b) {
        currentRuleName = n.__compile();
        currentRuleFormals = fs.__compile()[0] || [];
        var desc = d.__compile()[0] || '';
        var body = b.__compile();

        return new Rule(currentRuleName, currentRuleFormals, desc, body);
    },
    Rule_override: function (n, fs, _, b) {
        currentRuleName = n.__compile();
        currentRuleFormals = fs.__compile()[0] || [];
        var body = b.__compile();

        return new Rule(currentRuleName, currentRuleFormals, '', body);
    },
    Rule_extend: function (_n, _fs, _, _b) {
        throw new Error('not yet implemented');
    },
    RuleBody: function (_, terms) {
        var choices = terms.__compile();

        if (choices.length === 1) {
            return choices[0];
        }

        return new Alternative(choices);
    },

    Formals: function (_lt, fs, _gt) {
        return fs.__compile();
    },

    Params: function (_lt, ps, _gt) {
        return ps.__compile();
    },

    Alt: function (seqs) {
        return new Alternative(seqs.__compile());
    },

    TopLevelTerm_inline: function (b, n) {
        return new NamedSequence(n.__compile(), b.__compile());
    },

    Seq: function (expr) {
        return new Sequence(expr.__compile());
    },

    Iter_star: function (x, _) {
        return new ZeroOrMore(x.__compile());
    },
    Iter_plus: function (x, _) {
        return new OneOrMore(x.__compile());
    },
    Iter_opt: function (x, _) {
        return new ZeroOrOne(x.__compile());
    },

    Pred_not: function (_, x) {
        return new NegLookahead(x.__compile());
    },
    Pred_lookahead: function (_, x) {
        return new PosLookahead(x.__compile());
    },

    Lex_lex: function (_, _x) {
        throw new Error('not yet implemented');
    },

    Base_application: function (rule, ps) {
        var name = rule.__compile();
        var args = ps.__compile()[0] || [];
        var fIdx = currentRuleFormals.indexOf(name);

        if (fIdx === -1) {
            return new RuleApply(name, args);
        } else {
            return new FormalsApply(name, fIdx);
        }
    },
    Base_range: function (from, _, to) {
        return new Range(from.__compile(), to.__compile());
    },
    Base_terminal: function (expr) {
        return new Terminal(expr.__compile());
    },
    Base_paren: function (_lp, x, _rp) {
        return x.__compile();
    },

    ruleDescr: function (_lp, t, _rp) {
        return t.__compile();
    },
    ruleDescrText: function (_) {
        return this.sourceString.trim();
    },

    caseName: function (_dash, _sp1, n, _sp2, _end) {
        return n.__compile();
    },

    name: function (_first, _rest) {
        return this.sourceString;
    },
    nameFirst: function (_expr) {},
    nameRest: function (_expr) {},

    terminal: function (_ldq, cs, _rdq) {
        return cs.__compile().join('');
    },

    oneCharTerminal: function (_ldq, c, _rdq) {
        return c.__compile();
    },

    terminalChar: function (_) {
        return unescapeChar(this.sourceString);
    },

    escapeChar: function (_) {
        return this.sourceString;
    },

    NonemptyListOf: function (x, _, xs) {
        return [x.__compile()].concat(xs.__compile());
    },
    EmptyListOf: function () {
        return [];
    },

    _terminal: function () {
        return this.primitiveValue;
    }

});



var jiraGrammar = mod_ohm.ohmGrammar.match(source);
var matcher = compileSemantics(jiraGrammar).__compile()[0];

function parseJIRA(str) {
    return matcher.parse(str);
}

module.exports = {
    parseJIRA: parseJIRA
};
