import { createToken, Lexer } from 'chevrotain';

// Inspired by the Tree Sitter DSL: https://tree-sitter.github.io/tree-sitter/creating-parsers#defining-tokens
export const seq = (...patterns) => new RegExp(patterns.map(p => p.source || p).join(''));
export const choice = (...patterns) => new RegExp(`(${patterns.map(p => p.source || p).join('|')})`);
export const repeat = (...patterns) => new RegExp(`(${patterns.map(p => p.source || p).join('')})*`);
export const repeat1 = (...patterns) => new RegExp(`(${patterns.map(p => p.source || p).join('')})+`);
export const optional = (...patterns) => new RegExp(`(${patterns.map(p => p.source || p).join('')})?`);

const _COMMENT = /#[^\n\r]*/;

const _WS = repeat1(/[\s\t\r\n]/);

const _TRUE = /true/;

const _FALSE = /false/;

const _PERIOD = /\./;

const _SEMICOLON = /\;/;

const _COMMA = /\,/;

const _DCARET = /\^\^/;

const _LBRACKET = /\[/;

const _RBRACKET = /\]/;

const _LPARENT = /\(/;

const _RPARENT = /\)/;

const _LCURLY = /\{/;

const _RCURLY = /\}/;

const _PREFIX = /@prefix/;

const _BASE = /@base/;

const _SPARQL_PREFIX = /PREFIX/i;

const _SPARQL_BASE = /BASE/i;

const _GRAPH = /GRAPH/i;

const _A = /a/;

const _EXPONENT = /[eE][+-]?\d+/;

const _INTEGER = /[+-]?(\d+)/;

const _DECIMAL = /[+-]?(\d*\.\d+)/;

const _DOUBLE = choice(
    seq(/[+-]?(\d+\.\d*)/, _EXPONENT),
    seq(/[+-]?(\.\d+)/, _EXPONENT),
    seq(/[+-]?(\d+)/, _EXPONENT)
);

const _LANGTAG = /@[a-zA-Z]+(-[a-zA-Z0-9]+)*/;

const _HEX = /[0-9A-Fa-f]/;

const _ECHAR = /\\[tbnrf"'\\]/;

const _UCHAR = choice(
    seq(/\\u/, _HEX, _HEX, _HEX, _HEX),
    seq(/\\U/, _HEX, _HEX, _HEX, _HEX, _HEX, _HEX, _HEX, _HEX)
);

const _PERCENT = seq(/%/, _HEX, _HEX);

const _PN_CHARS_BASE = choice(
    /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/,
    /[\uD800-\uDBFF]/,
    /[\uDC00-\uDFFF]/
);

const _PN_CHARS_U = choice(_PN_CHARS_BASE, /_/);

const _PN_CHARS = choice(
    _PN_CHARS_U,
    /-/,
    /\d/,
    /\u00b7/,
    /[\u0300-\u036f]/,
    /[\u203f-\u2040]/
);

const _PN_LOCAL_ESC = /\\[_~.\-!\$&'()*+,=\/?#@%;]/;

const _PLX = choice(_PERCENT, _PN_LOCAL_ESC);

const _PN_LOCAL = seq(
    choice(_PN_CHARS_U, /\:/, /\d/, _PLX),
    optional(
        seq(
            repeat(choice(_PN_CHARS, /\./, /\:/, _PLX)),
            choice(_PN_CHARS, /\:/, _PLX)
        )
    )
);

const _PN_PREFIX = seq(
    _PN_CHARS_BASE,
    optional(seq(repeat(choice(_PN_CHARS, /\./)), _PN_CHARS))
);

const _PNAME_NS = seq(optional(_PN_PREFIX), /\:/);

const _PNAME_LN = seq(_PNAME_NS, _PN_LOCAL);

const _ANON = seq(_LBRACKET, repeat(_WS), _RBRACKET);

const _BLANK_NODE_LABEL = seq(
    /_:/,
    choice(_PN_CHARS_U, /\d/),
    optional(seq(repeat(choice(_PN_CHARS, /\./)), _PN_CHARS))
);

// https://www.w3.org/TR/turtle/#grammar-production-IRIREF
// Note: Added the ':' to not match relative IRIs. These are not allowed in N-Triples.
const _IRIREF_ABS = seq(
    /<[a-zA-Z0-9_\-]+:/,
    repeat(choice(/[^\u0000-\u0020<>\"{}|\^`\\]/, _UCHAR)),
    />/
);

// https://www.w3.org/TR/turtle/#grammar-production-IRIREF
const _IRIREF = seq(
    /</,
    repeat(choice(/[^\u0000-\u0020<>\"{}|\^`\\]/, _UCHAR)),
    />/
);

// https://www.w3.org/TR/turtle/#grammar-production-STRING_LITERAL_SINGLE_QUOTE
const _STRING_LITERAL_SINGLE_QUOTE = seq(
    /'/,
    repeat(choice(/[^'\\\n\r]/, _ECHAR, _UCHAR)),
    /'/
);

// https://www.w3.org/TR/turtle/#grammar-production-STRING_LITERAL_QUOTE
const _STRING_LITERAL_QUOTE = seq(
    /"/,
    repeat(choice(/[^"\\\n\r]/, _ECHAR, _UCHAR)),
    /"/
);

// https://www.w3.org/TR/turtle/#grammar-production-STRING_LITERAL_LONG_SINGLE_QUOTE
const _STRING_LITERAL_LONG_SINGLE_QUOTE = seq(
    /'''/,
    repeat(seq(
        optional(choice(/'/, /''/)),
        choice(/[^'\\]/, _ECHAR, _UCHAR)
    )),
    /'''/
);

// https://www.w3.org/TR/turtle/#grammar-production-STRING_LITERAL_LONG_QUOTE
const _STRING_LITERAL_LONG_QUOTE = seq(
    /"""/,
    repeat(seq(
        optional(choice(/"/, /""/)),
        choice(/[^"\\]/, _ECHAR, _UCHAR)
    )),
    /"""/
);

const _VARNAME = seq(
    choice(_PN_CHARS_U, /\d/),
    repeat(choice(_PN_CHARS_U, /\d/, /\u00b7/, /[\u0300-\u036f]/, /[\u203f-\u2040]/))
)

const _VAR1 = seq(/\?/, _VARNAME);

const _VAR2 = seq(/\$/, _VARNAME);

/**
 * Common tokens for W3C RDF syntaxes such as N-Triples, N-Quads, Turtle, TriG and SPARQL.
 */
export const tokens = {
    A: createToken({ name: 'A', label: 'a', pattern: _A }),
    ANON: createToken({ name: 'ANON', pattern: _ANON }),
    BASE: createToken({ name: 'BASE', label: '@base', pattern: _BASE }),
    BLANK_NODE_LABEL: createToken({ name: 'BLANK_NODE_LABEL', pattern: _BLANK_NODE_LABEL }),
    COMMA: createToken({ name: ',', pattern: _COMMA }),
    COMMENT: createToken({ name: 'COMMENT', pattern: _COMMENT, group: 'comments' }),
    DCARET: createToken({ name: 'DCARET', label: '^^', pattern: _DCARET }),
    DECIMAL: createToken({ name: 'DECIMAL', pattern: _DECIMAL }),
    PERIOD: createToken({ name: 'PERIOD', label: '.', pattern: _PERIOD }),
    DOUBLE: createToken({ name: 'DOUBLE', pattern: _DOUBLE }),
    FALSE: createToken({ name: 'false', pattern: _FALSE }),
    GRAPH: createToken({ name: 'GRAPH', pattern: _GRAPH }),
    INTEGER: createToken({ name: 'INTEGER', pattern: _INTEGER }),
    IRIREF_ABS: createToken({ name: 'IRIREF_ABS', pattern: _IRIREF_ABS }),
    IRIREF: createToken({ name: 'IRIREF', pattern: _IRIREF }),
    LANGTAG: createToken({ name: 'LANGTAG', pattern: _LANGTAG }),
    LBRACKET: createToken({ name: 'LBRACKET', label: '[', pattern: _LBRACKET }),
    LCURLY: createToken({ name: 'LCURLY', label: '{', pattern: _LCURLY }),
    LPARENT: createToken({ name: 'LPARENT', label: '(', pattern: _LPARENT }),
    PNAME_LN: createToken({ name: 'PNAME_LN', pattern: _PNAME_LN }),
    PNAME_NS: createToken({ name: 'PNAME_NS', pattern: _PNAME_NS }),
    PREFIX: createToken({ name: 'PREFIX', label: '@prefix', pattern: _PREFIX }),
    RBRACKET: createToken({ name: 'RBRACKET', label: ']', pattern: _RBRACKET }),
    RCURLY: createToken({ name: 'RCURLY', label: '}', pattern: _RCURLY }),
    RPARENT: createToken({ name: 'RPARENT', label: ')', pattern: _RPARENT }),
    SEMICOLON: createToken({ name: 'SEMICOLON', label: ';', pattern: _SEMICOLON }),
    SPARQL_BASE: createToken({ name: 'BASE', pattern: _SPARQL_BASE }),
    SPARQL_PREFIX: createToken({ name: 'PREFIX', pattern: _SPARQL_PREFIX }),
    STRING_LITERAL_LONG_QUOTE: createToken({ name: 'STRING_LITERAL_LONG_QUOTE', pattern: _STRING_LITERAL_LONG_QUOTE }),
    STRING_LITERAL_LONG_SINGLE_QUOTE: createToken({ name: 'STRING_LITERAL_LONG_SINGLE_QUOTE', pattern: _STRING_LITERAL_LONG_SINGLE_QUOTE }),
    STRING_LITERAL_QUOTE: createToken({ name: 'STRING_LITERAL_QUOTE', pattern: _STRING_LITERAL_QUOTE }),
    STRING_LITERAL_SINGLE_QUOTE: createToken({ name: 'STRING_LITERAL_SINGLE_QUOTE', pattern: _STRING_LITERAL_SINGLE_QUOTE }),
    TRUE: createToken({ name: 'true', pattern: _TRUE }),
    VAR1: createToken({ name: 'VAR1', pattern: _VAR1, }),
    VAR2: createToken({ name: 'VAR2', pattern: _VAR2, }),
    WS: createToken({ name: 'WS', pattern: _WS, group: Lexer.SKIPPED })
}