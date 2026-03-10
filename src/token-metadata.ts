/**
 * Token metadata categories for RDF/SPARQL formatting.
 * These can be added as properties on token definitions.
 */
export interface TokenMetadata {
    /** Token is a reserved word that can be case-transformed */
    isKeyword?: boolean;
    /** Token must remain lowercase (true, false, a) */
    isLowercaseOnly?: boolean;
    /** Token starts a major SPARQL clause (blank line before) */
    isMajorClause?: boolean;
    /** Token should start on new line (no blank line) */
    isNewlineKeyword?: boolean;
    /** Token is a built-in function (no space before parens) */
    isFunction?: boolean;
    /** Token can be a term (subject/predicate/object) */
    isTerm?: boolean;
    /** Token is an IRI reference */
    isIri?: boolean;
    /** Token is a literal value */
    isLiteral?: boolean;
    /** Token is punctuation */
    isPunctuation?: boolean;
    /** Token is an opening bracket/paren */
    isOpeningBracket?: boolean;
    /** Token is a closing bracket/paren */
    isClosingBracket?: boolean;
    /** Token should have no space before it */
    noSpaceBefore?: boolean;
    /** Token creates a blank node scope */
    isBlankNodeScope?: boolean;
    /** Token is whitespace */
    isWhitespace?: boolean;
    /** Token is a comment */
    isComment?: boolean;
}

/**
 * Token categorization by token name.
 * Format: TOKEN_KEY: { categories }
 * 
 * Keys match the RdfToken object keys for easy spreading with TOKEN_METADATA[key].
 */
export const TOKEN_METADATA: Record<string, TokenMetadata> = {
    // === Whitespace & Comments ===
    WS: { isWhitespace: true },
    COMMENT: { isComment: true },

    // === Boolean Literals (must stay lowercase) ===
    TRUE: { isKeyword: true, isLowercaseOnly: true, isTerm: true, isLiteral: true },
    FALSE: { isKeyword: true, isLowercaseOnly: true, isTerm: true, isLiteral: true },

    // === The 'a' keyword (rdf:type shorthand) ===
    A: { isKeyword: true, isLowercaseOnly: true, isTerm: true },

    // === Turtle/N3 Keywords ===
    TTL_BASE: { isKeyword: true },
    TTL_PREFIX: { isKeyword: true },
    VERSION: { isKeyword: true },

    // === SPARQL Prologue ===
    BASE: { isKeyword: true },
    PREFIX: { isKeyword: true },
    SPARQL_VERSION: { isKeyword: true },

    // === Query Form Keywords (Major Clauses) ===
    SELECT: { isKeyword: true, isMajorClause: true },
    CONSTRUCT: { isKeyword: true, isMajorClause: true },
    DESCRIBE: { isKeyword: true, isMajorClause: true },
    ASK: { isKeyword: true, isMajorClause: true },

    // === Dataset Keywords ===
    FROM: { isKeyword: true, isNewlineKeyword: true },
    NAMED: { isKeyword: true, isNewlineKeyword: true },
    GRAPH: { isKeyword: true },

    // === Pattern Keywords ===
    WHERE: { isKeyword: true, isNewlineKeyword: true },
    OPTIONAL_KW: { isKeyword: true, isMajorClause: true },
    UNION: { isKeyword: true },
    MINUS_KW: { isKeyword: true },
    FILTER: { isKeyword: true, isFunction: true },
    BIND_KW: { isKeyword: true, isFunction: true },
    VALUES: { isKeyword: true, isMajorClause: true },
    SERVICE: { isKeyword: true },
    SILENT: { isKeyword: true },

    // === Solution Modifiers (Major Clauses) ===
    ORDER: { isKeyword: true, isMajorClause: true },
    BY: { isKeyword: true },
    ASC_KW: { isKeyword: true },
    DESC_KW: { isKeyword: true },
    LIMIT: { isKeyword: true, isMajorClause: true },
    OFFSET: { isKeyword: true, isMajorClause: true },
    DISTINCT: { isKeyword: true },
    REDUCED: { isKeyword: true },
    GROUP: { isKeyword: true, isMajorClause: true },
    HAVING: { isKeyword: true, isMajorClause: true },
    AS_KW: { isKeyword: true },

    // === Expression Keywords ===
    IN_KW: { isKeyword: true },
    NOT: { isKeyword: true },
    EXISTS: { isKeyword: true, isFunction: true },
    AND: { isKeyword: true },
    OR: { isKeyword: true },
    UNDEF: { isKeyword: true },

    // === Update Keywords (Major Clauses) ===
    INSERT: { isKeyword: true, isMajorClause: true },
    DELETE_KW: { isKeyword: true, isMajorClause: true },
    DATA: { isKeyword: true },
    LOAD: { isKeyword: true, isMajorClause: true },
    CLEAR: { isKeyword: true, isMajorClause: true },
    DROP: { isKeyword: true, isMajorClause: true },
    CREATE_KW: { isKeyword: true, isMajorClause: true },
    ADD_KW: { isKeyword: true, isMajorClause: true },
    MOVE: { isKeyword: true, isMajorClause: true },
    COPY: { isKeyword: true, isMajorClause: true },
    INTO: { isKeyword: true },
    TO: { isKeyword: true },
    USING: { isKeyword: true },
    WITH_KW: { isKeyword: true, isMajorClause: true },
    DEFAULT_KW: { isKeyword: true },
    ALL_KW: { isKeyword: true },

    // === Aggregate Functions ===
    COUNT: { isKeyword: true, isFunction: true },
    SUM: { isKeyword: true, isFunction: true },
    MIN_KW: { isKeyword: true, isFunction: true },
    MAX_KW: { isKeyword: true, isFunction: true },
    AVG: { isKeyword: true, isFunction: true },
    SAMPLE: { isKeyword: true, isFunction: true },
    GROUP_CONCAT: { isKeyword: true, isFunction: true },
    SEPARATOR: { isKeyword: true },

    // === String Functions ===
    STR: { isKeyword: true, isFunction: true },
    STRLEN: { isKeyword: true, isFunction: true },
    SUBSTR: { isKeyword: true, isFunction: true },
    UCASE: { isKeyword: true, isFunction: true },
    LCASE: { isKeyword: true, isFunction: true },
    STRSTARTS: { isKeyword: true, isFunction: true },
    STRENDS: { isKeyword: true, isFunction: true },
    CONTAINS: { isKeyword: true, isFunction: true },
    STRBEFORE: { isKeyword: true, isFunction: true },
    STRAFTER: { isKeyword: true, isFunction: true },
    ENCODE_FOR_URI: { isKeyword: true, isFunction: true },
    CONCAT: { isKeyword: true, isFunction: true },
    REGEX: { isKeyword: true, isFunction: true },
    REPLACE_KW: { isKeyword: true, isFunction: true },

    // === Numeric Functions ===
    ABS_KW: { isKeyword: true, isFunction: true },
    ROUND: { isKeyword: true, isFunction: true },
    CEIL: { isKeyword: true, isFunction: true },
    FLOOR: { isKeyword: true, isFunction: true },
    RAND: { isKeyword: true, isFunction: true },

    // === Date/Time Functions ===
    NOW: { isKeyword: true, isFunction: true },
    YEAR: { isKeyword: true, isFunction: true },
    MONTH: { isKeyword: true, isFunction: true },
    DAY: { isKeyword: true, isFunction: true },
    HOURS: { isKeyword: true, isFunction: true },
    MINUTES: { isKeyword: true, isFunction: true },
    SECONDS: { isKeyword: true, isFunction: true },
    TIMEZONE: { isKeyword: true, isFunction: true },
    TZ_KW: { isKeyword: true, isFunction: true },

    // === Hash Functions ===
    MD5: { isKeyword: true, isFunction: true },
    SHA1: { isKeyword: true, isFunction: true },
    SHA256: { isKeyword: true, isFunction: true },
    SHA384: { isKeyword: true, isFunction: true },
    SHA512: { isKeyword: true, isFunction: true },

    // === RDF Term Functions ===
    LANG_KW: { isKeyword: true, isFunction: true },
    LANGMATCHES: { isKeyword: true, isFunction: true },
    LANGDIR: { isKeyword: true, isFunction: true },
    DATATYPE: { isKeyword: true, isFunction: true },
    BOUND: { isKeyword: true, isFunction: true },
    IRI_KW: { isKeyword: true, isFunction: true },
    URI_KW: { isKeyword: true, isFunction: true },
    BNODE_KW: { isKeyword: true, isFunction: true },
    STRLANG: { isKeyword: true, isFunction: true },
    STRLANGDIR: { isKeyword: true, isFunction: true },
    STRDT: { isKeyword: true, isFunction: true },
    UUID_KW: { isKeyword: true, isFunction: true },
    STRUUID: { isKeyword: true, isFunction: true },

    // === Type Check Functions ===
    ISIRI: { isKeyword: true, isFunction: true },
    ISURI: { isKeyword: true, isFunction: true },
    ISBLANK: { isKeyword: true, isFunction: true },
    ISLITERAL: { isKeyword: true, isFunction: true },
    ISNUMERIC: { isKeyword: true, isFunction: true },
    SAMETERM: { isKeyword: true, isFunction: true },
    HASLANG: { isKeyword: true, isFunction: true },
    HASLANGDIR: { isKeyword: true, isFunction: true },

    // === RDF-star Functions (SPARQL 1.2) ===
    ISTRIPLE: { isKeyword: true, isFunction: true },
    TRIPLE_KW: { isKeyword: true, isFunction: true },
    SUBJECT_KW: { isKeyword: true, isFunction: true },
    PREDICATE_KW: { isKeyword: true, isFunction: true },
    OBJECT_KW: { isKeyword: true, isFunction: true },

    // === Control Flow Functions ===
    IF_KW: { isKeyword: true, isFunction: true },
    COALESCE: { isKeyword: true, isFunction: true },

    // === IRI Tokens ===
    IRIREF: { isIri: true, isTerm: true },
    IRIREF_ABS: { isIri: true, isTerm: true },
    PNAME_LN: { isIri: true, isTerm: true },
    PNAME_NS: { isIri: true, isTerm: true },

    // === Variable Tokens ===
    VAR1: { isTerm: true },  // ?var
    VAR2: { isTerm: true },  // $var
    QUICK_VAR: { isTerm: true },  // N3 quick variables

    // === Blank Node Tokens ===
    BLANK_NODE_LABEL: { isTerm: true },  // _:label
    ANON: { isTerm: true, isBlankNodeScope: true },  // []

    // === String Literal Tokens ===
    STRING_LITERAL_QUOTE: { isLiteral: true, isTerm: true },
    STRING_LITERAL_SINGLE_QUOTE: { isLiteral: true, isTerm: true },
    STRING_LITERAL_LONG_QUOTE: { isLiteral: true, isTerm: true },
    STRING_LITERAL_LONG_SINGLE_QUOTE: { isLiteral: true, isTerm: true },

    // === Numeric Literal Tokens ===
    INTEGER: { isLiteral: true, isTerm: true },
    DECIMAL: { isLiteral: true, isTerm: true },
    DOUBLE: { isLiteral: true, isTerm: true },
    INTEGER_POSITIVE: { isLiteral: true, isTerm: true },
    DECIMAL_POSITIVE: { isLiteral: true, isTerm: true },
    DOUBLE_POSITIVE: { isLiteral: true, isTerm: true },
    INTEGER_NEGATIVE: { isLiteral: true, isTerm: true },
    DECIMAL_NEGATIVE: { isLiteral: true, isTerm: true },
    DOUBLE_NEGATIVE: { isLiteral: true, isTerm: true },

    // === Punctuation - Opening Brackets ===
    LBRACKET: { isPunctuation: true, isOpeningBracket: true, isBlankNodeScope: true },
    LPARENT: { isPunctuation: true, isOpeningBracket: true, isBlankNodeScope: true },
    LCURLY: { isPunctuation: true, isOpeningBracket: true, isBlankNodeScope: true },
    OPEN_TRIPLE_TERM: { isPunctuation: true, isOpeningBracket: true },  // <<( for RDF-star
    OPEN_REIFIED_TRIPLE: { isPunctuation: true, isOpeningBracket: true, isBlankNodeScope: true },  // <<
    OPEN_ANNOTATION: { isPunctuation: true, isOpeningBracket: true, isBlankNodeScope: true },  // {|

    // === Punctuation - Closing Brackets ===
    RBRACKET: { isPunctuation: true, isClosingBracket: true },
    RPARENT: { isPunctuation: true, isClosingBracket: true },
    RCURLY: { isPunctuation: true, isClosingBracket: true },
    CLOSE_TRIPLE_TERM: { isPunctuation: true, isClosingBracket: true },  // )>>
    CLOSE_REIFIED_TRIPLE: { isPunctuation: true, isClosingBracket: true },  // >>
    CLOSE_ANNOTATION: { isPunctuation: true, isClosingBracket: true },  // |}

    // === Punctuation - Statement Terminators ===
    PERIOD: { isPunctuation: true, noSpaceBefore: true },
    SEMICOLON: { isPunctuation: true, noSpaceBefore: true },
    COMMA: { isPunctuation: true, noSpaceBefore: true },

    // === Punctuation - Other ===
    DCARET: { isPunctuation: true },  // ^^ datatype marker
    LANGTAG: { isPunctuation: true },  // @en language tag
    TILDE: { isPunctuation: true, isBlankNodeScope: true },  // N3 quick variables
    NIL: { isPunctuation: true, isTerm: true },  // () empty list

    // === N3-specific tokens ===
    IMPLIES: { isPunctuation: true },  // =>
    IMPLIED_BY: { isPunctuation: true },  // <=
    EQUALS_SIGN: { isPunctuation: true },  // =
    INVERSE_OF: { isPunctuation: true },  // <-
    EXCL: { isPunctuation: true },  // !
    CARET: { isPunctuation: true },  // ^
    FORALL: { isKeyword: true },  // @forAll
    FORSOME: { isKeyword: true },  // @forSome
    HAS: { isKeyword: true, isLowercaseOnly: true },  // has
    IS: { isKeyword: true, isLowercaseOnly: true },  // is
    OF: { isKeyword: true, isLowercaseOnly: true },  // of

    // === SPARQL operator/punctuation tokens ===
    STAR: { isPunctuation: true },  // *
    SLASH: { isPunctuation: true },  // /
    PIPE: { isPunctuation: true },  // |
    PLUS_SIGN: { isPunctuation: true },  // +
    MINUS_SIGN: { isPunctuation: true },  // -
    QUESTION_MARK: { isPunctuation: true },  // ?
    BANG: { isPunctuation: true },  // !
    EQ: { isPunctuation: true },  // =
    NEQ: { isPunctuation: true },  // !=
    LT: { isPunctuation: true },  // <
    GT: { isPunctuation: true },  // >
    LTE: { isPunctuation: true },  // <=
    GTE: { isPunctuation: true },  // >=
};

/**
 * Helper function to get metadata for a token by its type name.
 * @param tokenTypeName The name of the token type (e.g., 'SELECT', 'IRIREF')
 * @returns The metadata for the token, or undefined if not found
 */
export function getTokenMetadata(tokenTypeName: string): TokenMetadata | undefined {
    return TOKEN_METADATA[tokenTypeName];
}

/**
 * Helper function to check if a token has a specific metadata flag.
 * @param tokenTypeName The name of the token type
 * @param flag The metadata flag to check (e.g., 'isKeyword', 'isMajorClause')
 * @returns True if the token has the flag set to true
 */
export function hasTokenFlag(tokenTypeName: string, flag: keyof TokenMetadata): boolean {
    const metadata = TOKEN_METADATA[tokenTypeName];
    return metadata?.[flag] === true;
}
