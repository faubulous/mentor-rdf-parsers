import { createToken, Lexer, ITokenConfig, TokenType } from 'chevrotain';
import { TOKEN_METADATA, TokenMetadata } from './token-metadata.js';

type PatternInput = RegExp | string;

/**
 * Creates a token with metadata preserved.
 * Chevrotain's createToken strips unknown properties, so we assign them after creation.
 * @param config The token configuration
 * @param metadata The metadata to attach to the token
 * @returns The token type with metadata attached
 */
function createTokenWithMetadata(config: ITokenConfig, metadata?: TokenMetadata): TokenType {
    const token = createToken(config);
    if (metadata) {
        Object.assign(token, metadata);
    }
    return token;
}

// Inspired by the Tree Sitter DSL: https://tree-sitter.github.io/tree-sitter/creating-parsers#defining-tokens
export const seq = (...patterns: PatternInput[]): RegExp => new RegExp(patterns.map(p => (p as RegExp).source || p).join(''));
export const choice = (...patterns: PatternInput[]): RegExp => new RegExp(`(${patterns.map(p => (p as RegExp).source || p).join('|')})`);
export const repeat = (...patterns: PatternInput[]): RegExp => new RegExp(`(${patterns.map(p => (p as RegExp).source || p).join('')})*`);
export const repeat1 = (...patterns: PatternInput[]): RegExp => new RegExp(`(${patterns.map(p => (p as RegExp).source || p).join('')})+`);
export const optional = (...patterns: PatternInput[]): RegExp => new RegExp(`(${patterns.map(p => (p as RegExp).source || p).join('')})?`);

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

const _OPEN_ANNOTATION = /\{\|/;

const _CLOSE_ANNOTATION = /\|\}/;

const _TILDE = /~/;

const _OPEN_TRIPLE_TERM = /<<\(/;

const _CLOSE_TRIPLE_TERM = /\)>>/;

const _OPEN_REIFIED_TRIPLE = /<</;

const _CLOSE_REIFIED_TRIPLE = />>/;

const _PREFIX = /@prefix/;

const _BASE = /@base/;

const _VERSION = /@version/;

const _SPARQL_PREFIX = /PREFIX\b/i;

const _SPARQL_BASE = /BASE\b/i;

const _SPARQL_VERSION = /VERSION\b/i;

const _GRAPH = /GRAPH\b/i;

// The 'a' keyword (rdf:type shorthand) must not be followed by a colon
// or any character that could continue a prefix name (letters, digits, underscore),
// otherwise it would be a prefix like 'a:localname' or 'abc:'
const _A = /a(?![A-Za-z0-9_:])/;

const _EXPONENT = /[eE][+-]?\d+/;

const _INTEGER = /[+-]?(\d+)/;

const _DECIMAL = /[+-]?(\d*\.\d+)/;

const _DOUBLE = choice(
    seq(/[+-]?(\d+\.\d*)/, _EXPONENT),
    seq(/[+-]?(\.\d+)/, _EXPONENT),
    seq(/[+-]?(\d+)/, _EXPONENT)
);

const _LANGTAG = /@[a-zA-Z]+(-[a-zA-Z0-9]+)*(--(ltr|rtl))?/;

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
);

const _VAR1 = seq(/\?/, _VARNAME);

const _VAR2 = seq(/\$/, _VARNAME);

// N3-specific token patterns
const _QUICK_VAR = seq(/\?/, choice(_PN_CHARS_U, /\d/), repeat(_PN_CHARS));

const _IMPLIES = /=>/;

const _IMPLIED_BY = /<=/;

const _EQUALS_SIGN = /=/;

const _INVERSE_OF = /<-/;

const _EXCL = /!/;

const _CARET = /\^/;

const _FORALL = /@forAll/;

const _FORSOME = /@forSome/;

const _HAS = /has\b/;

const _IS = /is\b/;

const _OF = /of\b/;

// SPARQL-specific token patterns
const _STAR = /\*/;

const _SLASH = /\//;

const _PIPE = /\|/;

const _PLUS_SIGN = /\+/;

const _MINUS_SIGN = /-/;

const _QUESTION_MARK = /\?/;

const _BANG = /!/;

const _INTEGER_POSITIVE = seq(/\+/, /\d+/);

const _DECIMAL_POSITIVE = seq(/\+/, /\d*\.\d+/);

const _DOUBLE_POSITIVE = choice(
    seq(/\+\d+\.\d*/, _EXPONENT),
    seq(/\+\.\d+/, _EXPONENT),
    seq(/\+\d+/, _EXPONENT)
);

const _INTEGER_NEGATIVE = seq(/-/, /\d+/);

const _DECIMAL_NEGATIVE = seq(/-/, /\d*\.\d+/);

const _DOUBLE_NEGATIVE = choice(
    seq(/-\d+\.\d*/, _EXPONENT),
    seq(/-\.\d+/, _EXPONENT),
    seq(/-\d+/, _EXPONENT)
);

const _NIL = seq(/\(/, repeat(/[\s\t\r\n]/), /\)/);

// SPARQL keywords (case-insensitive, word-bounded)
const _SELECT = /SELECT\b/i;
const _CONSTRUCT = /CONSTRUCT\b/i;
const _DESCRIBE = /DESCRIBE\b/i;
const _ASK = /ASK\b/i;
const _WHERE = /WHERE\b/i;
const _FROM = /FROM\b/i;
const _NAMED = /NAMED\b/i;
const _ORDER = /ORDER\b/i;
const _BY = /BY\b/i;
const _ASC = /ASC\b/i;
const _DESC = /DESC\b/i;
const _LIMIT = /LIMIT\b/i;
const _OFFSET = /OFFSET\b/i;
const _DISTINCT = /DISTINCT\b/i;
const _REDUCED = /REDUCED\b/i;
const _OPTIONAL = /OPTIONAL\b/i;
const _UNION = /UNION\b/i;
const _FILTER = /FILTER\b/i;
const _BIND = /BIND\b/i;
const _VALUES = /VALUES\b/i;
const _AS = /AS\b/i;
const _GROUP = /GROUP\b/i;
const _HAVING = /HAVING\b/i;
const _SERVICE = /SERVICE\b/i;
const _SILENT = /SILENT\b/i;
const _MINUS_KW = /MINUS\b/i;
const _UNDEF = /UNDEF\b/i;
const _IN = /IN\b/i;
const _NOT = /NOT\b/i;
const _EXISTS = /EXISTS\b/i;

// SPARQL Update keywords
const _INSERT = /INSERT\b/i;
const _DELETE = /DELETE\b/i;
const _DATA = /DATA\b/i;
const _LOAD = /LOAD\b/i;
const _CLEAR = /CLEAR\b/i;
const _DROP = /DROP\b/i;
const _CREATE = /CREATE\b/i;
const _ADD = /ADD\b/i;
const _MOVE = /MOVE\b/i;
const _COPY = /COPY\b/i;
const _INTO = /INTO\b/i;
const _TO = /TO\b/i;
const _USING = /USING\b/i;
const _WITH = /WITH\b/i;
const _DEFAULT = /DEFAULT\b/i;
const _ALL = /ALL\b/i;

// SPARQL Aggregate keywords
const _COUNT = /COUNT\b/i;
const _SUM = /SUM\b/i;
const _MIN = /MIN\b/i;
const _MAX = /MAX\b/i;
const _AVG = /AVG\b/i;
const _SAMPLE = /SAMPLE\b/i;
const _GROUP_CONCAT = /GROUP_CONCAT\b/i;
const _SEPARATOR = /SEPARATOR\b/i;

// SPARQL Built-in function keywords
const _STR = /STR\b/i;
const _LANG = /LANG\b/i;
const _LANGMATCHES = /LANGMATCHES\b/i;
const _LANGDIR = /LANGDIR\b/i;
const _DATATYPE = /DATATYPE\b/i;
const _BOUND = /BOUND\b/i;
const _IRI_KW = /IRI\b/i;
const _URI_KW = /URI\b/i;
const _BNODE_KW = /BNODE\b/i;
const _RAND = /RAND\b/i;
const _ABS = /ABS\b/i;
const _CEIL = /CEIL\b/i;
const _FLOOR = /FLOOR\b/i;
const _ROUND = /ROUND\b/i;
const _CONCAT = /CONCAT\b/i;
const _STRLEN = /STRLEN\b/i;
const _UCASE = /UCASE\b/i;
const _LCASE = /LCASE\b/i;
const _ENCODE_FOR_URI = /ENCODE_FOR_URI\b/i;
const _CONTAINS = /CONTAINS\b/i;
const _STRSTARTS = /STRSTARTS\b/i;
const _STRENDS = /STRENDS\b/i;
const _STRBEFORE = /STRBEFORE\b/i;
const _STRAFTER = /STRAFTER\b/i;
const _YEAR = /YEAR\b/i;
const _MONTH = /MONTH\b/i;
const _DAY = /DAY\b/i;
const _HOURS = /HOURS\b/i;
const _MINUTES = /MINUTES\b/i;
const _SECONDS = /SECONDS\b/i;
const _TIMEZONE = /TIMEZONE\b/i;
const _TZ = /TZ\b/i;
const _NOW = /NOW\b/i;
const _UUID = /UUID\b/i;
const _STRUUID = /STRUUID\b/i;
const _MD5 = /MD5\b/i;
const _SHA1 = /SHA1\b/i;
const _SHA256 = /SHA256\b/i;
const _SHA384 = /SHA384\b/i;
const _SHA512 = /SHA512\b/i;
const _COALESCE = /COALESCE\b/i;
const _IF = /IF\b/i;
const _STRLANG = /STRLANG\b/i;
const _STRLANGDIR = /STRLANGDIR\b/i;
const _STRDT = /STRDT\b/i;
const _SAMETERM = /sameTerm\b/i;
const _ISIRI = /isIRI\b/i;
const _ISURI = /isURI\b/i;
const _ISBLANK = /isBLANK\b/i;
const _ISLITERAL = /isLITERAL\b/i;
const _ISNUMERIC = /isNUMERIC\b/i;
const _REGEX = /REGEX\b/i;
const _SUBSTR = /SUBSTR\b/i;
const _REPLACE = /REPLACE\b/i;
const _ISTRIPLE = /isTRIPLE\b/i;
const _TRIPLE = /TRIPLE\b/i;
const _SUBJECT = /SUBJECT\b/i;
const _PREDICATE = /PREDICATE\b/i;
const _OBJECT = /OBJECT\b/i;
const _HASLANG = /hasLANG\b/i;
const _HASLANGDIR = /hasLANGDIR\b/i;

// SPARQL logical/comparison operators
const _AND = /&&/;
const _OR = /\|\|/;
const _EQ = /=/;
const _NEQ = /!=/;
const _LT = /</;
const _GT = />/;
const _LTE = /<=/;
const _GTE = />=/;

/**
 * Common tokens for W3C RDF syntaxes such as N-Triples, N-Quads, Turtle, TriG and SPARQL.
 */
export const RdfToken = {
    A: createTokenWithMetadata({ name: 'A', label: 'a', pattern: _A }, TOKEN_METADATA.A),
    ANON: createTokenWithMetadata({ name: 'ANON', pattern: _ANON }, TOKEN_METADATA.ANON),
    TTL_BASE: createTokenWithMetadata({ name: 'BASE', label: '@base', pattern: _BASE }, TOKEN_METADATA.TTL_BASE),
    BLANK_NODE_LABEL: createTokenWithMetadata({ name: 'BLANK_NODE_LABEL', pattern: _BLANK_NODE_LABEL }, TOKEN_METADATA.BLANK_NODE_LABEL),
    CLOSE_ANNOTATION: createTokenWithMetadata({ name: 'CLOSE_ANNOTATION', label: '|}', pattern: _CLOSE_ANNOTATION }, TOKEN_METADATA.CLOSE_ANNOTATION),
    CLOSE_REIFIED_TRIPLE: createTokenWithMetadata({ name: 'CLOSE_REIFIED_TRIPLE', label: '>>', pattern: _CLOSE_REIFIED_TRIPLE }, TOKEN_METADATA.CLOSE_REIFIED_TRIPLE),
    CLOSE_TRIPLE_TERM: createTokenWithMetadata({ name: 'CLOSE_TRIPLE_TERM', label: ')>>', pattern: _CLOSE_TRIPLE_TERM }, TOKEN_METADATA.CLOSE_TRIPLE_TERM),
    COMMA: createTokenWithMetadata({ name: ',', pattern: _COMMA }, TOKEN_METADATA.COMMA),
    COMMENT: createTokenWithMetadata({ name: 'COMMENT', pattern: _COMMENT }, TOKEN_METADATA.COMMENT),
    DCARET: createTokenWithMetadata({ name: 'DCARET', label: '^^', pattern: _DCARET }, TOKEN_METADATA.DCARET),
    DECIMAL: createTokenWithMetadata({ name: 'DECIMAL', pattern: _DECIMAL }, TOKEN_METADATA.DECIMAL),
    PERIOD: createTokenWithMetadata({ name: 'PERIOD', label: '.', pattern: _PERIOD }, TOKEN_METADATA.PERIOD),
    DOUBLE: createTokenWithMetadata({ name: 'DOUBLE', pattern: _DOUBLE }, TOKEN_METADATA.DOUBLE),
    FALSE: createTokenWithMetadata({ name: 'false', pattern: _FALSE }, TOKEN_METADATA.FALSE),
    GRAPH: createTokenWithMetadata({ name: 'GRAPH', pattern: _GRAPH }, TOKEN_METADATA.GRAPH),
    INTEGER: createTokenWithMetadata({ name: 'INTEGER', pattern: _INTEGER }, TOKEN_METADATA.INTEGER),
    IRIREF_ABS: createTokenWithMetadata({ name: 'IRIREF_ABS', pattern: _IRIREF_ABS }, TOKEN_METADATA.IRIREF_ABS),
    IRIREF: createTokenWithMetadata({ name: 'IRIREF', pattern: _IRIREF }, TOKEN_METADATA.IRIREF),
    LANGTAG: createTokenWithMetadata({ name: 'LANGTAG', pattern: _LANGTAG }, TOKEN_METADATA.LANGTAG),
    LBRACKET: createTokenWithMetadata({ name: 'LBRACKET', label: '[', pattern: _LBRACKET }, TOKEN_METADATA.LBRACKET),
    LCURLY: createTokenWithMetadata({ name: 'LCURLY', label: '{', pattern: _LCURLY }, TOKEN_METADATA.LCURLY),
    LPARENT: createTokenWithMetadata({ name: 'LPARENT', label: '(', pattern: _LPARENT }, TOKEN_METADATA.LPARENT),
    OPEN_ANNOTATION: createTokenWithMetadata({ name: 'OPEN_ANNOTATION', label: '{|', pattern: _OPEN_ANNOTATION }, TOKEN_METADATA.OPEN_ANNOTATION),
    OPEN_REIFIED_TRIPLE: createTokenWithMetadata({ name: 'OPEN_REIFIED_TRIPLE', label: '<<', pattern: _OPEN_REIFIED_TRIPLE }, TOKEN_METADATA.OPEN_REIFIED_TRIPLE),
    OPEN_TRIPLE_TERM: createTokenWithMetadata({ name: 'OPEN_TRIPLE_TERM', label: '<<(', pattern: _OPEN_TRIPLE_TERM }, TOKEN_METADATA.OPEN_TRIPLE_TERM),
    PNAME_LN: createTokenWithMetadata({ name: 'PNAME_LN', pattern: _PNAME_LN }, TOKEN_METADATA.PNAME_LN),
    PNAME_NS: createTokenWithMetadata({ name: 'PNAME_NS', pattern: _PNAME_NS }, TOKEN_METADATA.PNAME_NS),
    TTL_PREFIX: createTokenWithMetadata({ name: 'TTL_PREFIX', label: '@prefix', pattern: _PREFIX }, TOKEN_METADATA.TTL_PREFIX),
    RBRACKET: createTokenWithMetadata({ name: 'RBRACKET', label: ']', pattern: _RBRACKET }, TOKEN_METADATA.RBRACKET),
    RCURLY: createTokenWithMetadata({ name: 'RCURLY', label: '}', pattern: _RCURLY }, TOKEN_METADATA.RCURLY),
    RPARENT: createTokenWithMetadata({ name: 'RPARENT', label: ')', pattern: _RPARENT }, TOKEN_METADATA.RPARENT),
    SEMICOLON: createTokenWithMetadata({ name: 'SEMICOLON', label: ';', pattern: _SEMICOLON }, TOKEN_METADATA.SEMICOLON),
    BASE: createTokenWithMetadata({ name: 'BASE', pattern: _SPARQL_BASE }, TOKEN_METADATA.BASE),
    PREFIX: createTokenWithMetadata({ name: 'PREFIX', pattern: _SPARQL_PREFIX }, TOKEN_METADATA.PREFIX),
    SPARQL_VERSION: createTokenWithMetadata({ name: 'SPARQL_VERSION', pattern: _SPARQL_VERSION }, TOKEN_METADATA.SPARQL_VERSION),
    STRING_LITERAL_LONG_QUOTE: createTokenWithMetadata({ name: 'STRING_LITERAL_LONG_QUOTE', pattern: _STRING_LITERAL_LONG_QUOTE }, TOKEN_METADATA.STRING_LITERAL_LONG_QUOTE),
    STRING_LITERAL_LONG_SINGLE_QUOTE: createTokenWithMetadata({ name: 'STRING_LITERAL_LONG_SINGLE_QUOTE', pattern: _STRING_LITERAL_LONG_SINGLE_QUOTE }, TOKEN_METADATA.STRING_LITERAL_LONG_SINGLE_QUOTE),
    STRING_LITERAL_QUOTE: createTokenWithMetadata({ name: 'STRING_LITERAL_QUOTE', pattern: _STRING_LITERAL_QUOTE }, TOKEN_METADATA.STRING_LITERAL_QUOTE),
    STRING_LITERAL_SINGLE_QUOTE: createTokenWithMetadata({ name: 'STRING_LITERAL_SINGLE_QUOTE', pattern: _STRING_LITERAL_SINGLE_QUOTE }, TOKEN_METADATA.STRING_LITERAL_SINGLE_QUOTE),
    TILDE: createTokenWithMetadata({ name: 'TILDE', label: '~', pattern: _TILDE }, TOKEN_METADATA.TILDE),
    TRUE: createTokenWithMetadata({ name: 'true', pattern: _TRUE }, TOKEN_METADATA.TRUE),
    VAR1: createTokenWithMetadata({ name: 'VAR1', pattern: _VAR1 }, TOKEN_METADATA.VAR1),
    VAR2: createTokenWithMetadata({ name: 'VAR2', pattern: _VAR2 }, TOKEN_METADATA.VAR2),
    VERSION: createTokenWithMetadata({ name: 'VERSION', label: '@version', pattern: _VERSION }, TOKEN_METADATA.VERSION),
    WS: createTokenWithMetadata({ name: 'WS', pattern: _WS, group: Lexer.SKIPPED }, TOKEN_METADATA.WS),

    // N3-specific tokens
    QUICK_VAR: createTokenWithMetadata({ name: 'QUICK_VAR', pattern: _QUICK_VAR }, TOKEN_METADATA.QUICK_VAR),
    IMPLIES: createTokenWithMetadata({ name: 'IMPLIES', label: '=>', pattern: _IMPLIES }, TOKEN_METADATA.IMPLIES),
    IMPLIED_BY: createTokenWithMetadata({ name: 'IMPLIED_BY', label: '<=', pattern: _IMPLIED_BY }, TOKEN_METADATA.IMPLIED_BY),
    EQUALS_SIGN: createTokenWithMetadata({ name: 'EQUALS_SIGN', label: '=', pattern: _EQUALS_SIGN }, TOKEN_METADATA.EQUALS_SIGN),
    INVERSE_OF: createTokenWithMetadata({ name: 'INVERSE_OF', label: '<-', pattern: _INVERSE_OF }, TOKEN_METADATA.INVERSE_OF),
    EXCL: createTokenWithMetadata({ name: 'EXCL', label: '!', pattern: _EXCL }, TOKEN_METADATA.EXCL),
    CARET: createTokenWithMetadata({ name: 'CARET', label: '^', pattern: _CARET }, TOKEN_METADATA.CARET),
    FORALL: createTokenWithMetadata({ name: 'FORALL', label: '@forAll', pattern: _FORALL }, TOKEN_METADATA.FORALL),
    FORSOME: createTokenWithMetadata({ name: 'FORSOME', label: '@forSome', pattern: _FORSOME }, TOKEN_METADATA.FORSOME),
    HAS: createTokenWithMetadata({ name: 'HAS', label: 'has', pattern: _HAS }, TOKEN_METADATA.HAS),
    IS: createTokenWithMetadata({ name: 'IS', label: 'is', pattern: _IS }, TOKEN_METADATA.IS),
    OF: createTokenWithMetadata({ name: 'OF', label: 'of', pattern: _OF }, TOKEN_METADATA.OF),

    // SPARQL operator/punctuation tokens
    STAR: createTokenWithMetadata({ name: 'STAR', label: '*', pattern: _STAR }, TOKEN_METADATA.STAR),
    SLASH: createTokenWithMetadata({ name: 'SLASH', label: '/', pattern: _SLASH }, TOKEN_METADATA.SLASH),
    PIPE: createTokenWithMetadata({ name: 'PIPE', label: '|', pattern: _PIPE }, TOKEN_METADATA.PIPE),
    PLUS_SIGN: createTokenWithMetadata({ name: 'PLUS_SIGN', label: '+', pattern: _PLUS_SIGN }, TOKEN_METADATA.PLUS_SIGN),
    MINUS_SIGN: createTokenWithMetadata({ name: 'MINUS_SIGN', label: '-', pattern: _MINUS_SIGN }, TOKEN_METADATA.MINUS_SIGN),
    QUESTION_MARK: createTokenWithMetadata({ name: 'QUESTION_MARK', label: '?', pattern: _QUESTION_MARK }, TOKEN_METADATA.QUESTION_MARK),
    BANG: createTokenWithMetadata({ name: 'BANG', label: '!', pattern: _BANG }, TOKEN_METADATA.BANG),
    NIL: createTokenWithMetadata({ name: 'NIL', pattern: _NIL }, TOKEN_METADATA.NIL),
    INTEGER_POSITIVE: createTokenWithMetadata({ name: 'INTEGER_POSITIVE', pattern: _INTEGER_POSITIVE }, TOKEN_METADATA.INTEGER_POSITIVE),
    DECIMAL_POSITIVE: createTokenWithMetadata({ name: 'DECIMAL_POSITIVE', pattern: _DECIMAL_POSITIVE }, TOKEN_METADATA.DECIMAL_POSITIVE),
    DOUBLE_POSITIVE: createTokenWithMetadata({ name: 'DOUBLE_POSITIVE', pattern: _DOUBLE_POSITIVE }, TOKEN_METADATA.DOUBLE_POSITIVE),
    INTEGER_NEGATIVE: createTokenWithMetadata({ name: 'INTEGER_NEGATIVE', pattern: _INTEGER_NEGATIVE }, TOKEN_METADATA.INTEGER_NEGATIVE),
    DECIMAL_NEGATIVE: createTokenWithMetadata({ name: 'DECIMAL_NEGATIVE', pattern: _DECIMAL_NEGATIVE }, TOKEN_METADATA.DECIMAL_NEGATIVE),
    DOUBLE_NEGATIVE: createTokenWithMetadata({ name: 'DOUBLE_NEGATIVE', pattern: _DOUBLE_NEGATIVE }, TOKEN_METADATA.DOUBLE_NEGATIVE),
    AND: createTokenWithMetadata({ name: 'AND', label: '&&', pattern: _AND }, TOKEN_METADATA.AND),
    OR: createTokenWithMetadata({ name: 'OR', label: '||', pattern: _OR }, TOKEN_METADATA.OR),
    EQ: createTokenWithMetadata({ name: 'EQ', label: '=', pattern: _EQ }, TOKEN_METADATA.EQ),
    NEQ: createTokenWithMetadata({ name: 'NEQ', label: '!=', pattern: _NEQ }, TOKEN_METADATA.NEQ),
    LTE: createTokenWithMetadata({ name: 'LTE', label: '<=', pattern: _LTE }, TOKEN_METADATA.LTE),
    GTE: createTokenWithMetadata({ name: 'GTE', label: '>=', pattern: _GTE }, TOKEN_METADATA.GTE),
    LT: createTokenWithMetadata({ name: 'LT', label: '<', pattern: _LT }, TOKEN_METADATA.LT),
    GT: createTokenWithMetadata({ name: 'GT', label: '>', pattern: _GT }, TOKEN_METADATA.GT),

    // SPARQL keyword tokens
    SELECT: createTokenWithMetadata({ name: 'SELECT', pattern: _SELECT }, TOKEN_METADATA.SELECT),
    CONSTRUCT: createTokenWithMetadata({ name: 'CONSTRUCT', pattern: _CONSTRUCT }, TOKEN_METADATA.CONSTRUCT),
    DESCRIBE: createTokenWithMetadata({ name: 'DESCRIBE', pattern: _DESCRIBE }, TOKEN_METADATA.DESCRIBE),
    ASK: createTokenWithMetadata({ name: 'ASK', pattern: _ASK }, TOKEN_METADATA.ASK),
    WHERE: createTokenWithMetadata({ name: 'WHERE', pattern: _WHERE }, TOKEN_METADATA.WHERE),
    FROM: createTokenWithMetadata({ name: 'FROM', pattern: _FROM }, TOKEN_METADATA.FROM),
    NAMED: createTokenWithMetadata({ name: 'NAMED', pattern: _NAMED }, TOKEN_METADATA.NAMED),
    ORDER: createTokenWithMetadata({ name: 'ORDER', pattern: _ORDER }, TOKEN_METADATA.ORDER),
    BY: createTokenWithMetadata({ name: 'BY', pattern: _BY }, TOKEN_METADATA.BY),
    ASC_KW: createTokenWithMetadata({ name: 'ASC', pattern: _ASC }, TOKEN_METADATA.ASC_KW),
    DESC_KW: createTokenWithMetadata({ name: 'DESC', pattern: _DESC }, TOKEN_METADATA.DESC_KW),
    LIMIT: createTokenWithMetadata({ name: 'LIMIT', pattern: _LIMIT }, TOKEN_METADATA.LIMIT),
    OFFSET: createTokenWithMetadata({ name: 'OFFSET', pattern: _OFFSET }, TOKEN_METADATA.OFFSET),
    DISTINCT: createTokenWithMetadata({ name: 'DISTINCT', pattern: _DISTINCT }, TOKEN_METADATA.DISTINCT),
    REDUCED: createTokenWithMetadata({ name: 'REDUCED', pattern: _REDUCED }, TOKEN_METADATA.REDUCED),
    OPTIONAL_KW: createTokenWithMetadata({ name: 'OPTIONAL', pattern: _OPTIONAL }, TOKEN_METADATA.OPTIONAL_KW),
    UNION: createTokenWithMetadata({ name: 'UNION', pattern: _UNION }, TOKEN_METADATA.UNION),
    FILTER: createTokenWithMetadata({ name: 'FILTER', pattern: _FILTER }, TOKEN_METADATA.FILTER),
    BIND_KW: createTokenWithMetadata({ name: 'BIND', pattern: _BIND }, TOKEN_METADATA.BIND_KW),
    VALUES: createTokenWithMetadata({ name: 'VALUES', pattern: _VALUES }, TOKEN_METADATA.VALUES),
    AS_KW: createTokenWithMetadata({ name: 'AS', pattern: _AS }, TOKEN_METADATA.AS_KW),
    GROUP: createTokenWithMetadata({ name: 'GROUP', pattern: _GROUP }, TOKEN_METADATA.GROUP),
    HAVING: createTokenWithMetadata({ name: 'HAVING', pattern: _HAVING }, TOKEN_METADATA.HAVING),
    SERVICE: createTokenWithMetadata({ name: 'SERVICE', pattern: _SERVICE }, TOKEN_METADATA.SERVICE),
    SILENT: createTokenWithMetadata({ name: 'SILENT', pattern: _SILENT }, TOKEN_METADATA.SILENT),
    MINUS_KW: createTokenWithMetadata({ name: 'MINUS', pattern: _MINUS_KW }, TOKEN_METADATA.MINUS_KW),
    UNDEF: createTokenWithMetadata({ name: 'UNDEF', pattern: _UNDEF }, TOKEN_METADATA.UNDEF),
    IN_KW: createTokenWithMetadata({ name: 'IN', pattern: _IN }, TOKEN_METADATA.IN_KW),
    NOT: createTokenWithMetadata({ name: 'NOT', pattern: _NOT }, TOKEN_METADATA.NOT),
    EXISTS: createTokenWithMetadata({ name: 'EXISTS', pattern: _EXISTS }, TOKEN_METADATA.EXISTS),

    // SPARQL Update keywords
    INSERT: createTokenWithMetadata({ name: 'INSERT', pattern: _INSERT }, TOKEN_METADATA.INSERT),
    DELETE_KW: createTokenWithMetadata({ name: 'DELETE', pattern: _DELETE }, TOKEN_METADATA.DELETE_KW),
    DATA: createTokenWithMetadata({ name: 'DATA', pattern: _DATA }, TOKEN_METADATA.DATA),
    LOAD: createTokenWithMetadata({ name: 'LOAD', pattern: _LOAD }, TOKEN_METADATA.LOAD),
    CLEAR: createTokenWithMetadata({ name: 'CLEAR', pattern: _CLEAR }, TOKEN_METADATA.CLEAR),
    DROP: createTokenWithMetadata({ name: 'DROP', pattern: _DROP }, TOKEN_METADATA.DROP),
    CREATE_KW: createTokenWithMetadata({ name: 'CREATE', pattern: _CREATE }, TOKEN_METADATA.CREATE_KW),
    ADD_KW: createTokenWithMetadata({ name: 'ADD', pattern: _ADD }, TOKEN_METADATA.ADD_KW),
    MOVE: createTokenWithMetadata({ name: 'MOVE', pattern: _MOVE }, TOKEN_METADATA.MOVE),
    COPY: createTokenWithMetadata({ name: 'COPY', pattern: _COPY }, TOKEN_METADATA.COPY),
    INTO: createTokenWithMetadata({ name: 'INTO', pattern: _INTO }, TOKEN_METADATA.INTO),
    TO: createTokenWithMetadata({ name: 'TO', pattern: _TO }, TOKEN_METADATA.TO),
    USING: createTokenWithMetadata({ name: 'USING', pattern: _USING }, TOKEN_METADATA.USING),
    WITH_KW: createTokenWithMetadata({ name: 'WITH', pattern: _WITH }, TOKEN_METADATA.WITH_KW),
    DEFAULT_KW: createTokenWithMetadata({ name: 'DEFAULT', pattern: _DEFAULT }, TOKEN_METADATA.DEFAULT_KW),
    ALL_KW: createTokenWithMetadata({ name: 'ALL', pattern: _ALL }, TOKEN_METADATA.ALL_KW),

    // SPARQL Aggregate tokens
    COUNT: createTokenWithMetadata({ name: 'COUNT', pattern: _COUNT }, TOKEN_METADATA.COUNT),
    SUM: createTokenWithMetadata({ name: 'SUM', pattern: _SUM }, TOKEN_METADATA.SUM),
    MIN_KW: createTokenWithMetadata({ name: 'MIN', pattern: _MIN }, TOKEN_METADATA.MIN_KW),
    MAX_KW: createTokenWithMetadata({ name: 'MAX', pattern: _MAX }, TOKEN_METADATA.MAX_KW),
    AVG: createTokenWithMetadata({ name: 'AVG', pattern: _AVG }, TOKEN_METADATA.AVG),
    SAMPLE: createTokenWithMetadata({ name: 'SAMPLE', pattern: _SAMPLE }, TOKEN_METADATA.SAMPLE),
    GROUP_CONCAT: createTokenWithMetadata({ name: 'GROUP_CONCAT', pattern: _GROUP_CONCAT }, TOKEN_METADATA.GROUP_CONCAT),
    SEPARATOR: createTokenWithMetadata({ name: 'SEPARATOR', pattern: _SEPARATOR }, TOKEN_METADATA.SEPARATOR),

    // SPARQL Built-in function tokens
    STR: createTokenWithMetadata({ name: 'STR', pattern: _STR }, TOKEN_METADATA.STR),
    LANG_KW: createTokenWithMetadata({ name: 'LANG', pattern: _LANG }, TOKEN_METADATA.LANG_KW),
    LANGMATCHES: createTokenWithMetadata({ name: 'LANGMATCHES', pattern: _LANGMATCHES }, TOKEN_METADATA.LANGMATCHES),
    LANGDIR: createTokenWithMetadata({ name: 'LANGDIR', pattern: _LANGDIR }, TOKEN_METADATA.LANGDIR),
    DATATYPE: createTokenWithMetadata({ name: 'DATATYPE', pattern: _DATATYPE }, TOKEN_METADATA.DATATYPE),
    BOUND: createTokenWithMetadata({ name: 'BOUND', pattern: _BOUND }, TOKEN_METADATA.BOUND),
    IRI_KW: createTokenWithMetadata({ name: 'IRI', pattern: _IRI_KW }, TOKEN_METADATA.IRI_KW),
    URI_KW: createTokenWithMetadata({ name: 'URI', pattern: _URI_KW }, TOKEN_METADATA.URI_KW),
    BNODE_KW: createTokenWithMetadata({ name: 'BNODE', pattern: _BNODE_KW }, TOKEN_METADATA.BNODE_KW),
    RAND: createTokenWithMetadata({ name: 'RAND', pattern: _RAND }, TOKEN_METADATA.RAND),
    ABS_KW: createTokenWithMetadata({ name: 'ABS', pattern: _ABS }, TOKEN_METADATA.ABS_KW),
    CEIL: createTokenWithMetadata({ name: 'CEIL', pattern: _CEIL }, TOKEN_METADATA.CEIL),
    FLOOR: createTokenWithMetadata({ name: 'FLOOR', pattern: _FLOOR }, TOKEN_METADATA.FLOOR),
    ROUND: createTokenWithMetadata({ name: 'ROUND', pattern: _ROUND }, TOKEN_METADATA.ROUND),
    CONCAT: createTokenWithMetadata({ name: 'CONCAT', pattern: _CONCAT }, TOKEN_METADATA.CONCAT),
    STRLEN: createTokenWithMetadata({ name: 'STRLEN', pattern: _STRLEN }, TOKEN_METADATA.STRLEN),
    UCASE: createTokenWithMetadata({ name: 'UCASE', pattern: _UCASE }, TOKEN_METADATA.UCASE),
    LCASE: createTokenWithMetadata({ name: 'LCASE', pattern: _LCASE }, TOKEN_METADATA.LCASE),
    ENCODE_FOR_URI: createTokenWithMetadata({ name: 'ENCODE_FOR_URI', pattern: _ENCODE_FOR_URI }, TOKEN_METADATA.ENCODE_FOR_URI),
    CONTAINS: createTokenWithMetadata({ name: 'CONTAINS', pattern: _CONTAINS }, TOKEN_METADATA.CONTAINS),
    STRSTARTS: createTokenWithMetadata({ name: 'STRSTARTS', pattern: _STRSTARTS }, TOKEN_METADATA.STRSTARTS),
    STRENDS: createTokenWithMetadata({ name: 'STRENDS', pattern: _STRENDS }, TOKEN_METADATA.STRENDS),
    STRBEFORE: createTokenWithMetadata({ name: 'STRBEFORE', pattern: _STRBEFORE }, TOKEN_METADATA.STRBEFORE),
    STRAFTER: createTokenWithMetadata({ name: 'STRAFTER', pattern: _STRAFTER }, TOKEN_METADATA.STRAFTER),
    YEAR: createTokenWithMetadata({ name: 'YEAR', pattern: _YEAR }, TOKEN_METADATA.YEAR),
    MONTH: createTokenWithMetadata({ name: 'MONTH', pattern: _MONTH }, TOKEN_METADATA.MONTH),
    DAY: createTokenWithMetadata({ name: 'DAY', pattern: _DAY }, TOKEN_METADATA.DAY),
    HOURS: createTokenWithMetadata({ name: 'HOURS', pattern: _HOURS }, TOKEN_METADATA.HOURS),
    MINUTES: createTokenWithMetadata({ name: 'MINUTES', pattern: _MINUTES }, TOKEN_METADATA.MINUTES),
    SECONDS: createTokenWithMetadata({ name: 'SECONDS', pattern: _SECONDS }, TOKEN_METADATA.SECONDS),
    TIMEZONE: createTokenWithMetadata({ name: 'TIMEZONE', pattern: _TIMEZONE }, TOKEN_METADATA.TIMEZONE),
    TZ_KW: createTokenWithMetadata({ name: 'TZ', pattern: _TZ }, TOKEN_METADATA.TZ_KW),
    NOW: createTokenWithMetadata({ name: 'NOW', pattern: _NOW }, TOKEN_METADATA.NOW),
    UUID_KW: createTokenWithMetadata({ name: 'UUID', pattern: _UUID }, TOKEN_METADATA.UUID_KW),
    STRUUID: createTokenWithMetadata({ name: 'STRUUID', pattern: _STRUUID }, TOKEN_METADATA.STRUUID),
    MD5: createTokenWithMetadata({ name: 'MD5', pattern: _MD5 }, TOKEN_METADATA.MD5),
    SHA1: createTokenWithMetadata({ name: 'SHA1', pattern: _SHA1 }, TOKEN_METADATA.SHA1),
    SHA256: createTokenWithMetadata({ name: 'SHA256', pattern: _SHA256 }, TOKEN_METADATA.SHA256),
    SHA384: createTokenWithMetadata({ name: 'SHA384', pattern: _SHA384 }, TOKEN_METADATA.SHA384),
    SHA512: createTokenWithMetadata({ name: 'SHA512', pattern: _SHA512 }, TOKEN_METADATA.SHA512),
    COALESCE: createTokenWithMetadata({ name: 'COALESCE', pattern: _COALESCE }, TOKEN_METADATA.COALESCE),
    IF_KW: createTokenWithMetadata({ name: 'IF', pattern: _IF }, TOKEN_METADATA.IF_KW),
    STRLANG: createTokenWithMetadata({ name: 'STRLANG', pattern: _STRLANG }, TOKEN_METADATA.STRLANG),
    STRLANGDIR: createTokenWithMetadata({ name: 'STRLANGDIR', pattern: _STRLANGDIR }, TOKEN_METADATA.STRLANGDIR),
    STRDT: createTokenWithMetadata({ name: 'STRDT', pattern: _STRDT }, TOKEN_METADATA.STRDT),
    SAMETERM: createTokenWithMetadata({ name: 'SAMETERM', pattern: _SAMETERM }, TOKEN_METADATA.SAMETERM),
    ISIRI: createTokenWithMetadata({ name: 'ISIRI', pattern: _ISIRI }, TOKEN_METADATA.ISIRI),
    ISURI: createTokenWithMetadata({ name: 'ISURI', pattern: _ISURI }, TOKEN_METADATA.ISURI),
    ISBLANK: createTokenWithMetadata({ name: 'ISBLANK', pattern: _ISBLANK }, TOKEN_METADATA.ISBLANK),
    ISLITERAL: createTokenWithMetadata({ name: 'ISLITERAL', pattern: _ISLITERAL }, TOKEN_METADATA.ISLITERAL),
    ISNUMERIC: createTokenWithMetadata({ name: 'ISNUMERIC', pattern: _ISNUMERIC }, TOKEN_METADATA.ISNUMERIC),
    REGEX: createTokenWithMetadata({ name: 'REGEX', pattern: _REGEX }, TOKEN_METADATA.REGEX),
    SUBSTR: createTokenWithMetadata({ name: 'SUBSTR', pattern: _SUBSTR }, TOKEN_METADATA.SUBSTR),
    REPLACE_KW: createTokenWithMetadata({ name: 'REPLACE', pattern: _REPLACE }, TOKEN_METADATA.REPLACE_KW),
    ISTRIPLE: createTokenWithMetadata({ name: 'ISTRIPLE', pattern: _ISTRIPLE }, TOKEN_METADATA.ISTRIPLE),
    TRIPLE_KW: createTokenWithMetadata({ name: 'TRIPLE', pattern: _TRIPLE }, TOKEN_METADATA.TRIPLE_KW),
    SUBJECT_KW: createTokenWithMetadata({ name: 'SUBJECT', pattern: _SUBJECT }, TOKEN_METADATA.SUBJECT_KW),
    PREDICATE_KW: createTokenWithMetadata({ name: 'PREDICATE', pattern: _PREDICATE }, TOKEN_METADATA.PREDICATE_KW),
    OBJECT_KW: createTokenWithMetadata({ name: 'OBJECT', pattern: _OBJECT }, TOKEN_METADATA.OBJECT_KW),
    HASLANG: createTokenWithMetadata({ name: 'HASLANG', pattern: _HASLANG }, TOKEN_METADATA.HASLANG),
    HASLANGDIR: createTokenWithMetadata({ name: 'HASLANGDIR', pattern: _HASLANGDIR }, TOKEN_METADATA.HASLANGDIR),
};
