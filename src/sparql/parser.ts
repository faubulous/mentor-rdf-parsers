import { Lexer, CstParser, IToken, CstNode, TokenType } from 'chevrotain';
import { tokens } from '../tokens.js';

/**
 * SPARQL 1.2 Parser
 *
 * Implements the grammar defined in:
 * W3C Working Draft — SPARQL 1.2 Query Language
 * https://www.w3.org/TR/sparql12-query/#sparqlGrammar
 *
 * Productions [1]–[158] (non-terminal rules) are implemented as Chevrotain
 * parser rules. Terminal productions [159]–[193] (IRIREF, PNAME_NS, etc.)
 * are handled as lexer tokens defined in ../tokens.mjs.
 *
 * The parser also covers SPARQL 1.2 Update (productions [31]–[49]) as the
 * grammar is shared between query and update via the `queryOrUpdate` entry
 * point which factors out the common Prologue.
 */

// SPARQL token order - longer/more specific patterns must come before shorter ones
const allTokens: TokenType[] = [
    tokens.WS,
    tokens.COMMENT,

    // Multi-char operators/punctuation (before single-char)
    tokens.DCARET,         // ^^ before CARET
    tokens.CARET,          // ^ (inverse path)
    tokens.AND,            // &&
    tokens.OR,             // || before PIPE |
    tokens.NEQ,            // != before BANG !
    tokens.LTE,            // <= before LT <
    tokens.GTE,            // >= before GT >
    tokens.OPEN_ANNOTATION,    // {| before LCURLY {
    tokens.CLOSE_ANNOTATION,   // |} before PIPE |
    tokens.OPEN_TRIPLE_TERM,   // <<( before OPEN_REIFIED_TRIPLE <<
    tokens.CLOSE_TRIPLE_TERM,  // )>> before RPARENT )
    tokens.OPEN_REIFIED_TRIPLE, // <<
    tokens.CLOSE_REIFIED_TRIPLE, // >>

    // Punctuation
    tokens.TILDE,
    tokens.COMMA,
    tokens.SEMICOLON,
    tokens.PERIOD,
    tokens.LBRACKET,
    tokens.RBRACKET,
    tokens.NIL,            // () before LPARENT ( and RPARENT )
    tokens.LPARENT,
    tokens.RPARENT,
    tokens.LCURLY,
    tokens.RCURLY,

    // SPARQL variables (before QUESTION_MARK to avoid ?name → ? + name)
    tokens.VAR1,
    tokens.VAR2,

    // IRIs must come before LT/GT to avoid <http://...> being split into < + http: + ...
    tokens.IRIREF,

    tokens.STAR,
    tokens.SLASH,
    tokens.PIPE,
    tokens.PLUS_SIGN,
    tokens.MINUS_SIGN,
    tokens.BANG,
    tokens.EQ,
    tokens.LT,
    tokens.GT,
    tokens.QUESTION_MARK,

    // Boolean literals
    tokens.TRUE,
    tokens.FALSE,

    // RDF literal keywords
    tokens.A,

    // SPARQL aggregate keywords (longer first)
    tokens.GROUP_CONCAT,

    // SPARQL built-in functions (longer/more specific first)
    tokens.ENCODE_FOR_URI,
    tokens.LANGMATCHES,
    tokens.LANGDIR,
    tokens.STRLANGDIR,
    tokens.STRLANG,
    tokens.STRSTARTS,
    tokens.STRENDS,
    tokens.STRBEFORE,
    tokens.STRAFTER,
    tokens.STRLEN,
    tokens.STRUUID,
    tokens.STRDT,
    tokens.STR,
    tokens.LANG_KW,
    tokens.DATATYPE,
    tokens.BOUND,
    tokens.IRI_KW,
    tokens.URI_KW,
    tokens.BNODE_KW,
    tokens.RAND,
    tokens.ABS_KW,
    tokens.CEIL,
    tokens.FLOOR,
    tokens.ROUND,
    tokens.CONCAT,
    tokens.UCASE,
    tokens.LCASE,
    tokens.CONTAINS,
    tokens.YEAR,
    tokens.MONTH,
    tokens.DAY,
    tokens.HOURS,
    tokens.MINUTES,
    tokens.SECONDS,
    tokens.TIMEZONE,
    tokens.TZ_KW,
    tokens.NOW,
    tokens.UUID_KW,
    tokens.MD5,
    tokens.SHA256,
    tokens.SHA384,
    tokens.SHA512,
    tokens.SHA1,
    tokens.COALESCE,
    tokens.IF_KW,
    tokens.SAMETERM,
    tokens.ISIRI,
    tokens.ISURI,
    tokens.ISBLANK,
    tokens.ISLITERAL,
    tokens.ISNUMERIC,
    tokens.ISTRIPLE,
    tokens.TRIPLE_KW,
    tokens.SUBJECT_KW,
    tokens.PREDICATE_KW,
    tokens.OBJECT_KW,
    tokens.HASLANGDIR,
    tokens.HASLANG,
    tokens.REGEX,
    tokens.SUBSTR,
    tokens.REPLACE_KW,

    // SPARQL aggregate keywords
    tokens.COUNT,
    tokens.SAMPLE,
    tokens.SUM,
    tokens.MIN_KW,
    tokens.MAX_KW,
    tokens.AVG,
    tokens.SEPARATOR,

    // SPARQL keywords (longer first)
    tokens.CONSTRUCT,
    tokens.DESCRIBE,
    tokens.DISTINCT,
    tokens.OPTIONAL_KW,
    tokens.REDUCED,
    tokens.SELECT,
    tokens.SERVICE,
    tokens.DEFAULT_KW,
    tokens.DELETE_KW,
    tokens.EXISTS,
    tokens.FILTER,
    tokens.HAVING,
    tokens.INSERT,
    tokens.OFFSET,
    tokens.SILENT,
    tokens.VALUES,
    tokens.CREATE_KW,
    tokens.MINUS_KW,
    tokens.NAMED,
    tokens.ORDER,
    tokens.CLEAR,
    tokens.GROUP,
    tokens.LIMIT,
    tokens.UNION,
    tokens.UNDEF,
    tokens.USING,
    tokens.WHERE,
    tokens.WITH_KW,
    tokens.BIND_KW,
    tokens.COPY,
    tokens.DATA,
    tokens.DROP,
    tokens.FROM,
    tokens.INTO,
    tokens.LOAD,
    tokens.MOVE,
    tokens.ADD_KW,
    tokens.ALL_KW,
    tokens.ASC_KW,
    tokens.ASK,
    tokens.DESC_KW,
    tokens.NOT,
    tokens.AS_KW,
    tokens.BY,
    tokens.IN_KW,
    tokens.TO,

    // Directives
    tokens.SPARQL_VERSION,
    tokens.SPARQL_PREFIX,
    tokens.SPARQL_BASE,
    tokens.GRAPH,

    // RDF terms
    tokens.PNAME_LN,
    tokens.PNAME_NS,
    tokens.BLANK_NODE_LABEL,
    tokens.LANGTAG,

    // Numeric literals (more specific first)
    tokens.DOUBLE_POSITIVE,
    tokens.DECIMAL_POSITIVE,
    tokens.INTEGER_POSITIVE,
    tokens.DOUBLE_NEGATIVE,
    tokens.DECIMAL_NEGATIVE,
    tokens.INTEGER_NEGATIVE,
    tokens.DOUBLE,
    tokens.DECIMAL,
    tokens.INTEGER,

    // String literals (long before short)
    tokens.STRING_LITERAL_LONG_SINGLE_QUOTE,
    tokens.STRING_LITERAL_LONG_QUOTE,
    tokens.STRING_LITERAL_SINGLE_QUOTE,
    tokens.STRING_LITERAL_QUOTE,
];

/**
 * Resolves codepoint escape sequences in a SPARQL string.
 *
 * Per SPARQL 1.2 spec section 19.2, codepoint escape sequences (\uXXXX and
 * \UXXXXXXXX) are resolved before parsing by the grammar. They can appear
 * anywhere in the query string and are replaced by the corresponding Unicode
 * code point. Surrogate code points (U+D800 to U+DFFF) are excluded.
 *
 * @param {string} input - The raw SPARQL query string.
 * @returns {string} The input with codepoint escapes resolved.
 * @throws {Error} If a surrogate code point is encountered.
 */
export function resolveCodepointEscapes(input: string): string {
    return input.replace(/\\U([0-9A-Fa-f]{8})|\\u([0-9A-Fa-f]{4})/g, (_match, u8: string | undefined, u4: string | undefined) => {
        const hex = u8 || u4;
        const codePoint = parseInt(hex!, 16);

        // Reject surrogate code points (U+D800 to U+DFFF)
        if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
            throw new Error(`Surrogate code point U+${hex} is not allowed in codepoint escape sequences`);
        }

        return String.fromCodePoint(codePoint);
    });
}

/**
 * A SPARQL 1.2 compliant lexer.
 */
export class SparqlLexer extends Lexer {
    constructor() {
        super(allTokens);
    }
}

/**
 * A SPARQL 1.2 compliant parser.
 * Based on the SPARQL 1.2 grammar: https://www.w3.org/TR/sparql12-query/#sparqlGrammar
 */
export class SparqlParser extends CstParser {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces: Record<string, string> = {};

    /**
     * Tracks whether the current verb in a PropertyListPathNotEmpty is a simple
     * path (IRI or 'a') vs a complex property path expression. Per spec note 16,
     * annotations and reifiers are only permitted when the verb is a simple path.
     */
    _verbIsSimplePath: boolean = true;

    /**
     * Tracks whether we are inside a DELETE block (DELETE DATA, DELETE WHERE,
     * or DeleteClause). Per grammar note 7, blank node syntax is not allowed
     * in these contexts, which means anonymous reifiers and annotation blocks
     * without a named reifier are disallowed.
     */
    _insideDeleteBlock: boolean = false;

    constructor() {
        super(allTokens, {
            recoveryEnabled: true
        });

        this.performSelfAnalysis();
    }

    registerNamespace(prefixToken: IToken, iriToken: IToken): void {
        const prefix = prefixToken.image.slice(0, -1);
        const iri = iriToken.image.slice(1, -1);

        this.namespaces[prefix] = iri;
    }

    /**
     * Parses tokens into a CST.
     */
    parse(inputTokens: IToken[]): CstNode {
        this.input = inputTokens;

        const cst = this.queryOrUpdate();

        if (this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    // ==========================================
    // Entry point
    // ==========================================

    /**
     * [1] QueryUnit ::= Query
     * [30] UpdateUnit ::= Update
     * Combined entry point that tries Query first, then Update.
     */
    queryOrUpdate = this.RULE('queryOrUpdate', () => {
        this.SUBRULE(this.prologue);
        this.OR([
            // Query forms (SELECT, CONSTRUCT, DESCRIBE, ASK)
            { ALT: () => this.SUBRULE(this.queryBody) },
            // Update forms (INSERT, DELETE, LOAD, CLEAR, DROP, ADD, MOVE, COPY, CREATE, WITH)
            { ALT: () => this.SUBRULE(this.updateBody) }
        ]);
    });

    // ==========================================
    // Query productions [2]-[29]
    // ==========================================

    /**
     * [2] Query ::= Prologue (SelectQuery | ConstructQuery | DescribeQuery | AskQuery) ValuesClause
     * Note: Prologue is factored out into queryOrUpdate.
     */
    query = this.RULE('query', () => {
        this.SUBRULE(this.prologue);
        this.SUBRULE(this.queryBody);
    });

    /**
     * Query body after prologue: (SelectQuery | ConstructQuery | DescribeQuery | AskQuery) ValuesClause
     */
    queryBody = this.RULE('queryBody', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.selectQuery) },
            { ALT: () => this.SUBRULE(this.constructQuery) },
            { ALT: () => this.SUBRULE(this.describeQuery) },
            { ALT: () => this.SUBRULE(this.askQuery) }
        ]);
        this.SUBRULE(this.valuesClause);
    });

    /**
     * [4] Prologue ::= (BaseDecl | PrefixDecl | VersionDecl)*
     */
    prologue = this.RULE('prologue', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.baseDecl) },
                { ALT: () => this.SUBRULE(this.prefixDecl) },
                { ALT: () => this.SUBRULE(this.versionDecl) }
            ]);
        });
    });

    /**
     * [5] BaseDecl ::= 'BASE' IRIREF
     */
    baseDecl = this.RULE('baseDecl', () => {
        this.CONSUME(tokens.SPARQL_BASE);
        this.CONSUME(tokens.IRIREF);
    });

    /**
     * [6] PrefixDecl ::= 'PREFIX' PNAME_NS IRIREF
     */
    prefixDecl = this.RULE('prefixDecl', () => {
        this.CONSUME(tokens.SPARQL_PREFIX);
        const prefix = this.CONSUME(tokens.PNAME_NS);
        const iri = this.CONSUME(tokens.IRIREF);
        this.registerNamespace(prefix, iri);
    });

    /**
     * [7] VersionDecl ::= 'VERSION' VersionSpecifier
     */
    versionDecl = this.RULE('versionDecl', () => {
        this.CONSUME(tokens.SPARQL_VERSION);
        this.SUBRULE(this.versionSpecifier);
    });

    /**
     * [8] VersionSpecifier ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE
     */
    versionSpecifier = this.RULE('versionSpecifier', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_SINGLE_QUOTE) }
        ]);
    });

    /**
     * [9] SelectQuery ::= SelectClause DatasetClause* WhereClause SolutionModifier
     */
    selectQuery = this.RULE('selectQuery', () => {
        this.SUBRULE(this.selectClause);
        this.MANY(() => this.SUBRULE(this.datasetClause));
        this.SUBRULE(this.whereClause);
        this.SUBRULE(this.solutionModifier);
    });

    /**
     * [10] SubSelect ::= SelectClause WhereClause SolutionModifier ValuesClause
     */
    subSelect = this.RULE('subSelect', () => {
        this.SUBRULE(this.selectClause);
        this.SUBRULE(this.whereClause);
        this.SUBRULE(this.solutionModifier);
        this.SUBRULE(this.valuesClause);
    });

    /**
     * [11] SelectClause ::= 'SELECT' ('DISTINCT' | 'REDUCED')? ((Var | ('(' Expression 'AS' Var ')'))+ | '*')
     */
    selectClause = this.RULE('selectClause', () => {
        this.CONSUME(tokens.SELECT);
        this.OPTION(() => {
            this.OR1([
                { ALT: () => this.CONSUME(tokens.DISTINCT) },
                { ALT: () => this.CONSUME(tokens.REDUCED) }
            ]);
        });
        this.OR2([
            {
                ALT: () => {
                    this.AT_LEAST_ONE(() => {
                        this.OR3([
                            { ALT: () => this.SUBRULE(this.var) },
                            {
                                ALT: () => {
                                    this.CONSUME(tokens.LPARENT);
                                    this.SUBRULE(this.expression);
                                    this.CONSUME(tokens.AS_KW);
                                    this.SUBRULE2(this.var);
                                    this.CONSUME(tokens.RPARENT);
                                }
                            }
                        ]);
                    });
                }
            },
            { ALT: () => this.CONSUME(tokens.STAR) }
        ]);
    });

    /**
     * [12] ConstructQuery ::= 'CONSTRUCT' (ConstructTemplate DatasetClause* WhereClause SolutionModifier
     *                       | DatasetClause* 'WHERE' '{' TriplesTemplate? '}' SolutionModifier)
     */
    constructQuery = this.RULE('constructQuery', () => {
        this.CONSUME(tokens.CONSTRUCT);
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE(this.constructTemplate);
                    this.MANY1(() => this.SUBRULE1(this.datasetClause));
                    this.SUBRULE1(this.whereClause);
                    this.SUBRULE1(this.solutionModifier);
                }
            },
            {
                ALT: () => {
                    this.MANY2(() => this.SUBRULE2(this.datasetClause));
                    this.CONSUME(tokens.WHERE);
                    this.CONSUME(tokens.LCURLY);
                    this.OPTION(() => this.SUBRULE(this.triplesTemplate));
                    this.CONSUME(tokens.RCURLY);
                    this.SUBRULE2(this.solutionModifier);
                }
            }
        ]);
    });

    /**
     * [13] DescribeQuery ::= 'DESCRIBE' (VarOrIri+ | '*') DatasetClause* WhereClause? SolutionModifier
     */
    describeQuery = this.RULE('describeQuery', () => {
        this.CONSUME(tokens.DESCRIBE);
        this.OR([
            { ALT: () => this.AT_LEAST_ONE(() => this.SUBRULE(this.varOrIri)) },
            { ALT: () => this.CONSUME(tokens.STAR) }
        ]);
        this.MANY(() => this.SUBRULE(this.datasetClause));
        this.OPTION(() => this.SUBRULE(this.whereClause));
        this.SUBRULE(this.solutionModifier);
    });

    /**
     * [14] AskQuery ::= 'ASK' DatasetClause* WhereClause SolutionModifier
     */
    askQuery = this.RULE('askQuery', () => {
        this.CONSUME(tokens.ASK);
        this.MANY(() => this.SUBRULE(this.datasetClause));
        this.SUBRULE(this.whereClause);
        this.SUBRULE(this.solutionModifier);
    });

    /**
     * [15] DatasetClause ::= 'FROM' (DefaultGraphClause | NamedGraphClause)
     */
    datasetClause = this.RULE('datasetClause', () => {
        this.CONSUME(tokens.FROM);
        this.OR([
            { ALT: () => this.SUBRULE(this.defaultGraphClause) },
            { ALT: () => this.SUBRULE(this.namedGraphClause) }
        ]);
    });

    /**
     * [16] DefaultGraphClause ::= SourceSelector
     */
    defaultGraphClause = this.RULE('defaultGraphClause', () => {
        this.SUBRULE(this.sourceSelector);
    });

    /**
     * [17] NamedGraphClause ::= 'NAMED' SourceSelector
     */
    namedGraphClause = this.RULE('namedGraphClause', () => {
        this.CONSUME(tokens.NAMED);
        this.SUBRULE(this.sourceSelector);
    });

    /**
     * [18] SourceSelector ::= iri
     */
    sourceSelector = this.RULE('sourceSelector', () => {
        this.SUBRULE(this.iri);
    });

    /**
     * [19] WhereClause ::= 'WHERE'? GroupGraphPattern
     */
    whereClause = this.RULE('whereClause', () => {
        this.OPTION(() => this.CONSUME(tokens.WHERE));
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [20] SolutionModifier ::= GroupClause? HavingClause? OrderClause? LimitOffsetClauses?
     */
    solutionModifier = this.RULE('solutionModifier', () => {
        this.OPTION1(() => this.SUBRULE(this.groupClause));
        this.OPTION2(() => this.SUBRULE(this.havingClause));
        this.OPTION3(() => this.SUBRULE(this.orderClause));
        this.OPTION4(() => this.SUBRULE(this.limitOffsetClauses));
    });

    /**
     * [21] GroupClause ::= 'GROUP' 'BY' GroupCondition+
     */
    groupClause = this.RULE('groupClause', () => {
        this.CONSUME(tokens.GROUP);
        this.CONSUME(tokens.BY);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.groupCondition));
    });

    /**
     * [22] GroupCondition ::= BuiltInCall | FunctionCall | '(' Expression ('AS' Var)? ')' | Var
     */
    groupCondition = this.RULE('groupCondition', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.builtInCall) },
            { ALT: () => this.SUBRULE(this.functionCall) },
            {
                ALT: () => {
                    this.CONSUME(tokens.LPARENT);
                    this.SUBRULE(this.expression);
                    this.OPTION(() => {
                        this.CONSUME(tokens.AS_KW);
                        this.SUBRULE(this.var);
                    });
                    this.CONSUME(tokens.RPARENT);
                }
            },
            { ALT: () => this.SUBRULE2(this.var) }
        ]);
    });

    /**
     * [23] HavingClause ::= 'HAVING' HavingCondition+
     */
    havingClause = this.RULE('havingClause', () => {
        this.CONSUME(tokens.HAVING);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.havingCondition));
    });

    /**
     * [24] HavingCondition ::= Constraint
     */
    havingCondition = this.RULE('havingCondition', () => {
        this.SUBRULE(this.constraint);
    });

    /**
     * [25] OrderClause ::= 'ORDER' 'BY' OrderCondition+
     */
    orderClause = this.RULE('orderClause', () => {
        this.CONSUME(tokens.ORDER);
        this.CONSUME(tokens.BY);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.orderCondition));
    });

    /**
     * [26] OrderCondition ::= (('ASC' | 'DESC') BrackettedExpression) | (Constraint | Var)
     */
    orderCondition = this.RULE('orderCondition', () => {
        this.OR([
            {
                ALT: () => {
                    this.OR2([
                        { ALT: () => this.CONSUME(tokens.ASC_KW) },
                        { ALT: () => this.CONSUME(tokens.DESC_KW) }
                    ]);
                    this.SUBRULE(this.brackettedExpression);
                }
            },
            { ALT: () => this.SUBRULE(this.constraint) },
            { ALT: () => this.SUBRULE(this.var) }
        ]);
    });

    /**
     * [27] LimitOffsetClauses ::= LimitClause OffsetClause? | OffsetClause LimitClause?
     */
    limitOffsetClauses = this.RULE('limitOffsetClauses', () => {
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE1(this.limitClause);
                    this.OPTION1(() => this.SUBRULE1(this.offsetClause));
                }
            },
            {
                ALT: () => {
                    this.SUBRULE2(this.offsetClause);
                    this.OPTION2(() => this.SUBRULE2(this.limitClause));
                }
            }
        ]);
    });

    /**
     * [28] LimitClause ::= 'LIMIT' INTEGER
     */
    limitClause = this.RULE('limitClause', () => {
        this.CONSUME(tokens.LIMIT);
        this.CONSUME(tokens.INTEGER);
    });

    /**
     * [29] OffsetClause ::= 'OFFSET' INTEGER
     */
    offsetClause = this.RULE('offsetClause', () => {
        this.CONSUME(tokens.OFFSET);
        this.CONSUME(tokens.INTEGER);
    });

    // ==========================================
    // Update productions [30]-[49]
    // ==========================================

    /**
     * [31] Update ::= Prologue (Update1 (';' Update)? )?
     * Note: Prologue is factored out into queryOrUpdate.
     */
    update = this.RULE('update', () => {
        this.SUBRULE(this.prologue);
        this.SUBRULE(this.updateBody);
    });

    /**
     * Update body after prologue: (Update1 (';' Update)?)?
     */
    updateBody = this.RULE('updateBody', () => {
        this.OPTION(() => {
            this.SUBRULE(this.update1);
            this.OPTION2(() => {
                this.CONSUME(tokens.SEMICOLON);
                this.SUBRULE(this.update);
            });
        });
    });

    /**
     * [32] Update1 ::= Load | Clear | Drop | Add | Move | Copy | Create | InsertData | DeleteData | DeleteWhere | Modify
     */
    update1 = this.RULE('update1', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.load) },
            { ALT: () => this.SUBRULE(this.clear) },
            { ALT: () => this.SUBRULE(this.drop) },
            { ALT: () => this.SUBRULE(this.add) },
            { ALT: () => this.SUBRULE(this.move) },
            { ALT: () => this.SUBRULE(this.copy) },
            { ALT: () => this.SUBRULE(this.create) },
            { ALT: () => this.SUBRULE(this.insertData) },
            { ALT: () => this.SUBRULE(this.deleteData) },
            { ALT: () => this.SUBRULE(this.deleteWhere) },
            { ALT: () => this.SUBRULE(this.modify) }
        ]);
    });

    /**
     * [33] Load ::= 'LOAD' 'SILENT'? iri ('INTO' GraphRef)?
     */
    load = this.RULE('load', () => {
        this.CONSUME(tokens.LOAD);
        this.OPTION1(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE(this.iri);
        this.OPTION2(() => {
            this.CONSUME(tokens.INTO);
            this.SUBRULE(this.graphRef);
        });
    });

    /**
     * [34] Clear ::= 'CLEAR' 'SILENT'? GraphRefAll
     */
    clear = this.RULE('clear', () => {
        this.CONSUME(tokens.CLEAR);
        this.OPTION(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE(this.graphRefAll);
    });

    /**
     * [35] Drop ::= 'DROP' 'SILENT'? GraphRefAll
     */
    drop = this.RULE('drop', () => {
        this.CONSUME(tokens.DROP);
        this.OPTION(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE(this.graphRefAll);
    });

    /**
     * [36] Create ::= 'CREATE' 'SILENT'? GraphRef
     */
    create = this.RULE('create', () => {
        this.CONSUME(tokens.CREATE_KW);
        this.OPTION(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE(this.graphRef);
    });

    /**
     * [37] Add ::= 'ADD' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    add = this.RULE('add', () => {
        this.CONSUME(tokens.ADD_KW);
        this.OPTION(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(tokens.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [38] Move ::= 'MOVE' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    move = this.RULE('move', () => {
        this.CONSUME(tokens.MOVE);
        this.OPTION(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(tokens.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [39] Copy ::= 'COPY' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    copy = this.RULE('copy', () => {
        this.CONSUME(tokens.COPY);
        this.OPTION(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(tokens.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [40] InsertData ::= 'INSERT' 'DATA' QuadData
     */
    insertData = this.RULE('insertData', () => {
        this.CONSUME(tokens.INSERT);
        this.CONSUME(tokens.DATA);
        this.SUBRULE(this.quadData);
    });

    /**
     * [41] DeleteData ::= 'DELETE' 'DATA' QuadData
     */
    deleteData = this.RULE('deleteData', () => {
        this.CONSUME(tokens.DELETE_KW);
        this.CONSUME(tokens.DATA);
        const prev = this._insideDeleteBlock;
        this._insideDeleteBlock = true;
        this.SUBRULE(this.quadData);
        this._insideDeleteBlock = prev;
    });

    /**
     * [42] DeleteWhere ::= 'DELETE' 'WHERE' QuadPattern
     */
    deleteWhere = this.RULE('deleteWhere', () => {
        this.CONSUME(tokens.DELETE_KW);
        this.CONSUME(tokens.WHERE);
        const prev = this._insideDeleteBlock;
        this._insideDeleteBlock = true;
        this.SUBRULE(this.quadPattern);
        this._insideDeleteBlock = prev;
    });

    /**
     * [43] Modify ::= ('WITH' iri)? (DeleteClause InsertClause? | InsertClause) UsingClause* 'WHERE' GroupGraphPattern
     */
    modify = this.RULE('modify', () => {
        this.OPTION1(() => {
            this.CONSUME(tokens.WITH_KW);
            this.SUBRULE1(this.iri);
        });
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE(this.deleteClause);
                    this.OPTION2(() => this.SUBRULE1(this.insertClause));
                }
            },
            { ALT: () => this.SUBRULE2(this.insertClause) }
        ]);
        this.MANY(() => this.SUBRULE(this.usingClause));
        this.CONSUME(tokens.WHERE);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [44] DeleteClause ::= 'DELETE' QuadPattern
     */
    deleteClause = this.RULE('deleteClause', () => {
        this.CONSUME(tokens.DELETE_KW);
        const prev = this._insideDeleteBlock;
        this._insideDeleteBlock = true;
        this.SUBRULE(this.quadPattern);
        this._insideDeleteBlock = prev;
    });

    /**
     * [45] InsertClause ::= 'INSERT' QuadPattern
     */
    insertClause = this.RULE('insertClause', () => {
        this.CONSUME(tokens.INSERT);
        this.SUBRULE(this.quadPattern);
    });

    /**
     * [46] UsingClause ::= 'USING' (iri | 'NAMED' iri)
     */
    usingClause = this.RULE('usingClause', () => {
        this.CONSUME(tokens.USING);
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.NAMED);
                    this.SUBRULE1(this.iri);
                }
            },
            { ALT: () => this.SUBRULE2(this.iri) }
        ]);
    });

    /**
     * [47] GraphOrDefault ::= 'DEFAULT' | 'GRAPH'? iri
     */
    graphOrDefault = this.RULE('graphOrDefault', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.DEFAULT_KW) },
            {
                ALT: () => {
                    this.OPTION(() => this.CONSUME(tokens.GRAPH));
                    this.SUBRULE(this.iri);
                }
            }
        ]);
    });

    /**
     * [48] GraphRef ::= 'GRAPH' iri
     */
    graphRef = this.RULE('graphRef', () => {
        this.CONSUME(tokens.GRAPH);
        this.SUBRULE(this.iri);
    });

    /**
     * [49] GraphRefAll ::= GraphRef | 'DEFAULT' | 'NAMED' | 'ALL'
     */
    graphRefAll = this.RULE('graphRefAll', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.graphRef) },
            { ALT: () => this.CONSUME(tokens.DEFAULT_KW) },
            { ALT: () => this.CONSUME(tokens.NAMED) },
            { ALT: () => this.CONSUME(tokens.ALL_KW) }
        ]);
    });

    // ==========================================
    // Quad productions [50]-[54]
    // ==========================================

    /**
     * [50] QuadPattern ::= '{' Quads '}'
     */
    quadPattern = this.RULE('quadPattern', () => {
        this.CONSUME(tokens.LCURLY);
        this.SUBRULE(this.quads);
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * [51] QuadData ::= '{' Quads '}'
     */
    quadData = this.RULE('quadData', () => {
        this.CONSUME(tokens.LCURLY);
        this.SUBRULE(this.quads);
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * [52] Quads ::= TriplesTemplate? (QuadsNotTriples '.'? TriplesTemplate?)*
     */
    quads = this.RULE('quads', () => {
        this.OPTION1(() => this.SUBRULE1(this.triplesTemplate));
        this.MANY(() => {
            this.SUBRULE(this.quadsNotTriples);
            this.OPTION2(() => this.CONSUME(tokens.PERIOD));
            this.OPTION3(() => this.SUBRULE2(this.triplesTemplate));
        });
    });

    /**
     * [53] QuadsNotTriples ::= 'GRAPH' VarOrIri '{' TriplesTemplate? '}'
     */
    quadsNotTriples = this.RULE('quadsNotTriples', () => {
        this.CONSUME(tokens.GRAPH);
        this.SUBRULE(this.varOrIri);
        this.CONSUME(tokens.LCURLY);
        this.OPTION(() => this.SUBRULE(this.triplesTemplate));
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * [54] TriplesTemplate ::= TriplesSameSubject ('.' TriplesTemplate?)?
     */
    triplesTemplate = this.RULE('triplesTemplate', () => {
        this.SUBRULE(this.triplesSameSubject);
        this.OPTION(() => {
            this.CONSUME(tokens.PERIOD);
            this.OPTION2(() => this.SUBRULE(this.triplesTemplate));
        });
    });

    // ==========================================
    // Graph pattern productions [55]-[73]
    // ==========================================

    /**
     * [55] GroupGraphPattern ::= '{' (SubSelect | GroupGraphPatternSub) '}'
     */
    groupGraphPattern = this.RULE('groupGraphPattern', () => {
        this.CONSUME(tokens.LCURLY);
        this.OR([
            { ALT: () => this.SUBRULE(this.subSelect) },
            { ALT: () => this.SUBRULE(this.groupGraphPatternSub) }
        ]);
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * [56] GroupGraphPatternSub ::= TriplesBlock? (GraphPatternNotTriples '.'? TriplesBlock?)*
     */
    groupGraphPatternSub = this.RULE('groupGraphPatternSub', () => {
        this.OPTION1(() => this.SUBRULE1(this.triplesBlock));
        this.MANY(() => {
            this.SUBRULE(this.graphPatternNotTriples);
            this.OPTION2(() => this.CONSUME(tokens.PERIOD));
            this.OPTION3(() => this.SUBRULE2(this.triplesBlock));
        });
    });

    /**
     * [57] TriplesBlock ::= TriplesSameSubjectPath ('.' TriplesBlock?)?
     */
    triplesBlock = this.RULE('triplesBlock', () => {
        this.SUBRULE(this.triplesSameSubjectPath);
        this.OPTION(() => {
            this.CONSUME(tokens.PERIOD);
            this.OPTION2(() => this.SUBRULE(this.triplesBlock));
        });
    });

    /**
     * [58] GraphPatternNotTriples ::= GroupOrUnionGraphPattern | OptionalGraphPattern
     *     | MinusGraphPattern | GraphGraphPattern | ServiceGraphPattern | Filter | Bind | InlineData
     *     | ReifiedTripleBlockPath
     */
    graphPatternNotTriples = this.RULE('graphPatternNotTriples', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.groupOrUnionGraphPattern) },
            { ALT: () => this.SUBRULE(this.optionalGraphPattern) },
            { ALT: () => this.SUBRULE(this.minusGraphPattern) },
            { ALT: () => this.SUBRULE(this.graphGraphPattern) },
            { ALT: () => this.SUBRULE(this.serviceGraphPattern) },
            { ALT: () => this.SUBRULE(this.filter) },
            { ALT: () => this.SUBRULE(this.bind) },
            { ALT: () => this.SUBRULE(this.inlineData) },
            { ALT: () => this.SUBRULE(this.reifiedTripleBlockPath) }
        ]);
    });

    /**
     * [59] ReifiedTripleBlockPath ::= ReifiedTriple PropertyListPath
     */
    reifiedTripleBlockPath = this.RULE('reifiedTripleBlockPath', () => {
        this.SUBRULE(this.reifiedTriple);
        this.SUBRULE(this.propertyListPath);
    });

    /**
     * [60] OptionalGraphPattern ::= 'OPTIONAL' GroupGraphPattern
     */
    optionalGraphPattern = this.RULE('optionalGraphPattern', () => {
        this.CONSUME(tokens.OPTIONAL_KW);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [61] GraphGraphPattern ::= 'GRAPH' VarOrIri GroupGraphPattern
     */
    graphGraphPattern = this.RULE('graphGraphPattern', () => {
        this.CONSUME(tokens.GRAPH);
        this.SUBRULE(this.varOrIri);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [62] ServiceGraphPattern ::= 'SERVICE' 'SILENT'? VarOrIri GroupGraphPattern
     */
    serviceGraphPattern = this.RULE('serviceGraphPattern', () => {
        this.CONSUME(tokens.SERVICE);
        this.OPTION(() => this.CONSUME(tokens.SILENT));
        this.SUBRULE(this.varOrIri);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [63] Bind ::= 'BIND' '(' Expression 'AS' Var ')'
     */
    bind = this.RULE('bind', () => {
        this.CONSUME(tokens.BIND_KW);
        this.CONSUME(tokens.LPARENT);
        this.SUBRULE(this.expression);
        this.CONSUME(tokens.AS_KW);
        this.SUBRULE(this.var);
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * [64] InlineData ::= 'VALUES' DataBlock
     */
    inlineData = this.RULE('inlineData', () => {
        this.CONSUME(tokens.VALUES);
        this.SUBRULE(this.dataBlock);
    });

    /**
     * [65] DataBlock ::= InlineDataOneVar | InlineDataFull
     */
    dataBlock = this.RULE('dataBlock', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.inlineDataOneVar) },
            { ALT: () => this.SUBRULE(this.inlineDataFull) }
        ]);
    });

    /**
     * [66] InlineDataOneVar ::= Var '{' DataBlockValue* '}'
     */
    inlineDataOneVar = this.RULE('inlineDataOneVar', () => {
        this.SUBRULE(this.var);
        this.CONSUME(tokens.LCURLY);
        this.MANY(() => this.SUBRULE(this.dataBlockValue));
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * [67] InlineDataFull ::= (NIL | '(' Var* ')') '{' ('(' DataBlockValue* ')' | NIL)* '}'
     */
    inlineDataFull = this.RULE('inlineDataFull', () => {
        this.OR1([
            { ALT: () => this.CONSUME1(tokens.NIL) },
            {
                ALT: () => {
                    this.CONSUME(tokens.LPARENT);
                    this.MANY1(() => this.SUBRULE(this.var));
                    this.CONSUME(tokens.RPARENT);
                }
            }
        ]);
        this.CONSUME(tokens.LCURLY);
        this.MANY2(() => {
            this.OR2([
                {
                    ALT: () => {
                        this.CONSUME2(tokens.LPARENT);
                        this.MANY3(() => this.SUBRULE(this.dataBlockValue));
                        this.CONSUME2(tokens.RPARENT);
                    }
                },
                { ALT: () => this.CONSUME2(tokens.NIL) }
            ]);
        });
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * [68] DataBlockValue ::= iri | RDFLiteral | NumericLiteral | BooleanLiteral | 'UNDEF' | TripleTermData
     */
    dataBlockValue = this.RULE('dataBlockValue', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) },
            { ALT: () => this.CONSUME(tokens.UNDEF) },
            { ALT: () => this.SUBRULE(this.tripleTermData) }
        ]);
    });

    /**
     * [69] MinusGraphPattern ::= 'MINUS' GroupGraphPattern
     */
    minusGraphPattern = this.RULE('minusGraphPattern', () => {
        this.CONSUME(tokens.MINUS_KW);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [70] GroupOrUnionGraphPattern ::= GroupGraphPattern ('UNION' GroupGraphPattern)*
     */
    groupOrUnionGraphPattern = this.RULE('groupOrUnionGraphPattern', () => {
        this.SUBRULE1(this.groupGraphPattern);
        this.MANY(() => {
            this.CONSUME(tokens.UNION);
            this.SUBRULE2(this.groupGraphPattern);
        });
    });

    /**
     * [71] Filter ::= 'FILTER' Constraint
     */
    filter = this.RULE('filter', () => {
        this.CONSUME(tokens.FILTER);
        this.SUBRULE(this.constraint);
    });

    /**
     * [72] Constraint ::= BrackettedExpression | BuiltInCall | FunctionCall
     */
    constraint = this.RULE('constraint', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.brackettedExpression) },
            { ALT: () => this.SUBRULE(this.builtInCall) },
            { ALT: () => this.SUBRULE(this.functionCall) }
        ]);
    });

    /**
     * [73] FunctionCall ::= iri ArgList
     */
    functionCall = this.RULE('functionCall', () => {
        this.SUBRULE(this.iri);
        this.SUBRULE(this.argList);
    });

    // ==========================================
    // ArgList / ExpressionList [74]-[75]
    // ==========================================

    /**
     * [74] ArgList ::= NIL | '(' 'DISTINCT'? Expression (',' Expression)* ')'
     */
    argList = this.RULE('argList', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.NIL) },
            {
                ALT: () => {
                    this.CONSUME(tokens.LPARENT);
                    this.OPTION(() => this.CONSUME(tokens.DISTINCT));
                    this.SUBRULE1(this.expression);
                    this.MANY(() => {
                        this.CONSUME(tokens.COMMA);
                        this.SUBRULE2(this.expression);
                    });
                    this.CONSUME(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * [75] ExpressionList ::= NIL | '(' Expression (',' Expression)* ')'
     */
    expressionList = this.RULE('expressionList', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.NIL) },
            {
                ALT: () => {
                    this.CONSUME(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.MANY(() => {
                        this.CONSUME(tokens.COMMA);
                        this.SUBRULE2(this.expression);
                    });
                    this.CONSUME(tokens.RPARENT);
                }
            }
        ]);
    });

    // ==========================================
    // Construct template [76]-[77]
    // ==========================================

    /**
     * [76] ConstructTemplate ::= '{' ConstructTriples? '}'
     */
    constructTemplate = this.RULE('constructTemplate', () => {
        this.CONSUME(tokens.LCURLY);
        this.OPTION(() => this.SUBRULE(this.constructTriples));
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * [77] ConstructTriples ::= TriplesSameSubject ('.' ConstructTriples?)?
     */
    constructTriples = this.RULE('constructTriples', () => {
        this.SUBRULE(this.triplesSameSubject);
        this.OPTION(() => {
            this.CONSUME(tokens.PERIOD);
            this.OPTION2(() => this.SUBRULE(this.constructTriples));
        });
    });

    // ==========================================
    // Triple productions [78]-[93]
    // ==========================================

    /**
     * [78] TriplesSameSubject ::= VarOrTerm PropertyListNotEmpty | TriplesNode PropertyList | ReifiedTripleBlock
     */
    triplesSameSubject = this.RULE('triplesSameSubject', () => {
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE(this.varOrTerm);
                    this.SUBRULE(this.propertyListNotEmpty);
                }
            },
            {
                ALT: () => {
                    this.SUBRULE(this.triplesNode);
                    this.SUBRULE(this.propertyList);
                }
            },
            { ALT: () => this.SUBRULE(this.reifiedTripleBlock) }
        ]);
    });

    /**
     * [79] PropertyList ::= PropertyListNotEmpty?
     */
    propertyList = this.RULE('propertyList', () => {
        this.OPTION(() => this.SUBRULE(this.propertyListNotEmpty));
    });

    /**
     * [80] PropertyListNotEmpty ::= Verb ObjectList (';' (Verb ObjectList)?)*
     */
    propertyListNotEmpty = this.RULE('propertyListNotEmpty', () => {
        this.SUBRULE1(this.verb);
        this.SUBRULE1(this.objectList);
        this.MANY(() => {
            this.CONSUME(tokens.SEMICOLON);
            this.OPTION(() => {
                this.SUBRULE2(this.verb);
                this.SUBRULE2(this.objectList);
            });
        });
    });

    /**
     * [81] Verb ::= VarOrIri | 'a'
     */
    verb = this.RULE('verb', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.varOrIri) },
            { ALT: () => this.CONSUME(tokens.A) }
        ]);
    });

    /**
     * [85] ObjectList ::= Object (',' Object)*
     */
    objectList = this.RULE('objectList', () => {
        this.SUBRULE1(this.graphObject);
        this.MANY(() => {
            this.CONSUME(tokens.COMMA);
            this.SUBRULE2(this.graphObject);
        });
    });

    /**
     * [86] Object ::= GraphNode Annotation
     */
    graphObject = this.RULE('graphObject', () => {
        this.SUBRULE(this.graphNode);
        this.SUBRULE(this.annotation);
    });

    /**
     * [84] TriplesSameSubjectPath ::= VarOrTerm PropertyListPathNotEmpty | TriplesNodePath PropertyListPath | ReifiedTripleBlockPath
     */
    triplesSameSubjectPath = this.RULE('triplesSameSubjectPath', () => {
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE(this.varOrTerm);
                    this.SUBRULE(this.propertyListPathNotEmpty);
                }
            },
            {
                ALT: () => {
                    this.SUBRULE(this.triplesNodePath);
                    this.SUBRULE(this.propertyListPath);
                }
            },
            { ALT: () => this.SUBRULE(this.reifiedTripleBlockPath) }
        ]);
    });

    /**
     * [85] PropertyListPath ::= PropertyListPathNotEmpty?
     */
    propertyListPath = this.RULE('propertyListPath', () => {
        this.OPTION(() => this.SUBRULE(this.propertyListPathNotEmpty));
    });

    /**
     * [86] PropertyListPathNotEmpty ::= (VerbPath | VerbSimple) ObjectListPath (';' ((VerbPath | VerbSimple) ObjectListPath)?)*
     *
     * Per spec note 16: annotations and reifiers are only permitted when the
     * predicate is a simple path (IRI, 'a', or variable). Inside annotation
     * blocks, complex paths in verb position produce an error after parsing.
     */
    propertyListPathNotEmpty = this.RULE('propertyListPathNotEmpty', () => {
        this._verbIsSimplePath = true;
        this.OR1([
            { ALT: () => this.SUBRULE1(this.verbPath) },
            { ALT: () => this.SUBRULE1(this.verbSimple) }
        ]);
        this.SUBRULE1(this.objectListPath);
        this.MANY(() => {
            this.CONSUME(tokens.SEMICOLON);
            this.OPTION(() => {
                this._verbIsSimplePath = true;
                this.OR2([
                    { ALT: () => this.SUBRULE2(this.verbPath) },
                    { ALT: () => this.SUBRULE2(this.verbSimple) }
                ]);
                this.SUBRULE2(this.objectListPath);
            });
        });
    });

    /**
     * [87] VerbPath ::= Path
     */
    verbPath = this.RULE('verbPath', () => {
        this.SUBRULE(this.path);
    });

    /**
     * [88] VerbSimple ::= Var
     */
    verbSimple = this.RULE('verbSimple', () => {
        this.SUBRULE(this.var);
    });

    /**
     * [92] ObjectListPath ::= ObjectPath (',' ObjectPath)*
     */
    objectListPath = this.RULE('objectListPath', () => {
        this.SUBRULE1(this.objectPath);
        this.MANY(() => {
            this.CONSUME(tokens.COMMA);
            this.SUBRULE2(this.objectPath);
        });
    });

    /**
     * [93] ObjectPath ::= GraphNodePath AnnotationPath
     */
    objectPath = this.RULE('objectPath', () => {
        this.SUBRULE(this.graphNodePath);
        this.SUBRULE(this.annotationPath);
    });

    // ==========================================
    // Property path productions [91]-[99]
    // ==========================================

    /**
     * [91] Path ::= PathAlternative
     */
    path = this.RULE('path', () => {
        this.SUBRULE(this.pathAlternative);
    });

    /**
     * [92] PathAlternative ::= PathSequence ('|' PathSequence)*
     */
    pathAlternative = this.RULE('pathAlternative', () => {
        this.SUBRULE1(this.pathSequence);
        this.MANY(() => {
            this._verbIsSimplePath = false;
            this.CONSUME(tokens.PIPE);
            this.SUBRULE2(this.pathSequence);
        });
    });

    /**
     * [93] PathSequence ::= PathEltOrInverse ('/' PathEltOrInverse)*
     */
    pathSequence = this.RULE('pathSequence', () => {
        this.SUBRULE1(this.pathEltOrInverse);
        this.MANY(() => {
            this._verbIsSimplePath = false;
            this.CONSUME(tokens.SLASH);
            this.SUBRULE2(this.pathEltOrInverse);
        });
    });

    /**
     * [94] PathElt ::= PathPrimary PathMod?
     */
    pathElt = this.RULE('pathElt', () => {
        this.SUBRULE(this.pathPrimary);
        this.OPTION(() => this.SUBRULE(this.pathMod));
    });

    /**
     * [95] PathEltOrInverse ::= PathElt | '^' PathElt
     */
    pathEltOrInverse = this.RULE('pathEltOrInverse', () => {
        this.OR([
            { ALT: () => this.SUBRULE1(this.pathElt) },
            {
                ALT: () => {
                    this._verbIsSimplePath = false;
                    this.CONSUME(tokens.CARET);
                    this.SUBRULE2(this.pathElt);
                }
            }
        ]);
    });

    /**
     * [96] PathMod ::= '?' | '*' | '+'
     */
    pathMod = this.RULE('pathMod', () => {
        this._verbIsSimplePath = false;
        this.OR([
            { ALT: () => this.CONSUME(tokens.QUESTION_MARK) },
            { ALT: () => this.CONSUME(tokens.STAR) },
            { ALT: () => this.CONSUME(tokens.PLUS_SIGN) }
        ]);
    });

    /**
     * [97] PathPrimary ::= iri | 'a' | '!' PathNegatedPropertySet | '(' Path ')'
     */
    pathPrimary = this.RULE('pathPrimary', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.CONSUME(tokens.A) },
            {
                ALT: () => {
                    this._verbIsSimplePath = false;
                    this.CONSUME(tokens.BANG);
                    this.SUBRULE(this.pathNegatedPropertySet);
                }
            },
            {
                ALT: () => {
                    this._verbIsSimplePath = false;
                    this.CONSUME(tokens.LPARENT);
                    this.SUBRULE(this.path);
                    this.CONSUME(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * [98] PathNegatedPropertySet ::= PathOneInPropertySet | '(' (PathOneInPropertySet ('|' PathOneInPropertySet)*)? ')'
     */
    pathNegatedPropertySet = this.RULE('pathNegatedPropertySet', () => {
        this.OR([
            { ALT: () => this.SUBRULE1(this.pathOneInPropertySet) },
            {
                ALT: () => {
                    this.CONSUME(tokens.LPARENT);
                    this.OPTION(() => {
                        this.SUBRULE2(this.pathOneInPropertySet);
                        this.MANY(() => {
                            this.CONSUME(tokens.PIPE);
                            this.SUBRULE3(this.pathOneInPropertySet);
                        });
                    });
                    this.CONSUME(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * [99] PathOneInPropertySet ::= iri | 'a' | '^' (iri | 'a')
     */
    pathOneInPropertySet = this.RULE('pathOneInPropertySet', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.CONSUME(tokens.A) },
            {
                ALT: () => {
                    this.CONSUME(tokens.CARET);
                    this.OR2([
                        { ALT: () => this.SUBRULE2(this.iri) },
                        { ALT: () => this.CONSUME2(tokens.A) }
                    ]);
                }
            }
        ]);
    });

    // ==========================================
    // RDF 1.2 reification / annotation / triple term [100]-[125]
    // ==========================================

    /**
     * [58] ReifiedTripleBlock ::= ReifiedTriple PropertyList
     */
    reifiedTripleBlock = this.RULE('reifiedTripleBlock', () => {
        this.SUBRULE(this.reifiedTriple);
        this.SUBRULE(this.propertyList);
    });

    /**
     * [101] ReifiedTriplePathBlock ::= ReifiedTriplePath PropertyListPathNotEmpty
     */
    reifiedTriplePathBlock = this.RULE('reifiedTriplePathBlock', () => {
        this.SUBRULE(this.reifiedTriplePath);
        this.SUBRULE(this.propertyListPathNotEmpty);
    });

    /**
     * [102] ReifiedTriple ::= '<<' ReifiedTripleSubject Verb ReifiedTripleObject Reifier? '>>'
     */
    reifiedTriple = this.RULE('reifiedTriple', () => {
        this.CONSUME(tokens.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.reifiedTripleSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.reifiedTripleObject);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(tokens.CLOSE_REIFIED_TRIPLE);
    });

    /**
     * [103] ReifiedTriplePath ::= '<<' ReifiedTripleSubject VerbPath ReifiedTripleObjectPath Reifier? '>>'
     */
    reifiedTriplePath = this.RULE('reifiedTriplePath', () => {
        this.CONSUME(tokens.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.reifiedTripleSubject);
        this.SUBRULE(this.verbPath);
        this.SUBRULE(this.reifiedTripleObjectPath);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(tokens.CLOSE_REIFIED_TRIPLE);
    });

    /**
     * [117] ReifiedTripleSubject ::= Var | iri | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode | ReifiedTriple | TripleTerm
     * Note: Unlike VarOrTerm, this does NOT include NIL.
     */
    reifiedTripleSubject = this.RULE('reifiedTripleSubject', () => {
        this.OR([
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.reifiedTriple) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.tripleTerm) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.var) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.iri) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.rdfLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.numericLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.booleanLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.blankNode) }
        ]);
    });

    /**
     * [118] ReifiedTripleObject ::= Var | iri | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode | ReifiedTriple | TripleTerm
     * Note: Unlike VarOrTerm, this does NOT include NIL.
     */
    reifiedTripleObject = this.RULE('reifiedTripleObject', () => {
        this.OR([
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.tripleTerm) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.reifiedTriple) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.var) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.iri) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.rdfLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.numericLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.booleanLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.blankNode) }
        ]);
    });

    /**
     * [118] ReifiedTripleObjectPath ::= Var | iri | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode | ReifiedTriplePath | TripleTerm
     * Note: Unlike VarOrTerm, this does NOT include NIL.
     */
    reifiedTripleObjectPath = this.RULE('reifiedTripleObjectPath', () => {
        this.OR([
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.tripleTerm) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.reifiedTriplePath) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.var) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.iri) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.rdfLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.numericLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.booleanLiteral) },
            { IGNORE_AMBIGUITIES: true, ALT: () => this.SUBRULE(this.blankNode) }
        ]);
    });

    /**
     * [107] AnnotationPath ::= (Reifier | AnnotationBlockPath)*
     *
     * Per spec note 16: annotations and reifiers are only permitted when the
     * predicate is a simple path (IRI, 'a', or variable), not for complex path
     * expressions (sequence, alternative, inverse, modifiers, negation, grouping).
     */
    annotationPath = this.RULE('annotationPath', () => {
        this.MANY({
            GATE: () => this._verbIsSimplePath,
            DEF: () => {
                this.OR([
                    { ALT: () => this.SUBRULE(this.reifier) },
                    { ALT: () => this.SUBRULE(this.annotationBlockPath) }
                ]);
            }
        });
    });

    /**
     * [108] AnnotationBlockPath ::= '{|' PropertyListPathNotEmpty '|}'
     */
    annotationBlockPath = this.RULE('annotationBlockPath', () => {
        this.CONSUME(tokens.OPEN_ANNOTATION);
        this.SUBRULE(this.propertyListPathNotEmpty);
        this.CONSUME(tokens.CLOSE_ANNOTATION);
    });

    /**
     * [109] Annotation ::= (Reifier | AnnotationBlock)*
     *
     * In delete contexts (DELETE DATA, DELETE WHERE, DeleteClause), annotation
     * blocks without a preceding named reifier are rejected because they create
     * anonymous reifiers (blank nodes), which are disallowed per grammar note 7.
     */
    annotation = this.RULE('annotation', () => {
        let hasNamedReifier = false;
        this.MANY(() => {
            this.OR([
                { ALT: () => {
                    this.SUBRULE(this.reifier);
                    hasNamedReifier = true;
                }},
                { ALT: () => {
                    if (this._insideDeleteBlock && !hasNamedReifier) {
                        throw new Error('Anonymous reifiers (annotation blocks without a named reifier) are not allowed in DELETE blocks (grammar note 7: no blank nodes)');
                    }
                    this.SUBRULE(this.annotationBlock);
                    hasNamedReifier = false;
                }}
            ]);
        });
    });

    /**
     * [110] AnnotationBlock ::= '{|' PropertyListNotEmpty '|}'
     */
    annotationBlock = this.RULE('annotationBlock', () => {
        this.CONSUME(tokens.OPEN_ANNOTATION);
        this.SUBRULE(this.propertyListNotEmpty);
        this.CONSUME(tokens.CLOSE_ANNOTATION);
    });

    /**
     * [111] Reifier ::= '~' VarOrReifierId?
     */
    reifier = this.RULE('reifier', () => {
        this.CONSUME(tokens.TILDE);
        this.OPTION(() => this.SUBRULE(this.varOrReifierId));
    });

    /**
     * [112] VarOrReifierId ::= Var | iri | BlankNode
     */
    varOrReifierId = this.RULE('varOrReifierId', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.var) },
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.blankNode) }
        ]);
    });

    /**
     * [113] TripleTerm ::= '<<(' TripleTermSubject Verb TripleTermObject ')>>'
     */
    tripleTerm = this.RULE('tripleTerm', () => {
        this.CONSUME(tokens.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.tripleTermSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.tripleTermObject);
        this.CONSUME(tokens.CLOSE_TRIPLE_TERM);
    });

    /**
     * [120] TripleTermSubject ::= Var | iri | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode | TripleTerm
     */
    tripleTermSubject = this.RULE('tripleTermSubject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.var) },
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.SUBRULE(this.tripleTerm) }
        ]);
    });

    /**
     * [121] TripleTermObject ::= Var | iri | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode | TripleTerm
     */
    tripleTermObject = this.RULE('tripleTermObject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.var) },
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.SUBRULE(this.tripleTerm) }
        ]);
    });

    /**
     * [116] TripleTermData ::= '<<(' TripleTermDataSubject (iri | 'a') TripleTermDataObject ')>>'
     */
    tripleTermData = this.RULE('tripleTermData', () => {
        this.CONSUME(tokens.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.tripleTermDataSubject);
        this.OR([
            { ALT: () => this.SUBRULE1(this.iri) },
            { ALT: () => this.CONSUME(tokens.A) }
        ]);
        this.SUBRULE(this.tripleTermDataObject);
        this.CONSUME(tokens.CLOSE_TRIPLE_TERM);
    });

    /**
     * [123] TripleTermDataSubject ::= iri
     */
    tripleTermDataSubject = this.RULE('tripleTermDataSubject', () => {
        this.SUBRULE(this.iri);
    });

    /**
     * [124] TripleTermDataObject ::= iri | RDFLiteral | NumericLiteral | BooleanLiteral | TripleTermData
     */
    tripleTermDataObject = this.RULE('tripleTermDataObject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) },
            { ALT: () => this.SUBRULE(this.tripleTermData) }
        ]);
    });

    // ==========================================
    // Expression productions [119]-[143]
    // ==========================================

    /**
     * [119] Expression ::= ConditionalOrExpression
     */
    expression = this.RULE('expression', () => {
        this.SUBRULE(this.conditionalOrExpression);
    });

    /**
     * [120] ConditionalOrExpression ::= ConditionalAndExpression ('||' ConditionalAndExpression)*
     */
    conditionalOrExpression = this.RULE('conditionalOrExpression', () => {
        this.SUBRULE1(this.conditionalAndExpression);
        this.MANY(() => {
            this.CONSUME(tokens.OR);
            this.SUBRULE2(this.conditionalAndExpression);
        });
    });

    /**
     * [121] ConditionalAndExpression ::= ValueLogical ('&&' ValueLogical)*
     */
    conditionalAndExpression = this.RULE('conditionalAndExpression', () => {
        this.SUBRULE1(this.valueLogical);
        this.MANY(() => {
            this.CONSUME(tokens.AND);
            this.SUBRULE2(this.valueLogical);
        });
    });

    /**
     * [122] ValueLogical ::= RelationalExpression
     */
    valueLogical = this.RULE('valueLogical', () => {
        this.SUBRULE(this.relationalExpression);
    });

    /**
     * [123] RelationalExpression ::= NumericExpression
     *       ('=' NumericExpression | '!=' NumericExpression | '<' NumericExpression
     *       | '>' NumericExpression | '<=' NumericExpression | '>=' NumericExpression
     *       | 'IN' ExpressionList | 'NOT' 'IN' ExpressionList)?
     */
    relationalExpression = this.RULE('relationalExpression', () => {
        this.SUBRULE1(this.numericExpression);
        this.OPTION(() => {
            this.OR([
                { ALT: () => { this.CONSUME(tokens.EQ); this.SUBRULE2(this.numericExpression); } },
                { ALT: () => { this.CONSUME(tokens.NEQ); this.SUBRULE3(this.numericExpression); } },
                { ALT: () => { this.CONSUME(tokens.LT); this.SUBRULE4(this.numericExpression); } },
                { ALT: () => { this.CONSUME(tokens.GT); this.SUBRULE5(this.numericExpression); } },
                { ALT: () => { this.CONSUME(tokens.LTE); this.SUBRULE6(this.numericExpression); } },
                { ALT: () => { this.CONSUME(tokens.GTE); this.SUBRULE7(this.numericExpression); } },
                { ALT: () => { this.CONSUME(tokens.IN_KW); this.SUBRULE1(this.expressionList); } },
                { ALT: () => { this.CONSUME(tokens.NOT); this.CONSUME2(tokens.IN_KW); this.SUBRULE2(this.expressionList); } }
            ]);
        });
    });

    /**
     * [124] NumericExpression ::= AdditiveExpression
     */
    numericExpression = this.RULE('numericExpression', () => {
        this.SUBRULE(this.additiveExpression);
    });

    /**
     * [125] AdditiveExpression ::= MultiplicativeExpression
     *       ('+' MultiplicativeExpression | '-' MultiplicativeExpression
     *       | (NumericLiteralPositive | NumericLiteralNegative) (('*' UnaryExpression) | ('/' UnaryExpression))?)*
     */
    additiveExpression = this.RULE('additiveExpression', () => {
        this.SUBRULE1(this.multiplicativeExpression);
        this.MANY(() => {
            this.OR([
                {
                    ALT: () => {
                        this.CONSUME(tokens.PLUS_SIGN);
                        this.SUBRULE2(this.multiplicativeExpression);
                    }
                },
                {
                    ALT: () => {
                        this.CONSUME(tokens.MINUS_SIGN);
                        this.SUBRULE3(this.multiplicativeExpression);
                    }
                },
                {
                    ALT: () => {
                        this.OR2([
                            { ALT: () => this.SUBRULE1(this.numericLiteralPositive) },
                            { ALT: () => this.SUBRULE1(this.numericLiteralNegative) }
                        ]);
                        this.OPTION(() => {
                            this.OR3([
                                { ALT: () => { this.CONSUME(tokens.STAR); this.SUBRULE1(this.unaryExpression); } },
                                { ALT: () => { this.CONSUME(tokens.SLASH); this.SUBRULE2(this.unaryExpression); } }
                            ]);
                        });
                    }
                }
            ]);
        });
    });

    /**
     * [126] MultiplicativeExpression ::= UnaryExpression (('*' UnaryExpression) | ('/' UnaryExpression))*
     */
    multiplicativeExpression = this.RULE('multiplicativeExpression', () => {
        this.SUBRULE1(this.unaryExpression);
        this.MANY(() => {
            this.OR([
                { ALT: () => { this.CONSUME(tokens.STAR); this.SUBRULE2(this.unaryExpression); } },
                { ALT: () => { this.CONSUME(tokens.SLASH); this.SUBRULE3(this.unaryExpression); } }
            ]);
        });
    });

    /**
     * [135] UnaryExpression ::= '!' UnaryExpression | '+' PrimaryExpression | '-' PrimaryExpression | PrimaryExpression
     */
    unaryExpression = this.RULE('unaryExpression', () => {
        this.OR([
            { ALT: () => { this.CONSUME(tokens.BANG); this.SUBRULE1(this.unaryExpression); } },
            { ALT: () => { this.CONSUME(tokens.PLUS_SIGN); this.SUBRULE2(this.primaryExpression); } },
            { ALT: () => { this.CONSUME(tokens.MINUS_SIGN); this.SUBRULE3(this.primaryExpression); } },
            { ALT: () => this.SUBRULE4(this.primaryExpression) }
        ]);
    });

    /**
     * [128] PrimaryExpression ::= BrackettedExpression | BuiltInCall | iriOrFunction | RDFLiteral
     *       | NumericLiteral | BooleanLiteral | Var | ExprTripleTerm
     */
    primaryExpression = this.RULE('primaryExpression', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.brackettedExpression) },
            { ALT: () => this.SUBRULE(this.builtInCall) },
            { ALT: () => this.SUBRULE(this.iriOrFunction) },
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) },
            { ALT: () => this.SUBRULE(this.var) },
            { ALT: () => this.SUBRULE(this.exprTripleTerm) }
        ]);
    });

    /**
     * [129] BrackettedExpression ::= '(' Expression ')'
     */
    brackettedExpression = this.RULE('brackettedExpression', () => {
        this.CONSUME(tokens.LPARENT);
        this.SUBRULE(this.expression);
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * [137] ExprTripleTerm ::= '<<(' ExprTripleTermSubject Verb ExprTripleTermObject ')>>'
     */
    exprTripleTerm = this.RULE('exprTripleTerm', () => {
        this.CONSUME(tokens.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.exprTripleTermSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.exprTripleTermObject);
        this.CONSUME(tokens.CLOSE_TRIPLE_TERM);
    });

    /**
     * [138] ExprTripleTermSubject ::= iri | Var
     */
    exprTripleTermSubject = this.RULE('exprTripleTermSubject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.var) }
        ]);
    });

    /**
     * [139] ExprTripleTermObject ::= iri | RDFLiteral | NumericLiteral | BooleanLiteral | Var | ExprTripleTerm
     */
    exprTripleTermObject = this.RULE('exprTripleTermObject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) },
            { ALT: () => this.SUBRULE(this.var) },
            { ALT: () => this.SUBRULE(this.exprTripleTerm) }
        ]);
    });

    // ==========================================
    // Built-in calls [131]
    // ==========================================

    /**
     * [131] BuiltInCall - dispatches to sub-groups to stay within Chevrotain's CONSUME index limits
     */
    builtInCall = this.RULE('builtInCall', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.aggregate) },
            { ALT: () => this.SUBRULE(this.builtInCallTermAccessors) },
            { ALT: () => this.SUBRULE(this.builtInCallStringFuncs) },
            { ALT: () => this.SUBRULE(this.builtInCallNumericFuncs) },
            { ALT: () => this.SUBRULE(this.builtInCallDateTimeFuncs) },
            { ALT: () => this.SUBRULE(this.builtInCallHashFuncs) },
            { ALT: () => this.SUBRULE(this.builtInCallTestFuncs) },
            { ALT: () => this.SUBRULE(this.builtInCallMiscFuncs) },
            { ALT: () => this.SUBRULE(this.builtInCallRdf12Funcs) },
            { ALT: () => this.SUBRULE(this.regexExpression) },
            { ALT: () => this.SUBRULE(this.substringExpression) },
            { ALT: () => this.SUBRULE(this.strReplaceExpression) },
            { ALT: () => this.SUBRULE(this.existsFunc) },
            { ALT: () => this.SUBRULE(this.notExistsFunc) }
        ]);
    });

    /**
     * Term accessor built-ins: STR, LANG, LANGDIR, DATATYPE, IRI, URI, BNODE
     */
    builtInCallTermAccessors = this.RULE('builtInCallTermAccessors', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.STR);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.LANG_KW);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.LANGMATCHES);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME1(tokens.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.LANGDIR);
                    this.CONSUME4(tokens.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.DATATYPE);
                    this.CONSUME5(tokens.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.IRI_KW);
                    this.CONSUME6(tokens.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME6(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.URI_KW);
                    this.CONSUME7(tokens.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME7(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.BNODE_KW);
                    this.OR2([
                        {
                            ALT: () => {
                                this.CONSUME8(tokens.LPARENT);
                                this.SUBRULE9(this.expression);
                                this.CONSUME8(tokens.RPARENT);
                            }
                        },
                        { ALT: () => this.CONSUME1(tokens.NIL) }
                    ]);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.BOUND);
                    this.CONSUME9(tokens.LPARENT);
                    this.SUBRULE1(this.var);
                    this.CONSUME9(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * String built-ins part 1: STRLEN, UCASE, LCASE, ENCODE_FOR_URI, CONTAINS, STRSTARTS, CONCAT
     */
    builtInCallStringFuncs = this.RULE('builtInCallStringFuncs', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.STRLEN);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.UCASE);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.LCASE);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.ENCODE_FOR_URI);
                    this.CONSUME4(tokens.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.CONTAINS);
                    this.CONSUME5(tokens.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME1(tokens.COMMA);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.STRSTARTS);
                    this.CONSUME6(tokens.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME2(tokens.COMMA);
                    this.SUBRULE8(this.expression);
                    this.CONSUME6(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.CONCAT);
                    this.SUBRULE1(this.expressionList);
                }
            },
            { ALT: () => this.SUBRULE(this.builtInCallStringFuncs2) }
        ]);
    });

    /**
     * String built-ins part 2: STRENDS, STRBEFORE, STRAFTER
     */
    builtInCallStringFuncs2 = this.RULE('builtInCallStringFuncs2', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.STRENDS);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.STRBEFORE);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(tokens.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.STRAFTER);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME3(tokens.COMMA);
                    this.SUBRULE6(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            { ALT: () => this.SUBRULE(this.builtInCallStringFuncs3) }
        ]);
    });

    /**
     * String built-ins part 3: STRLANG, STRLANGDIR, STRDT
     */
    builtInCallStringFuncs3 = this.RULE('builtInCallStringFuncs3', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.STRLANG);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.STRLANGDIR);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(tokens.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(tokens.COMMA);
                    this.SUBRULE5(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.STRDT);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME4(tokens.COMMA);
                    this.SUBRULE7(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * Numeric built-ins: ABS, CEIL, FLOOR, ROUND, RAND
     */
    builtInCallNumericFuncs = this.RULE('builtInCallNumericFuncs', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.ABS_KW);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.CEIL);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.FLOOR);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.ROUND);
                    this.CONSUME4(tokens.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.RAND);
                    this.CONSUME1(tokens.NIL);
                }
            }
        ]);
    });

    /**
     * Date/time built-ins: YEAR, MONTH, DAY, HOURS, MINUTES, SECONDS, TIMEZONE, TZ, NOW
     */
    builtInCallDateTimeFuncs = this.RULE('builtInCallDateTimeFuncs', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.YEAR);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.MONTH);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.DAY);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.HOURS);
                    this.CONSUME4(tokens.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.MINUTES);
                    this.CONSUME5(tokens.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SECONDS);
                    this.CONSUME6(tokens.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME6(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.TIMEZONE);
                    this.CONSUME7(tokens.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME7(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.TZ_KW);
                    this.CONSUME8(tokens.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME8(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.NOW);
                    this.CONSUME2(tokens.NIL);
                }
            }
        ]);
    });

    /**
     * Hash built-ins: MD5, SHA1, SHA256, SHA384, SHA512
     */
    builtInCallHashFuncs = this.RULE('builtInCallHashFuncs', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.MD5);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SHA1);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SHA256);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SHA384);
                    this.CONSUME4(tokens.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SHA512);
                    this.CONSUME5(tokens.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * Test built-ins: sameTerm, isIRI, isURI, isBLANK, isLITERAL, isNUMERIC
     */
    builtInCallTestFuncs = this.RULE('builtInCallTestFuncs', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.SAMETERM);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.ISIRI);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.ISURI);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.ISBLANK);
                    this.CONSUME4(tokens.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.ISLITERAL);
                    this.CONSUME5(tokens.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.ISNUMERIC);
                    this.CONSUME6(tokens.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME6(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * Miscellaneous built-ins: COALESCE, IF, UUID, STRUUID
     */
    builtInCallMiscFuncs = this.RULE('builtInCallMiscFuncs', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.COALESCE);
                    this.SUBRULE1(this.expressionList);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.IF_KW);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(tokens.COMMA);
                    this.SUBRULE3(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.UUID_KW);
                    this.CONSUME1(tokens.NIL);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.STRUUID);
                    this.CONSUME2(tokens.NIL);
                }
            }
        ]);
    });

    /**
     * RDF 1.2 built-ins: isTRIPLE, TRIPLE, SUBJECT, PREDICATE, OBJECT, hasLANG, hasLANGDIR
     */
    builtInCallRdf12Funcs = this.RULE('builtInCallRdf12Funcs', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.ISTRIPLE);
                    this.CONSUME1(tokens.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.TRIPLE_KW);
                    this.CONSUME2(tokens.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(tokens.COMMA);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(tokens.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SUBJECT_KW);
                    this.CONSUME3(tokens.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.PREDICATE_KW);
                    this.CONSUME4(tokens.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.OBJECT_KW);
                    this.CONSUME5(tokens.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME5(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.HASLANG);
                    this.CONSUME6(tokens.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME6(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.HASLANGDIR);
                    this.CONSUME7(tokens.LPARENT);
                    this.SUBRULE9(this.expression);
                    this.CONSUME7(tokens.RPARENT);
                }
            }
        ]);
    });

    /**
     * [132] RegexExpression ::= 'REGEX' '(' Expression ',' Expression (',' Expression)? ')'
     */
    regexExpression = this.RULE('regexExpression', () => {
        this.CONSUME(tokens.REGEX);
        this.CONSUME(tokens.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(tokens.COMMA);
        this.SUBRULE2(this.expression);
        this.OPTION(() => {
            this.CONSUME2(tokens.COMMA);
            this.SUBRULE3(this.expression);
        });
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * [133] SubstringExpression ::= 'SUBSTR' '(' Expression ',' Expression (',' Expression)? ')'
     */
    substringExpression = this.RULE('substringExpression', () => {
        this.CONSUME(tokens.SUBSTR);
        this.CONSUME(tokens.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(tokens.COMMA);
        this.SUBRULE2(this.expression);
        this.OPTION(() => {
            this.CONSUME2(tokens.COMMA);
            this.SUBRULE3(this.expression);
        });
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * [134] StrReplaceExpression ::= 'REPLACE' '(' Expression ',' Expression ',' Expression (',' Expression)? ')'
     */
    strReplaceExpression = this.RULE('strReplaceExpression', () => {
        this.CONSUME(tokens.REPLACE_KW);
        this.CONSUME(tokens.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(tokens.COMMA);
        this.SUBRULE2(this.expression);
        this.CONSUME2(tokens.COMMA);
        this.SUBRULE3(this.expression);
        this.OPTION(() => {
            this.CONSUME3(tokens.COMMA);
            this.SUBRULE4(this.expression);
        });
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * [135] ExistsFunc ::= 'EXISTS' GroupGraphPattern
     */
    existsFunc = this.RULE('existsFunc', () => {
        this.CONSUME(tokens.EXISTS);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [136] NotExistsFunc ::= 'NOT' 'EXISTS' GroupGraphPattern
     */
    notExistsFunc = this.RULE('notExistsFunc', () => {
        this.CONSUME(tokens.NOT);
        this.CONSUME(tokens.EXISTS);
        this.SUBRULE(this.groupGraphPattern);
    });

    // ==========================================
    // Aggregate [137]
    // ==========================================

    /**
     * [137] Aggregate ::= 'COUNT' '(' 'DISTINCT'? ('*' | Expression) ')'
     *       | 'SUM' '(' 'DISTINCT'? Expression ')'
     *       | 'MIN' '(' 'DISTINCT'? Expression ')'
     *       | 'MAX' '(' 'DISTINCT'? Expression ')'
     *       | 'AVG' '(' 'DISTINCT'? Expression ')'
     *       | 'SAMPLE' '(' 'DISTINCT'? Expression ')'
     *       | 'GROUP_CONCAT' '(' 'DISTINCT'? Expression (';' 'SEPARATOR' '=' String)? ')'
     */
    aggregate = this.RULE('aggregate', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(tokens.COUNT);
                    this.CONSUME1(tokens.LPARENT);
                    this.OPTION1(() => this.CONSUME1(tokens.DISTINCT));
                    this.OR2([
                        { ALT: () => this.CONSUME(tokens.STAR) },
                        { ALT: () => this.SUBRULE1(this.expression) }
                    ]);
                    this.CONSUME1(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SUM);
                    this.CONSUME2(tokens.LPARENT);
                    this.OPTION2(() => this.CONSUME2(tokens.DISTINCT));
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.MIN_KW);
                    this.CONSUME3(tokens.LPARENT);
                    this.OPTION3(() => this.CONSUME3(tokens.DISTINCT));
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.MAX_KW);
                    this.CONSUME4(tokens.LPARENT);
                    this.OPTION4(() => this.CONSUME4(tokens.DISTINCT));
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.AVG);
                    this.CONSUME5(tokens.LPARENT);
                    this.OPTION5(() => this.CONSUME5(tokens.DISTINCT));
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.SAMPLE);
                    this.CONSUME6(tokens.LPARENT);
                    this.OPTION6(() => this.CONSUME6(tokens.DISTINCT));
                    this.SUBRULE6(this.expression);
                    this.CONSUME6(tokens.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.GROUP_CONCAT);
                    this.CONSUME7(tokens.LPARENT);
                    this.OPTION7(() => this.CONSUME7(tokens.DISTINCT));
                    this.SUBRULE7(this.expression);
                    this.OPTION8(() => {
                        this.CONSUME(tokens.SEMICOLON);
                        this.CONSUME(tokens.SEPARATOR);
                        this.CONSUME(tokens.EQ);
                        this.SUBRULE(this.string);
                    });
                    this.CONSUME7(tokens.RPARENT);
                }
            }
        ]);
    });

    // ==========================================
    // iri / function call [138]-[139]
    // ==========================================

    /**
     * [138] iriOrFunction ::= iri ArgList?
     */
    iriOrFunction = this.RULE('iriOrFunction', () => {
        this.SUBRULE(this.iri);
        this.OPTION(() => this.SUBRULE(this.argList));
    });

    // ==========================================
    // RDF literal / numeric / boolean [139]-[145]
    // ==========================================

    /**
     * [139] RDFLiteral ::= String (LANG_DIR | '^^' iri)?
     */
    rdfLiteral = this.RULE('rdfLiteral', () => {
        this.SUBRULE(this.string);
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.CONSUME(tokens.LANGTAG) },
                {
                    ALT: () => {
                        this.CONSUME(tokens.DCARET);
                        this.SUBRULE(this.iri);
                    }
                }
            ]);
        });
    });

    /**
     * [140] NumericLiteral ::= NumericLiteralUnsigned | NumericLiteralPositive | NumericLiteralNegative
     */
    numericLiteral = this.RULE('numericLiteral', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.numericLiteralUnsigned) },
            { ALT: () => this.SUBRULE(this.numericLiteralPositive) },
            { ALT: () => this.SUBRULE(this.numericLiteralNegative) }
        ]);
    });

    /**
     * [141] NumericLiteralUnsigned ::= INTEGER | DECIMAL | DOUBLE
     */
    numericLiteralUnsigned = this.RULE('numericLiteralUnsigned', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.INTEGER) },
            { ALT: () => this.CONSUME(tokens.DECIMAL) },
            { ALT: () => this.CONSUME(tokens.DOUBLE) }
        ]);
    });

    /**
     * [142] NumericLiteralPositive ::= INTEGER_POSITIVE | DECIMAL_POSITIVE | DOUBLE_POSITIVE
     */
    numericLiteralPositive = this.RULE('numericLiteralPositive', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.INTEGER_POSITIVE) },
            { ALT: () => this.CONSUME(tokens.DECIMAL_POSITIVE) },
            { ALT: () => this.CONSUME(tokens.DOUBLE_POSITIVE) }
        ]);
    });

    /**
     * [143] NumericLiteralNegative ::= INTEGER_NEGATIVE | DECIMAL_NEGATIVE | DOUBLE_NEGATIVE
     */
    numericLiteralNegative = this.RULE('numericLiteralNegative', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.INTEGER_NEGATIVE) },
            { ALT: () => this.CONSUME(tokens.DECIMAL_NEGATIVE) },
            { ALT: () => this.CONSUME(tokens.DOUBLE_NEGATIVE) }
        ]);
    });

    /**
     * [144] BooleanLiteral ::= 'true' | 'false'
     */
    booleanLiteral = this.RULE('booleanLiteral', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.TRUE) },
            { ALT: () => this.CONSUME(tokens.FALSE) }
        ]);
    });

    /**
     * [145] String ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE | STRING_LITERAL_LONG_QUOTE | STRING_LITERAL_LONG_SINGLE_QUOTE
     */
    string = this.RULE('string', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_SINGLE_QUOTE) },
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_LONG_QUOTE) },
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_LONG_SINGLE_QUOTE) }
        ]);
    });

    // ==========================================
    // IRI / prefixed name [146]-[147]
    // ==========================================

    /**
     * [146] iri ::= IRIREF | PrefixedName
     */
    iri = this.RULE('iri', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.IRIREF) },
            { ALT: () => this.SUBRULE(this.prefixedName) }
        ]);
    });

    /**
     * [147] PrefixedName ::= PNAME_LN | PNAME_NS
     */
    prefixedName = this.RULE('prefixedName', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.PNAME_LN) },
            { ALT: () => this.CONSUME(tokens.PNAME_NS) }
        ]);
    });

    /**
     * [148] BlankNode ::= BLANK_NODE_LABEL | ANON
     */
    blankNode = this.RULE('blankNode', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME(tokens.LBRACKET);
        this.CONSUME(tokens.RBRACKET);
    });

    // ==========================================
    // Var and helper productions
    // ==========================================

    /**
     * Var ::= VAR1 | VAR2
     */
    var = this.RULE('var', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.VAR1) },
            { ALT: () => this.CONSUME(tokens.VAR2) }
        ]);
    });

    /**
     * VarOrTerm ::= Var | GraphTerm
     */
    varOrTerm = this.RULE('varOrTerm', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.var) },
            { ALT: () => this.SUBRULE(this.graphTerm) }
        ]);
    });

    /**
     * VarOrIri ::= Var | iri
     */
    varOrIri = this.RULE('varOrIri', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.var) },
            { ALT: () => this.SUBRULE(this.iri) }
        ]);
    });

    /**
     * GraphTerm ::= iri | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode | NIL | TripleTerm
     */
    graphTerm = this.RULE('graphTerm', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.CONSUME(tokens.NIL) },
            { ALT: () => this.SUBRULE(this.tripleTerm) }
        ]);
    });

    /**
     * Literal ::= RDFLiteral | NumericLiteral | BooleanLiteral
     */
    literal = this.RULE('literal', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.rdfLiteral) },
            { ALT: () => this.SUBRULE(this.numericLiteral) },
            { ALT: () => this.SUBRULE(this.booleanLiteral) }
        ]);
    });

    // ==========================================
    // Graph node productions
    // ==========================================

    /**
     * [113] GraphNode ::= VarOrTerm | TriplesNode | ReifiedTriple
     */
    graphNode = this.RULE('graphNode', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.varOrTerm) },
            { ALT: () => this.SUBRULE(this.triplesNode) },
            { ALT: () => this.SUBRULE(this.reifiedTriple) }
        ]);
    });

    /**
     * [114] GraphNodePath ::= VarOrTerm | TriplesNodePath | ReifiedTriple
     */
    graphNodePath = this.RULE('graphNodePath', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.varOrTerm) },
            { ALT: () => this.SUBRULE(this.triplesNodePath) },
            { ALT: () => this.SUBRULE(this.reifiedTriple) }
        ]);
    });

    /**
     * TriplesNode ::= Collection | BlankNodePropertyList
     */
    triplesNode = this.RULE('triplesNode', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.collection) },
            { ALT: () => this.SUBRULE(this.blankNodePropertyList) }
        ]);
    });

    /**
     * BlankNodePropertyList ::= '[' PropertyListNotEmpty ']'
     */
    blankNodePropertyList = this.RULE('blankNodePropertyList', () => {
        this.CONSUME(tokens.LBRACKET);
        this.SUBRULE(this.propertyListNotEmpty);
        this.CONSUME(tokens.RBRACKET);
    });

    /**
     * TriplesNodePath ::= CollectionPath | BlankNodePropertyListPath
     */
    triplesNodePath = this.RULE('triplesNodePath', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.collectionPath) },
            { ALT: () => this.SUBRULE(this.blankNodePropertyListPath) }
        ]);
    });

    /**
     * BlankNodePropertyListPath ::= '[' PropertyListPathNotEmpty ']'
     */
    blankNodePropertyListPath = this.RULE('blankNodePropertyListPath', () => {
        this.CONSUME(tokens.LBRACKET);
        this.SUBRULE(this.propertyListPathNotEmpty);
        this.CONSUME(tokens.RBRACKET);
    });

    /**
     * Collection ::= '(' GraphNode+ ')'
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(tokens.LPARENT);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.graphNode));
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * CollectionPath ::= '(' GraphNodePath+ ')'
     */
    collectionPath = this.RULE('collectionPath', () => {
        this.CONSUME(tokens.LPARENT);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.graphNodePath));
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * ValuesClause ::= ('VALUES' DataBlock)?
     */
    valuesClause = this.RULE('valuesClause', () => {
        this.OPTION(() => {
            this.CONSUME(tokens.VALUES);
            this.SUBRULE(this.dataBlock);
        });
    });
}
