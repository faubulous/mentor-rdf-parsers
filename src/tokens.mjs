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

const _A = /a/;

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
)

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
export const tokens = {
    A: createToken({ name: 'A', label: 'a', pattern: _A }),
    ANON: createToken({ name: 'ANON', pattern: _ANON }),
    BASE: createToken({ name: 'BASE', label: '@base', pattern: _BASE }),
    BLANK_NODE_LABEL: createToken({ name: 'BLANK_NODE_LABEL', pattern: _BLANK_NODE_LABEL }),
    CLOSE_ANNOTATION: createToken({ name: 'CLOSE_ANNOTATION', label: '|}', pattern: _CLOSE_ANNOTATION }),
    CLOSE_REIFIED_TRIPLE: createToken({ name: 'CLOSE_REIFIED_TRIPLE', label: '>>', pattern: _CLOSE_REIFIED_TRIPLE }),
    CLOSE_TRIPLE_TERM: createToken({ name: 'CLOSE_TRIPLE_TERM', label: ')>>', pattern: _CLOSE_TRIPLE_TERM }),
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
    OPEN_ANNOTATION: createToken({ name: 'OPEN_ANNOTATION', label: '{|', pattern: _OPEN_ANNOTATION }),
    OPEN_REIFIED_TRIPLE: createToken({ name: 'OPEN_REIFIED_TRIPLE', label: '<<', pattern: _OPEN_REIFIED_TRIPLE }),
    OPEN_TRIPLE_TERM: createToken({ name: 'OPEN_TRIPLE_TERM', label: '<<(', pattern: _OPEN_TRIPLE_TERM }),
    PNAME_LN: createToken({ name: 'PNAME_LN', pattern: _PNAME_LN }),
    PNAME_NS: createToken({ name: 'PNAME_NS', pattern: _PNAME_NS }),
    PREFIX: createToken({ name: 'PREFIX', label: '@prefix', pattern: _PREFIX }),
    RBRACKET: createToken({ name: 'RBRACKET', label: ']', pattern: _RBRACKET }),
    RCURLY: createToken({ name: 'RCURLY', label: '}', pattern: _RCURLY }),
    RPARENT: createToken({ name: 'RPARENT', label: ')', pattern: _RPARENT }),
    SEMICOLON: createToken({ name: 'SEMICOLON', label: ';', pattern: _SEMICOLON }),
    SPARQL_BASE: createToken({ name: 'BASE', pattern: _SPARQL_BASE }),
    SPARQL_PREFIX: createToken({ name: 'PREFIX', pattern: _SPARQL_PREFIX }),
    SPARQL_VERSION: createToken({ name: 'SPARQL_VERSION', pattern: _SPARQL_VERSION }),
    STRING_LITERAL_LONG_QUOTE: createToken({ name: 'STRING_LITERAL_LONG_QUOTE', pattern: _STRING_LITERAL_LONG_QUOTE }),
    STRING_LITERAL_LONG_SINGLE_QUOTE: createToken({ name: 'STRING_LITERAL_LONG_SINGLE_QUOTE', pattern: _STRING_LITERAL_LONG_SINGLE_QUOTE }),
    STRING_LITERAL_QUOTE: createToken({ name: 'STRING_LITERAL_QUOTE', pattern: _STRING_LITERAL_QUOTE }),
    STRING_LITERAL_SINGLE_QUOTE: createToken({ name: 'STRING_LITERAL_SINGLE_QUOTE', pattern: _STRING_LITERAL_SINGLE_QUOTE }),
    TILDE: createToken({ name: 'TILDE', label: '~', pattern: _TILDE }),
    TRUE: createToken({ name: 'true', pattern: _TRUE }),
    VAR1: createToken({ name: 'VAR1', pattern: _VAR1, }),
    VAR2: createToken({ name: 'VAR2', pattern: _VAR2, }),
    VERSION: createToken({ name: 'VERSION', label: '@version', pattern: _VERSION }),
    WS: createToken({ name: 'WS', pattern: _WS, group: Lexer.SKIPPED }),

    // N3-specific tokens
    QUICK_VAR: createToken({ name: 'QUICK_VAR', pattern: _QUICK_VAR }),
    IMPLIES: createToken({ name: 'IMPLIES', label: '=>', pattern: _IMPLIES }),
    IMPLIED_BY: createToken({ name: 'IMPLIED_BY', label: '<=', pattern: _IMPLIED_BY }),
    EQUALS_SIGN: createToken({ name: 'EQUALS_SIGN', label: '=', pattern: _EQUALS_SIGN }),
    INVERSE_OF: createToken({ name: 'INVERSE_OF', label: '<-', pattern: _INVERSE_OF }),
    EXCL: createToken({ name: 'EXCL', label: '!', pattern: _EXCL }),
    CARET: createToken({ name: 'CARET', label: '^', pattern: _CARET }),
    FORALL: createToken({ name: 'FORALL', label: '@forAll', pattern: _FORALL }),
    FORSOME: createToken({ name: 'FORSOME', label: '@forSome', pattern: _FORSOME }),
    HAS: createToken({ name: 'HAS', label: 'has', pattern: _HAS }),
    IS: createToken({ name: 'IS', label: 'is', pattern: _IS }),
    OF: createToken({ name: 'OF', label: 'of', pattern: _OF }),

    // SPARQL operator/punctuation tokens
    STAR: createToken({ name: 'STAR', label: '*', pattern: _STAR }),
    SLASH: createToken({ name: 'SLASH', label: '/', pattern: _SLASH }),
    PIPE: createToken({ name: 'PIPE', label: '|', pattern: _PIPE }),
    PLUS_SIGN: createToken({ name: 'PLUS_SIGN', label: '+', pattern: _PLUS_SIGN }),
    MINUS_SIGN: createToken({ name: 'MINUS_SIGN', label: '-', pattern: _MINUS_SIGN }),
    QUESTION_MARK: createToken({ name: 'QUESTION_MARK', label: '?', pattern: _QUESTION_MARK }),
    BANG: createToken({ name: 'BANG', label: '!', pattern: _BANG }),
    NIL: createToken({ name: 'NIL', pattern: _NIL }),
    INTEGER_POSITIVE: createToken({ name: 'INTEGER_POSITIVE', pattern: _INTEGER_POSITIVE }),
    DECIMAL_POSITIVE: createToken({ name: 'DECIMAL_POSITIVE', pattern: _DECIMAL_POSITIVE }),
    DOUBLE_POSITIVE: createToken({ name: 'DOUBLE_POSITIVE', pattern: _DOUBLE_POSITIVE }),
    INTEGER_NEGATIVE: createToken({ name: 'INTEGER_NEGATIVE', pattern: _INTEGER_NEGATIVE }),
    DECIMAL_NEGATIVE: createToken({ name: 'DECIMAL_NEGATIVE', pattern: _DECIMAL_NEGATIVE }),
    DOUBLE_NEGATIVE: createToken({ name: 'DOUBLE_NEGATIVE', pattern: _DOUBLE_NEGATIVE }),
    AND: createToken({ name: 'AND', label: '&&', pattern: _AND }),
    OR: createToken({ name: 'OR', label: '||', pattern: _OR }),
    EQ: createToken({ name: 'EQ', label: '=', pattern: _EQ }),
    NEQ: createToken({ name: 'NEQ', label: '!=', pattern: _NEQ }),
    LTE: createToken({ name: 'LTE', label: '<=', pattern: _LTE }),
    GTE: createToken({ name: 'GTE', label: '>=', pattern: _GTE }),
    LT: createToken({ name: 'LT', label: '<', pattern: _LT }),
    GT: createToken({ name: 'GT', label: '>', pattern: _GT }),

    // SPARQL keyword tokens
    SELECT: createToken({ name: 'SELECT', pattern: _SELECT }),
    CONSTRUCT: createToken({ name: 'CONSTRUCT', pattern: _CONSTRUCT }),
    DESCRIBE: createToken({ name: 'DESCRIBE', pattern: _DESCRIBE }),
    ASK: createToken({ name: 'ASK', pattern: _ASK }),
    WHERE: createToken({ name: 'WHERE', pattern: _WHERE }),
    FROM: createToken({ name: 'FROM', pattern: _FROM }),
    NAMED: createToken({ name: 'NAMED', pattern: _NAMED }),
    ORDER: createToken({ name: 'ORDER', pattern: _ORDER }),
    BY: createToken({ name: 'BY', pattern: _BY }),
    ASC_KW: createToken({ name: 'ASC', pattern: _ASC }),
    DESC_KW: createToken({ name: 'DESC', pattern: _DESC }),
    LIMIT: createToken({ name: 'LIMIT', pattern: _LIMIT }),
    OFFSET: createToken({ name: 'OFFSET', pattern: _OFFSET }),
    DISTINCT: createToken({ name: 'DISTINCT', pattern: _DISTINCT }),
    REDUCED: createToken({ name: 'REDUCED', pattern: _REDUCED }),
    OPTIONAL_KW: createToken({ name: 'OPTIONAL', pattern: _OPTIONAL }),
    UNION: createToken({ name: 'UNION', pattern: _UNION }),
    FILTER: createToken({ name: 'FILTER', pattern: _FILTER }),
    BIND_KW: createToken({ name: 'BIND', pattern: _BIND }),
    VALUES: createToken({ name: 'VALUES', pattern: _VALUES }),
    AS_KW: createToken({ name: 'AS', pattern: _AS }),
    GROUP: createToken({ name: 'GROUP', pattern: _GROUP }),
    HAVING: createToken({ name: 'HAVING', pattern: _HAVING }),
    SERVICE: createToken({ name: 'SERVICE', pattern: _SERVICE }),
    SILENT: createToken({ name: 'SILENT', pattern: _SILENT }),
    MINUS_KW: createToken({ name: 'MINUS', pattern: _MINUS_KW }),
    UNDEF: createToken({ name: 'UNDEF', pattern: _UNDEF }),
    IN_KW: createToken({ name: 'IN', pattern: _IN }),
    NOT: createToken({ name: 'NOT', pattern: _NOT }),
    EXISTS: createToken({ name: 'EXISTS', pattern: _EXISTS }),

    // SPARQL Update keywords
    INSERT: createToken({ name: 'INSERT', pattern: _INSERT }),
    DELETE_KW: createToken({ name: 'DELETE', pattern: _DELETE }),
    DATA: createToken({ name: 'DATA', pattern: _DATA }),
    LOAD: createToken({ name: 'LOAD', pattern: _LOAD }),
    CLEAR: createToken({ name: 'CLEAR', pattern: _CLEAR }),
    DROP: createToken({ name: 'DROP', pattern: _DROP }),
    CREATE_KW: createToken({ name: 'CREATE', pattern: _CREATE }),
    ADD_KW: createToken({ name: 'ADD', pattern: _ADD }),
    MOVE: createToken({ name: 'MOVE', pattern: _MOVE }),
    COPY: createToken({ name: 'COPY', pattern: _COPY }),
    INTO: createToken({ name: 'INTO', pattern: _INTO }),
    TO: createToken({ name: 'TO', pattern: _TO }),
    USING: createToken({ name: 'USING', pattern: _USING }),
    WITH_KW: createToken({ name: 'WITH', pattern: _WITH }),
    DEFAULT_KW: createToken({ name: 'DEFAULT', pattern: _DEFAULT }),
    ALL_KW: createToken({ name: 'ALL', pattern: _ALL }),

    // SPARQL Aggregate tokens
    COUNT: createToken({ name: 'COUNT', pattern: _COUNT }),
    SUM: createToken({ name: 'SUM', pattern: _SUM }),
    MIN_KW: createToken({ name: 'MIN', pattern: _MIN }),
    MAX_KW: createToken({ name: 'MAX', pattern: _MAX }),
    AVG: createToken({ name: 'AVG', pattern: _AVG }),
    SAMPLE: createToken({ name: 'SAMPLE', pattern: _SAMPLE }),
    GROUP_CONCAT: createToken({ name: 'GROUP_CONCAT', pattern: _GROUP_CONCAT }),
    SEPARATOR: createToken({ name: 'SEPARATOR', pattern: _SEPARATOR }),

    // SPARQL Built-in function tokens
    STR: createToken({ name: 'STR', pattern: _STR }),
    LANG_KW: createToken({ name: 'LANG', pattern: _LANG }),
    LANGMATCHES: createToken({ name: 'LANGMATCHES', pattern: _LANGMATCHES }),
    LANGDIR: createToken({ name: 'LANGDIR', pattern: _LANGDIR }),
    DATATYPE: createToken({ name: 'DATATYPE', pattern: _DATATYPE }),
    BOUND: createToken({ name: 'BOUND', pattern: _BOUND }),
    IRI_KW: createToken({ name: 'IRI', pattern: _IRI_KW }),
    URI_KW: createToken({ name: 'URI', pattern: _URI_KW }),
    BNODE_KW: createToken({ name: 'BNODE', pattern: _BNODE_KW }),
    RAND: createToken({ name: 'RAND', pattern: _RAND }),
    ABS_KW: createToken({ name: 'ABS', pattern: _ABS }),
    CEIL: createToken({ name: 'CEIL', pattern: _CEIL }),
    FLOOR: createToken({ name: 'FLOOR', pattern: _FLOOR }),
    ROUND: createToken({ name: 'ROUND', pattern: _ROUND }),
    CONCAT: createToken({ name: 'CONCAT', pattern: _CONCAT }),
    STRLEN: createToken({ name: 'STRLEN', pattern: _STRLEN }),
    UCASE: createToken({ name: 'UCASE', pattern: _UCASE }),
    LCASE: createToken({ name: 'LCASE', pattern: _LCASE }),
    ENCODE_FOR_URI: createToken({ name: 'ENCODE_FOR_URI', pattern: _ENCODE_FOR_URI }),
    CONTAINS: createToken({ name: 'CONTAINS', pattern: _CONTAINS }),
    STRSTARTS: createToken({ name: 'STRSTARTS', pattern: _STRSTARTS }),
    STRENDS: createToken({ name: 'STRENDS', pattern: _STRENDS }),
    STRBEFORE: createToken({ name: 'STRBEFORE', pattern: _STRBEFORE }),
    STRAFTER: createToken({ name: 'STRAFTER', pattern: _STRAFTER }),
    YEAR: createToken({ name: 'YEAR', pattern: _YEAR }),
    MONTH: createToken({ name: 'MONTH', pattern: _MONTH }),
    DAY: createToken({ name: 'DAY', pattern: _DAY }),
    HOURS: createToken({ name: 'HOURS', pattern: _HOURS }),
    MINUTES: createToken({ name: 'MINUTES', pattern: _MINUTES }),
    SECONDS: createToken({ name: 'SECONDS', pattern: _SECONDS }),
    TIMEZONE: createToken({ name: 'TIMEZONE', pattern: _TIMEZONE }),
    TZ_KW: createToken({ name: 'TZ', pattern: _TZ }),
    NOW: createToken({ name: 'NOW', pattern: _NOW }),
    UUID_KW: createToken({ name: 'UUID', pattern: _UUID }),
    STRUUID: createToken({ name: 'STRUUID', pattern: _STRUUID }),
    MD5: createToken({ name: 'MD5', pattern: _MD5 }),
    SHA1: createToken({ name: 'SHA1', pattern: _SHA1 }),
    SHA256: createToken({ name: 'SHA256', pattern: _SHA256 }),
    SHA384: createToken({ name: 'SHA384', pattern: _SHA384 }),
    SHA512: createToken({ name: 'SHA512', pattern: _SHA512 }),
    COALESCE: createToken({ name: 'COALESCE', pattern: _COALESCE }),
    IF_KW: createToken({ name: 'IF', pattern: _IF }),
    STRLANG: createToken({ name: 'STRLANG', pattern: _STRLANG }),
    STRLANGDIR: createToken({ name: 'STRLANGDIR', pattern: _STRLANGDIR }),
    STRDT: createToken({ name: 'STRDT', pattern: _STRDT }),
    SAMETERM: createToken({ name: 'SAMETERM', pattern: _SAMETERM }),
    ISIRI: createToken({ name: 'ISIRI', pattern: _ISIRI }),
    ISURI: createToken({ name: 'ISURI', pattern: _ISURI }),
    ISBLANK: createToken({ name: 'ISBLANK', pattern: _ISBLANK }),
    ISLITERAL: createToken({ name: 'ISLITERAL', pattern: _ISLITERAL }),
    ISNUMERIC: createToken({ name: 'ISNUMERIC', pattern: _ISNUMERIC }),
    REGEX: createToken({ name: 'REGEX', pattern: _REGEX }),
    SUBSTR: createToken({ name: 'SUBSTR', pattern: _SUBSTR }),
    REPLACE_KW: createToken({ name: 'REPLACE', pattern: _REPLACE }),
    ISTRIPLE: createToken({ name: 'ISTRIPLE', pattern: _ISTRIPLE }),
    TRIPLE_KW: createToken({ name: 'TRIPLE', pattern: _TRIPLE }),
    SUBJECT_KW: createToken({ name: 'SUBJECT', pattern: _SUBJECT }),
    PREDICATE_KW: createToken({ name: 'PREDICATE', pattern: _PREDICATE }),
    OBJECT_KW: createToken({ name: 'OBJECT', pattern: _OBJECT }),
    HASLANG: createToken({ name: 'HASLANG', pattern: _HASLANG }),
    HASLANGDIR: createToken({ name: 'HASLANGDIR', pattern: _HASLANGDIR }),
}