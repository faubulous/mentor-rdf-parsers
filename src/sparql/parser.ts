import { Lexer, CstParser, IToken, CstNode, TokenType } from 'chevrotain';
import { TOKENS } from '../tokens.js';
import { IParser } from '../syntax.js';

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
    TOKENS.WS,
    TOKENS.COMMENT,

    // Multi-char operators/punctuation (before single-char)
    TOKENS.DCARET,         // ^^ before CARET
    TOKENS.CARET,          // ^ (inverse path)
    TOKENS.AND,            // &&
    TOKENS.OR,             // || before PIPE |
    TOKENS.NEQ,            // != before BANG !
    TOKENS.LTE,            // <= before LT <
    TOKENS.GTE,            // >= before GT >
    TOKENS.OPEN_ANNOTATION,    // {| before LCURLY {
    TOKENS.CLOSE_ANNOTATION,   // |} before PIPE |
    TOKENS.OPEN_TRIPLE_TERM,   // <<( before OPEN_REIFIED_TRIPLE <<
    TOKENS.CLOSE_TRIPLE_TERM,  // )>> before RPARENT )
    TOKENS.OPEN_REIFIED_TRIPLE, // <<
    TOKENS.CLOSE_REIFIED_TRIPLE, // >>

    // Punctuation
    TOKENS.TILDE,
    TOKENS.COMMA,
    TOKENS.SEMICOLON,
    TOKENS.PERIOD,
    TOKENS.LBRACKET,
    TOKENS.RBRACKET,
    TOKENS.NIL,            // () before LPARENT ( and RPARENT )
    TOKENS.LPARENT,
    TOKENS.RPARENT,
    TOKENS.LCURLY,
    TOKENS.RCURLY,

    // SPARQL variables (before QUESTION_MARK to avoid ?name → ? + name)
    TOKENS.VAR1,
    TOKENS.VAR2,

    // IRIs must come before LT/GT to avoid <http://...> being split into < + http: + ...
    TOKENS.IRIREF,

    TOKENS.STAR,
    TOKENS.SLASH,
    TOKENS.PIPE,
    TOKENS.PLUS_SIGN,
    TOKENS.MINUS_SIGN,
    TOKENS.BANG,
    TOKENS.EQ,
    TOKENS.LT,
    TOKENS.GT,
    TOKENS.QUESTION_MARK,

    // Boolean literals
    TOKENS.TRUE,
    TOKENS.FALSE,

    // RDF literal keywords
    TOKENS.A,

    // SPARQL aggregate keywords (longer first)
    TOKENS.GROUP_CONCAT,

    // SPARQL built-in functions (longer/more specific first)
    TOKENS.ENCODE_FOR_URI,
    TOKENS.LANGMATCHES,
    TOKENS.LANGDIR,
    TOKENS.STRLANGDIR,
    TOKENS.STRLANG,
    TOKENS.STRSTARTS,
    TOKENS.STRENDS,
    TOKENS.STRBEFORE,
    TOKENS.STRAFTER,
    TOKENS.STRLEN,
    TOKENS.STRUUID,
    TOKENS.STRDT,
    TOKENS.STR,
    TOKENS.LANG_KW,
    TOKENS.DATATYPE,
    TOKENS.BOUND,
    TOKENS.IRI_KW,
    TOKENS.URI_KW,
    TOKENS.BNODE_KW,
    TOKENS.RAND,
    TOKENS.ABS_KW,
    TOKENS.CEIL,
    TOKENS.FLOOR,
    TOKENS.ROUND,
    TOKENS.CONCAT,
    TOKENS.UCASE,
    TOKENS.LCASE,
    TOKENS.CONTAINS,
    TOKENS.YEAR,
    TOKENS.MONTH,
    TOKENS.DAY,
    TOKENS.HOURS,
    TOKENS.MINUTES,
    TOKENS.SECONDS,
    TOKENS.TIMEZONE,
    TOKENS.TZ_KW,
    TOKENS.NOW,
    TOKENS.UUID_KW,
    TOKENS.MD5,
    TOKENS.SHA256,
    TOKENS.SHA384,
    TOKENS.SHA512,
    TOKENS.SHA1,
    TOKENS.COALESCE,
    TOKENS.IF_KW,
    TOKENS.SAMETERM,
    TOKENS.ISIRI,
    TOKENS.ISURI,
    TOKENS.ISBLANK,
    TOKENS.ISLITERAL,
    TOKENS.ISNUMERIC,
    TOKENS.ISTRIPLE,
    TOKENS.TRIPLE_KW,
    TOKENS.SUBJECT_KW,
    TOKENS.PREDICATE_KW,
    TOKENS.OBJECT_KW,
    TOKENS.HASLANGDIR,
    TOKENS.HASLANG,
    TOKENS.REGEX,
    TOKENS.SUBSTR,
    TOKENS.REPLACE_KW,

    // SPARQL aggregate keywords
    TOKENS.COUNT,
    TOKENS.SAMPLE,
    TOKENS.SUM,
    TOKENS.MIN_KW,
    TOKENS.MAX_KW,
    TOKENS.AVG,
    TOKENS.SEPARATOR,

    // SPARQL keywords (longer first)
    TOKENS.CONSTRUCT,
    TOKENS.DESCRIBE,
    TOKENS.DISTINCT,
    TOKENS.OPTIONAL_KW,
    TOKENS.REDUCED,
    TOKENS.SELECT,
    TOKENS.SERVICE,
    TOKENS.DEFAULT_KW,
    TOKENS.DELETE_KW,
    TOKENS.EXISTS,
    TOKENS.FILTER,
    TOKENS.HAVING,
    TOKENS.INSERT,
    TOKENS.OFFSET,
    TOKENS.SILENT,
    TOKENS.VALUES,
    TOKENS.CREATE_KW,
    TOKENS.MINUS_KW,
    TOKENS.NAMED,
    TOKENS.ORDER,
    TOKENS.CLEAR,
    TOKENS.GROUP,
    TOKENS.LIMIT,
    TOKENS.UNION,
    TOKENS.UNDEF,
    TOKENS.USING,
    TOKENS.WHERE,
    TOKENS.WITH_KW,
    TOKENS.BIND_KW,
    TOKENS.COPY,
    TOKENS.DATA,
    TOKENS.DROP,
    TOKENS.FROM,
    TOKENS.INTO,
    TOKENS.LOAD,
    TOKENS.MOVE,
    TOKENS.ADD_KW,
    TOKENS.ALL_KW,
    TOKENS.ASC_KW,
    TOKENS.ASK,
    TOKENS.DESC_KW,
    TOKENS.NOT,
    TOKENS.AS_KW,
    TOKENS.BY,
    TOKENS.IN_KW,
    TOKENS.TO,

    // Directives
    TOKENS.SPARQL_VERSION,
    TOKENS.PREFIX,
    TOKENS.BASE,
    TOKENS.GRAPH,

    // RDF terms
    TOKENS.PNAME_LN,
    TOKENS.PNAME_NS,
    TOKENS.BLANK_NODE_LABEL,
    TOKENS.LANGTAG,

    // Numeric literals (more specific first)
    TOKENS.DOUBLE_POSITIVE,
    TOKENS.DECIMAL_POSITIVE,
    TOKENS.INTEGER_POSITIVE,
    TOKENS.DOUBLE_NEGATIVE,
    TOKENS.DECIMAL_NEGATIVE,
    TOKENS.INTEGER_NEGATIVE,
    TOKENS.DOUBLE,
    TOKENS.DECIMAL,
    TOKENS.INTEGER,

    // String literals (long before short)
    TOKENS.STRING_LITERAL_LONG_SINGLE_QUOTE,
    TOKENS.STRING_LITERAL_LONG_QUOTE,
    TOKENS.STRING_LITERAL_SINGLE_QUOTE,
    TOKENS.STRING_LITERAL_QUOTE,
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
export class SparqlParser extends CstParser implements IParser {
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
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed document.
     * @param tokens A set of tokens created by the lexer.
     * @param throwOnErrors Whether to throw an error if any parsing errors are detected. Defaults to true.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(tokens: IToken[], throwOnErrors: boolean = true): CstNode {
        this.input = tokens;

        const cst = this.queryOrUpdate();

        if (throwOnErrors && this.errors.length > 0) {
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
        this.CONSUME(TOKENS.BASE);
        this.CONSUME(TOKENS.IRIREF);
    });

    /**
     * [6] PrefixDecl ::= 'PREFIX' PNAME_NS IRIREF
     */
    prefixDecl = this.RULE('prefixDecl', () => {
        this.CONSUME(TOKENS.PREFIX);
        const prefix = this.CONSUME(TOKENS.PNAME_NS);
        const iri = this.CONSUME(TOKENS.IRIREF);
        this.registerNamespace(prefix, iri);
    });

    /**
     * [7] VersionDecl ::= 'VERSION' VersionSpecifier
     */
    versionDecl = this.RULE('versionDecl', () => {
        this.CONSUME(TOKENS.SPARQL_VERSION);
        this.SUBRULE(this.versionSpecifier);
    });

    /**
     * [8] VersionSpecifier ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE
     */
    versionSpecifier = this.RULE('versionSpecifier', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(TOKENS.STRING_LITERAL_SINGLE_QUOTE) }
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
        this.CONSUME(TOKENS.SELECT);
        this.OPTION(() => {
            this.OR1([
                { ALT: () => this.CONSUME(TOKENS.DISTINCT) },
                { ALT: () => this.CONSUME(TOKENS.REDUCED) }
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
                                    this.CONSUME(TOKENS.LPARENT);
                                    this.SUBRULE(this.expression);
                                    this.CONSUME(TOKENS.AS_KW);
                                    this.SUBRULE2(this.var);
                                    this.CONSUME(TOKENS.RPARENT);
                                }
                            }
                        ]);
                    });
                }
            },
            { ALT: () => this.CONSUME(TOKENS.STAR) }
        ]);
    });

    /**
     * [12] ConstructQuery ::= 'CONSTRUCT' (ConstructTemplate DatasetClause* WhereClause SolutionModifier
     *                       | DatasetClause* 'WHERE' '{' TriplesTemplate? '}' SolutionModifier)
     */
    constructQuery = this.RULE('constructQuery', () => {
        this.CONSUME(TOKENS.CONSTRUCT);
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
                    this.CONSUME(TOKENS.WHERE);
                    this.CONSUME(TOKENS.LCURLY);
                    this.OPTION(() => this.SUBRULE(this.triplesTemplate));
                    this.CONSUME(TOKENS.RCURLY);
                    this.SUBRULE2(this.solutionModifier);
                }
            }
        ]);
    });

    /**
     * [13] DescribeQuery ::= 'DESCRIBE' (VarOrIri+ | '*') DatasetClause* WhereClause? SolutionModifier
     */
    describeQuery = this.RULE('describeQuery', () => {
        this.CONSUME(TOKENS.DESCRIBE);
        this.OR([
            { ALT: () => this.AT_LEAST_ONE(() => this.SUBRULE(this.varOrIri)) },
            { ALT: () => this.CONSUME(TOKENS.STAR) }
        ]);
        this.MANY(() => this.SUBRULE(this.datasetClause));
        this.OPTION(() => this.SUBRULE(this.whereClause));
        this.SUBRULE(this.solutionModifier);
    });

    /**
     * [14] AskQuery ::= 'ASK' DatasetClause* WhereClause SolutionModifier
     */
    askQuery = this.RULE('askQuery', () => {
        this.CONSUME(TOKENS.ASK);
        this.MANY(() => this.SUBRULE(this.datasetClause));
        this.SUBRULE(this.whereClause);
        this.SUBRULE(this.solutionModifier);
    });

    /**
     * [15] DatasetClause ::= 'FROM' (DefaultGraphClause | NamedGraphClause)
     */
    datasetClause = this.RULE('datasetClause', () => {
        this.CONSUME(TOKENS.FROM);
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
        this.CONSUME(TOKENS.NAMED);
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
        this.OPTION(() => this.CONSUME(TOKENS.WHERE));
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
        this.CONSUME(TOKENS.GROUP);
        this.CONSUME(TOKENS.BY);
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
                    this.CONSUME(TOKENS.LPARENT);
                    this.SUBRULE(this.expression);
                    this.OPTION(() => {
                        this.CONSUME(TOKENS.AS_KW);
                        this.SUBRULE(this.var);
                    });
                    this.CONSUME(TOKENS.RPARENT);
                }
            },
            { ALT: () => this.SUBRULE2(this.var) }
        ]);
    });

    /**
     * [23] HavingClause ::= 'HAVING' HavingCondition+
     */
    havingClause = this.RULE('havingClause', () => {
        this.CONSUME(TOKENS.HAVING);
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
        this.CONSUME(TOKENS.ORDER);
        this.CONSUME(TOKENS.BY);
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
                        { ALT: () => this.CONSUME(TOKENS.ASC_KW) },
                        { ALT: () => this.CONSUME(TOKENS.DESC_KW) }
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
        this.CONSUME(TOKENS.LIMIT);
        this.CONSUME(TOKENS.INTEGER);
    });

    /**
     * [29] OffsetClause ::= 'OFFSET' INTEGER
     */
    offsetClause = this.RULE('offsetClause', () => {
        this.CONSUME(TOKENS.OFFSET);
        this.CONSUME(TOKENS.INTEGER);
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
                this.CONSUME(TOKENS.SEMICOLON);
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
        this.CONSUME(TOKENS.LOAD);
        this.OPTION1(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE(this.iri);
        this.OPTION2(() => {
            this.CONSUME(TOKENS.INTO);
            this.SUBRULE(this.graphRef);
        });
    });

    /**
     * [34] Clear ::= 'CLEAR' 'SILENT'? GraphRefAll
     */
    clear = this.RULE('clear', () => {
        this.CONSUME(TOKENS.CLEAR);
        this.OPTION(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE(this.graphRefAll);
    });

    /**
     * [35] Drop ::= 'DROP' 'SILENT'? GraphRefAll
     */
    drop = this.RULE('drop', () => {
        this.CONSUME(TOKENS.DROP);
        this.OPTION(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE(this.graphRefAll);
    });

    /**
     * [36] Create ::= 'CREATE' 'SILENT'? GraphRef
     */
    create = this.RULE('create', () => {
        this.CONSUME(TOKENS.CREATE_KW);
        this.OPTION(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE(this.graphRef);
    });

    /**
     * [37] Add ::= 'ADD' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    add = this.RULE('add', () => {
        this.CONSUME(TOKENS.ADD_KW);
        this.OPTION(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(TOKENS.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [38] Move ::= 'MOVE' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    move = this.RULE('move', () => {
        this.CONSUME(TOKENS.MOVE);
        this.OPTION(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(TOKENS.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [39] Copy ::= 'COPY' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    copy = this.RULE('copy', () => {
        this.CONSUME(TOKENS.COPY);
        this.OPTION(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(TOKENS.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [40] InsertData ::= 'INSERT' 'DATA' QuadData
     */
    insertData = this.RULE('insertData', () => {
        this.CONSUME(TOKENS.INSERT);
        this.CONSUME(TOKENS.DATA);
        this.SUBRULE(this.quadData);
    });

    /**
     * [41] DeleteData ::= 'DELETE' 'DATA' QuadData
     */
    deleteData = this.RULE('deleteData', () => {
        this.CONSUME(TOKENS.DELETE_KW);
        this.CONSUME(TOKENS.DATA);
        const prev = this._insideDeleteBlock;
        this._insideDeleteBlock = true;
        this.SUBRULE(this.quadData);
        this._insideDeleteBlock = prev;
    });

    /**
     * [42] DeleteWhere ::= 'DELETE' 'WHERE' QuadPattern
     */
    deleteWhere = this.RULE('deleteWhere', () => {
        this.CONSUME(TOKENS.DELETE_KW);
        this.CONSUME(TOKENS.WHERE);
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
            this.CONSUME(TOKENS.WITH_KW);
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
        this.CONSUME(TOKENS.WHERE);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [44] DeleteClause ::= 'DELETE' QuadPattern
     */
    deleteClause = this.RULE('deleteClause', () => {
        this.CONSUME(TOKENS.DELETE_KW);
        const prev = this._insideDeleteBlock;
        this._insideDeleteBlock = true;
        this.SUBRULE(this.quadPattern);
        this._insideDeleteBlock = prev;
    });

    /**
     * [45] InsertClause ::= 'INSERT' QuadPattern
     */
    insertClause = this.RULE('insertClause', () => {
        this.CONSUME(TOKENS.INSERT);
        this.SUBRULE(this.quadPattern);
    });

    /**
     * [46] UsingClause ::= 'USING' (iri | 'NAMED' iri)
     */
    usingClause = this.RULE('usingClause', () => {
        this.CONSUME(TOKENS.USING);
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(TOKENS.NAMED);
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
            { ALT: () => this.CONSUME(TOKENS.DEFAULT_KW) },
            {
                ALT: () => {
                    this.OPTION(() => this.CONSUME(TOKENS.GRAPH));
                    this.SUBRULE(this.iri);
                }
            }
        ]);
    });

    /**
     * [48] GraphRef ::= 'GRAPH' iri
     */
    graphRef = this.RULE('graphRef', () => {
        this.CONSUME(TOKENS.GRAPH);
        this.SUBRULE(this.iri);
    });

    /**
     * [49] GraphRefAll ::= GraphRef | 'DEFAULT' | 'NAMED' | 'ALL'
     */
    graphRefAll = this.RULE('graphRefAll', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.graphRef) },
            { ALT: () => this.CONSUME(TOKENS.DEFAULT_KW) },
            { ALT: () => this.CONSUME(TOKENS.NAMED) },
            { ALT: () => this.CONSUME(TOKENS.ALL_KW) }
        ]);
    });

    // ==========================================
    // Quad productions [50]-[54]
    // ==========================================

    /**
     * [50] QuadPattern ::= '{' Quads '}'
     */
    quadPattern = this.RULE('quadPattern', () => {
        this.CONSUME(TOKENS.LCURLY);
        this.SUBRULE(this.quads);
        this.CONSUME(TOKENS.RCURLY);
    });

    /**
     * [51] QuadData ::= '{' Quads '}'
     */
    quadData = this.RULE('quadData', () => {
        this.CONSUME(TOKENS.LCURLY);
        this.SUBRULE(this.quads);
        this.CONSUME(TOKENS.RCURLY);
    });

    /**
     * [52] Quads ::= TriplesTemplate? (QuadsNotTriples '.'? TriplesTemplate?)*
     */
    quads = this.RULE('quads', () => {
        this.OPTION1(() => this.SUBRULE1(this.triplesTemplate));
        this.MANY(() => {
            this.SUBRULE(this.quadsNotTriples);
            this.OPTION2(() => this.CONSUME(TOKENS.PERIOD));
            this.OPTION3(() => this.SUBRULE2(this.triplesTemplate));
        });
    });

    /**
     * [53] QuadsNotTriples ::= 'GRAPH' VarOrIri '{' TriplesTemplate? '}'
     */
    quadsNotTriples = this.RULE('quadsNotTriples', () => {
        this.CONSUME(TOKENS.GRAPH);
        this.SUBRULE(this.varOrIri);
        this.CONSUME(TOKENS.LCURLY);
        this.OPTION(() => this.SUBRULE(this.triplesTemplate));
        this.CONSUME(TOKENS.RCURLY);
    });

    /**
     * [54] TriplesTemplate ::= TriplesSameSubject ('.' TriplesTemplate?)?
     */
    triplesTemplate = this.RULE('triplesTemplate', () => {
        this.SUBRULE(this.triplesSameSubject);
        this.OPTION(() => {
            this.CONSUME(TOKENS.PERIOD);
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
        this.CONSUME(TOKENS.LCURLY);
        this.OR([
            { ALT: () => this.SUBRULE(this.subSelect) },
            { ALT: () => this.SUBRULE(this.groupGraphPatternSub) }
        ]);
        this.CONSUME(TOKENS.RCURLY);
    });

    /**
     * [56] GroupGraphPatternSub ::= TriplesBlock? (GraphPatternNotTriples '.'? TriplesBlock?)*
     */
    groupGraphPatternSub = this.RULE('groupGraphPatternSub', () => {
        this.OPTION1(() => this.SUBRULE1(this.triplesBlock));
        this.MANY(() => {
            this.SUBRULE(this.graphPatternNotTriples);
            this.OPTION2(() => this.CONSUME(TOKENS.PERIOD));
            this.OPTION3(() => this.SUBRULE2(this.triplesBlock));
        });
    });

    /**
     * [57] TriplesBlock ::= TriplesSameSubjectPath ('.' TriplesBlock?)?
     */
    triplesBlock = this.RULE('triplesBlock', () => {
        this.SUBRULE(this.triplesSameSubjectPath);
        this.OPTION(() => {
            this.CONSUME(TOKENS.PERIOD);
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
        this.CONSUME(TOKENS.OPTIONAL_KW);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [61] GraphGraphPattern ::= 'GRAPH' VarOrIri GroupGraphPattern
     */
    graphGraphPattern = this.RULE('graphGraphPattern', () => {
        this.CONSUME(TOKENS.GRAPH);
        this.SUBRULE(this.varOrIri);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [62] ServiceGraphPattern ::= 'SERVICE' 'SILENT'? VarOrIri GroupGraphPattern
     */
    serviceGraphPattern = this.RULE('serviceGraphPattern', () => {
        this.CONSUME(TOKENS.SERVICE);
        this.OPTION(() => this.CONSUME(TOKENS.SILENT));
        this.SUBRULE(this.varOrIri);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [63] Bind ::= 'BIND' '(' Expression 'AS' Var ')'
     */
    bind = this.RULE('bind', () => {
        this.CONSUME(TOKENS.BIND_KW);
        this.CONSUME(TOKENS.LPARENT);
        this.SUBRULE(this.expression);
        this.CONSUME(TOKENS.AS_KW);
        this.SUBRULE(this.var);
        this.CONSUME(TOKENS.RPARENT);
    });

    /**
     * [64] InlineData ::= 'VALUES' DataBlock
     */
    inlineData = this.RULE('inlineData', () => {
        this.CONSUME(TOKENS.VALUES);
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
        this.CONSUME(TOKENS.LCURLY);
        this.MANY(() => this.SUBRULE(this.dataBlockValue));
        this.CONSUME(TOKENS.RCURLY);
    });

    /**
     * [67] InlineDataFull ::= (NIL | '(' Var* ')') '{' ('(' DataBlockValue* ')' | NIL)* '}'
     */
    inlineDataFull = this.RULE('inlineDataFull', () => {
        this.OR1([
            { ALT: () => this.CONSUME1(TOKENS.NIL) },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.LPARENT);
                    this.MANY1(() => this.SUBRULE(this.var));
                    this.CONSUME(TOKENS.RPARENT);
                }
            }
        ]);
        this.CONSUME(TOKENS.LCURLY);
        this.MANY2(() => {
            this.OR2([
                {
                    ALT: () => {
                        this.CONSUME2(TOKENS.LPARENT);
                        this.MANY3(() => this.SUBRULE(this.dataBlockValue));
                        this.CONSUME2(TOKENS.RPARENT);
                    }
                },
                { ALT: () => this.CONSUME2(TOKENS.NIL) }
            ]);
        });
        this.CONSUME(TOKENS.RCURLY);
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
            { ALT: () => this.CONSUME(TOKENS.UNDEF) },
            { ALT: () => this.SUBRULE(this.tripleTermData) }
        ]);
    });

    /**
     * [69] MinusGraphPattern ::= 'MINUS' GroupGraphPattern
     */
    minusGraphPattern = this.RULE('minusGraphPattern', () => {
        this.CONSUME(TOKENS.MINUS_KW);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [70] GroupOrUnionGraphPattern ::= GroupGraphPattern ('UNION' GroupGraphPattern)*
     */
    groupOrUnionGraphPattern = this.RULE('groupOrUnionGraphPattern', () => {
        this.SUBRULE1(this.groupGraphPattern);
        this.MANY(() => {
            this.CONSUME(TOKENS.UNION);
            this.SUBRULE2(this.groupGraphPattern);
        });
    });

    /**
     * [71] Filter ::= 'FILTER' Constraint
     */
    filter = this.RULE('filter', () => {
        this.CONSUME(TOKENS.FILTER);
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
            { ALT: () => this.CONSUME(TOKENS.NIL) },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.LPARENT);
                    this.OPTION(() => this.CONSUME(TOKENS.DISTINCT));
                    this.SUBRULE1(this.expression);
                    this.MANY(() => {
                        this.CONSUME(TOKENS.COMMA);
                        this.SUBRULE2(this.expression);
                    });
                    this.CONSUME(TOKENS.RPARENT);
                }
            }
        ]);
    });

    /**
     * [75] ExpressionList ::= NIL | '(' Expression (',' Expression)* ')'
     */
    expressionList = this.RULE('expressionList', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.NIL) },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.MANY(() => {
                        this.CONSUME(TOKENS.COMMA);
                        this.SUBRULE2(this.expression);
                    });
                    this.CONSUME(TOKENS.RPARENT);
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
        this.CONSUME(TOKENS.LCURLY);
        this.OPTION(() => this.SUBRULE(this.constructTriples));
        this.CONSUME(TOKENS.RCURLY);
    });

    /**
     * [77] ConstructTriples ::= TriplesSameSubject ('.' ConstructTriples?)?
     */
    constructTriples = this.RULE('constructTriples', () => {
        this.SUBRULE(this.triplesSameSubject);
        this.OPTION(() => {
            this.CONSUME(TOKENS.PERIOD);
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
            this.CONSUME(TOKENS.SEMICOLON);
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
            { ALT: () => this.CONSUME(TOKENS.A) }
        ]);
    });

    /**
     * [85] ObjectList ::= Object (',' Object)*
     */
    objectList = this.RULE('objectList', () => {
        this.SUBRULE1(this.graphObject);
        this.MANY(() => {
            this.CONSUME(TOKENS.COMMA);
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
            this.CONSUME(TOKENS.SEMICOLON);
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
            this.CONSUME(TOKENS.COMMA);
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
            this.CONSUME(TOKENS.PIPE);
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
            this.CONSUME(TOKENS.SLASH);
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
                    this.CONSUME(TOKENS.CARET);
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
            { ALT: () => this.CONSUME(TOKENS.QUESTION_MARK) },
            { ALT: () => this.CONSUME(TOKENS.STAR) },
            { ALT: () => this.CONSUME(TOKENS.PLUS_SIGN) }
        ]);
    });

    /**
     * [97] PathPrimary ::= iri | 'a' | '!' PathNegatedPropertySet | '(' Path ')'
     */
    pathPrimary = this.RULE('pathPrimary', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.CONSUME(TOKENS.A) },
            {
                ALT: () => {
                    this._verbIsSimplePath = false;
                    this.CONSUME(TOKENS.BANG);
                    this.SUBRULE(this.pathNegatedPropertySet);
                }
            },
            {
                ALT: () => {
                    this._verbIsSimplePath = false;
                    this.CONSUME(TOKENS.LPARENT);
                    this.SUBRULE(this.path);
                    this.CONSUME(TOKENS.RPARENT);
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
                    this.CONSUME(TOKENS.LPARENT);
                    this.OPTION(() => {
                        this.SUBRULE2(this.pathOneInPropertySet);
                        this.MANY(() => {
                            this.CONSUME(TOKENS.PIPE);
                            this.SUBRULE3(this.pathOneInPropertySet);
                        });
                    });
                    this.CONSUME(TOKENS.RPARENT);
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
            { ALT: () => this.CONSUME(TOKENS.A) },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.CARET);
                    this.OR2([
                        { ALT: () => this.SUBRULE2(this.iri) },
                        { ALT: () => this.CONSUME2(TOKENS.A) }
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
        this.CONSUME(TOKENS.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.reifiedTripleSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.reifiedTripleObject);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(TOKENS.CLOSE_REIFIED_TRIPLE);
    });

    /**
     * [103] ReifiedTriplePath ::= '<<' ReifiedTripleSubject VerbPath ReifiedTripleObjectPath Reifier? '>>'
     */
    reifiedTriplePath = this.RULE('reifiedTriplePath', () => {
        this.CONSUME(TOKENS.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.reifiedTripleSubject);
        this.SUBRULE(this.verbPath);
        this.SUBRULE(this.reifiedTripleObjectPath);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(TOKENS.CLOSE_REIFIED_TRIPLE);
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
        this.CONSUME(TOKENS.OPEN_ANNOTATION);
        this.SUBRULE(this.propertyListPathNotEmpty);
        this.CONSUME(TOKENS.CLOSE_ANNOTATION);
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
                {
                    ALT: () => {
                        this.SUBRULE(this.reifier);
                        hasNamedReifier = true;
                    }
                },
                {
                    ALT: () => {
                        if (this._insideDeleteBlock && !hasNamedReifier) {
                            throw new Error('Anonymous reifiers (annotation blocks without a named reifier) are not allowed in DELETE blocks (grammar note 7: no blank nodes)');
                        }
                        this.SUBRULE(this.annotationBlock);
                        hasNamedReifier = false;
                    }
                }
            ]);
        });
    });

    /**
     * [110] AnnotationBlock ::= '{|' PropertyListNotEmpty '|}'
     */
    annotationBlock = this.RULE('annotationBlock', () => {
        this.CONSUME(TOKENS.OPEN_ANNOTATION);
        this.SUBRULE(this.propertyListNotEmpty);
        this.CONSUME(TOKENS.CLOSE_ANNOTATION);
    });

    /**
     * [111] Reifier ::= '~' VarOrReifierId?
     */
    reifier = this.RULE('reifier', () => {
        this.CONSUME(TOKENS.TILDE);
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
        this.CONSUME(TOKENS.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.tripleTermSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.tripleTermObject);
        this.CONSUME(TOKENS.CLOSE_TRIPLE_TERM);
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
        this.CONSUME(TOKENS.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.tripleTermDataSubject);
        this.OR([
            { ALT: () => this.SUBRULE1(this.iri) },
            { ALT: () => this.CONSUME(TOKENS.A) }
        ]);
        this.SUBRULE(this.tripleTermDataObject);
        this.CONSUME(TOKENS.CLOSE_TRIPLE_TERM);
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
            this.CONSUME(TOKENS.OR);
            this.SUBRULE2(this.conditionalAndExpression);
        });
    });

    /**
     * [121] ConditionalAndExpression ::= ValueLogical ('&&' ValueLogical)*
     */
    conditionalAndExpression = this.RULE('conditionalAndExpression', () => {
        this.SUBRULE1(this.valueLogical);
        this.MANY(() => {
            this.CONSUME(TOKENS.AND);
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
                { ALT: () => { this.CONSUME(TOKENS.EQ); this.SUBRULE2(this.numericExpression); } },
                { ALT: () => { this.CONSUME(TOKENS.NEQ); this.SUBRULE3(this.numericExpression); } },
                { ALT: () => { this.CONSUME(TOKENS.LT); this.SUBRULE4(this.numericExpression); } },
                { ALT: () => { this.CONSUME(TOKENS.GT); this.SUBRULE5(this.numericExpression); } },
                { ALT: () => { this.CONSUME(TOKENS.LTE); this.SUBRULE6(this.numericExpression); } },
                { ALT: () => { this.CONSUME(TOKENS.GTE); this.SUBRULE7(this.numericExpression); } },
                { ALT: () => { this.CONSUME(TOKENS.IN_KW); this.SUBRULE1(this.expressionList); } },
                { ALT: () => { this.CONSUME(TOKENS.NOT); this.CONSUME2(TOKENS.IN_KW); this.SUBRULE2(this.expressionList); } }
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
                        this.CONSUME(TOKENS.PLUS_SIGN);
                        this.SUBRULE2(this.multiplicativeExpression);
                    }
                },
                {
                    ALT: () => {
                        this.CONSUME(TOKENS.MINUS_SIGN);
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
                                { ALT: () => { this.CONSUME(TOKENS.STAR); this.SUBRULE1(this.unaryExpression); } },
                                { ALT: () => { this.CONSUME(TOKENS.SLASH); this.SUBRULE2(this.unaryExpression); } }
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
                { ALT: () => { this.CONSUME(TOKENS.STAR); this.SUBRULE2(this.unaryExpression); } },
                { ALT: () => { this.CONSUME(TOKENS.SLASH); this.SUBRULE3(this.unaryExpression); } }
            ]);
        });
    });

    /**
     * [135] UnaryExpression ::= '!' UnaryExpression | '+' PrimaryExpression | '-' PrimaryExpression | PrimaryExpression
     */
    unaryExpression = this.RULE('unaryExpression', () => {
        this.OR([
            { ALT: () => { this.CONSUME(TOKENS.BANG); this.SUBRULE1(this.unaryExpression); } },
            { ALT: () => { this.CONSUME(TOKENS.PLUS_SIGN); this.SUBRULE2(this.primaryExpression); } },
            { ALT: () => { this.CONSUME(TOKENS.MINUS_SIGN); this.SUBRULE3(this.primaryExpression); } },
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
        this.CONSUME(TOKENS.LPARENT);
        this.SUBRULE(this.expression);
        this.CONSUME(TOKENS.RPARENT);
    });

    /**
     * [137] ExprTripleTerm ::= '<<(' ExprTripleTermSubject Verb ExprTripleTermObject ')>>'
     */
    exprTripleTerm = this.RULE('exprTripleTerm', () => {
        this.CONSUME(TOKENS.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.exprTripleTermSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.exprTripleTermObject);
        this.CONSUME(TOKENS.CLOSE_TRIPLE_TERM);
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
                    this.CONSUME(TOKENS.STR);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.LANG_KW);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.LANGMATCHES);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME1(TOKENS.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.LANGDIR);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.DATATYPE);
                    this.CONSUME5(TOKENS.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.IRI_KW);
                    this.CONSUME6(TOKENS.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME6(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.URI_KW);
                    this.CONSUME7(TOKENS.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME7(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.BNODE_KW);
                    this.OR2([
                        {
                            ALT: () => {
                                this.CONSUME8(TOKENS.LPARENT);
                                this.SUBRULE9(this.expression);
                                this.CONSUME8(TOKENS.RPARENT);
                            }
                        },
                        { ALT: () => this.CONSUME1(TOKENS.NIL) }
                    ]);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.BOUND);
                    this.CONSUME9(TOKENS.LPARENT);
                    this.SUBRULE1(this.var);
                    this.CONSUME9(TOKENS.RPARENT);
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
                    this.CONSUME(TOKENS.STRLEN);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.UCASE);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.LCASE);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.ENCODE_FOR_URI);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.CONTAINS);
                    this.CONSUME5(TOKENS.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME1(TOKENS.COMMA);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.STRSTARTS);
                    this.CONSUME6(TOKENS.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME2(TOKENS.COMMA);
                    this.SUBRULE8(this.expression);
                    this.CONSUME6(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.CONCAT);
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
                    this.CONSUME(TOKENS.STRENDS);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.STRBEFORE);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(TOKENS.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.STRAFTER);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME3(TOKENS.COMMA);
                    this.SUBRULE6(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
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
                    this.CONSUME(TOKENS.STRLANG);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.STRLANGDIR);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(TOKENS.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(TOKENS.COMMA);
                    this.SUBRULE5(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.STRDT);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME4(TOKENS.COMMA);
                    this.SUBRULE7(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
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
                    this.CONSUME(TOKENS.ABS_KW);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.CEIL);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.FLOOR);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.ROUND);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.RAND);
                    this.CONSUME1(TOKENS.NIL);
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
                    this.CONSUME(TOKENS.YEAR);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.MONTH);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.DAY);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.HOURS);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.MINUTES);
                    this.CONSUME5(TOKENS.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SECONDS);
                    this.CONSUME6(TOKENS.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME6(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.TIMEZONE);
                    this.CONSUME7(TOKENS.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME7(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.TZ_KW);
                    this.CONSUME8(TOKENS.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME8(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.NOW);
                    this.CONSUME2(TOKENS.NIL);
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
                    this.CONSUME(TOKENS.MD5);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SHA1);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SHA256);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SHA384);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SHA512);
                    this.CONSUME5(TOKENS.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(TOKENS.RPARENT);
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
                    this.CONSUME(TOKENS.SAMETERM);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.ISIRI);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.ISURI);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.ISBLANK);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.ISLITERAL);
                    this.CONSUME5(TOKENS.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.ISNUMERIC);
                    this.CONSUME6(TOKENS.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME6(TOKENS.RPARENT);
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
                    this.CONSUME(TOKENS.COALESCE);
                    this.SUBRULE1(this.expressionList);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.IF_KW);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(TOKENS.COMMA);
                    this.SUBRULE3(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.UUID_KW);
                    this.CONSUME1(TOKENS.NIL);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.STRUUID);
                    this.CONSUME2(TOKENS.NIL);
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
                    this.CONSUME(TOKENS.ISTRIPLE);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.TRIPLE_KW);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(TOKENS.COMMA);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(TOKENS.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SUBJECT_KW);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.PREDICATE_KW);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.OBJECT_KW);
                    this.CONSUME5(TOKENS.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME5(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.HASLANG);
                    this.CONSUME6(TOKENS.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME6(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.HASLANGDIR);
                    this.CONSUME7(TOKENS.LPARENT);
                    this.SUBRULE9(this.expression);
                    this.CONSUME7(TOKENS.RPARENT);
                }
            }
        ]);
    });

    /**
     * [132] RegexExpression ::= 'REGEX' '(' Expression ',' Expression (',' Expression)? ')'
     */
    regexExpression = this.RULE('regexExpression', () => {
        this.CONSUME(TOKENS.REGEX);
        this.CONSUME(TOKENS.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(TOKENS.COMMA);
        this.SUBRULE2(this.expression);
        this.OPTION(() => {
            this.CONSUME2(TOKENS.COMMA);
            this.SUBRULE3(this.expression);
        });
        this.CONSUME(TOKENS.RPARENT);
    });

    /**
     * [133] SubstringExpression ::= 'SUBSTR' '(' Expression ',' Expression (',' Expression)? ')'
     */
    substringExpression = this.RULE('substringExpression', () => {
        this.CONSUME(TOKENS.SUBSTR);
        this.CONSUME(TOKENS.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(TOKENS.COMMA);
        this.SUBRULE2(this.expression);
        this.OPTION(() => {
            this.CONSUME2(TOKENS.COMMA);
            this.SUBRULE3(this.expression);
        });
        this.CONSUME(TOKENS.RPARENT);
    });

    /**
     * [134] StrReplaceExpression ::= 'REPLACE' '(' Expression ',' Expression ',' Expression (',' Expression)? ')'
     */
    strReplaceExpression = this.RULE('strReplaceExpression', () => {
        this.CONSUME(TOKENS.REPLACE_KW);
        this.CONSUME(TOKENS.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(TOKENS.COMMA);
        this.SUBRULE2(this.expression);
        this.CONSUME2(TOKENS.COMMA);
        this.SUBRULE3(this.expression);
        this.OPTION(() => {
            this.CONSUME3(TOKENS.COMMA);
            this.SUBRULE4(this.expression);
        });
        this.CONSUME(TOKENS.RPARENT);
    });

    /**
     * [135] ExistsFunc ::= 'EXISTS' GroupGraphPattern
     */
    existsFunc = this.RULE('existsFunc', () => {
        this.CONSUME(TOKENS.EXISTS);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [136] NotExistsFunc ::= 'NOT' 'EXISTS' GroupGraphPattern
     */
    notExistsFunc = this.RULE('notExistsFunc', () => {
        this.CONSUME(TOKENS.NOT);
        this.CONSUME(TOKENS.EXISTS);
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
                    this.CONSUME(TOKENS.COUNT);
                    this.CONSUME1(TOKENS.LPARENT);
                    this.OPTION1(() => this.CONSUME1(TOKENS.DISTINCT));
                    this.OR2([
                        { ALT: () => this.CONSUME(TOKENS.STAR) },
                        { ALT: () => this.SUBRULE1(this.expression) }
                    ]);
                    this.CONSUME1(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SUM);
                    this.CONSUME2(TOKENS.LPARENT);
                    this.OPTION2(() => this.CONSUME2(TOKENS.DISTINCT));
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.MIN_KW);
                    this.CONSUME3(TOKENS.LPARENT);
                    this.OPTION3(() => this.CONSUME3(TOKENS.DISTINCT));
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.MAX_KW);
                    this.CONSUME4(TOKENS.LPARENT);
                    this.OPTION4(() => this.CONSUME4(TOKENS.DISTINCT));
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.AVG);
                    this.CONSUME5(TOKENS.LPARENT);
                    this.OPTION5(() => this.CONSUME5(TOKENS.DISTINCT));
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.SAMPLE);
                    this.CONSUME6(TOKENS.LPARENT);
                    this.OPTION6(() => this.CONSUME6(TOKENS.DISTINCT));
                    this.SUBRULE6(this.expression);
                    this.CONSUME6(TOKENS.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.GROUP_CONCAT);
                    this.CONSUME7(TOKENS.LPARENT);
                    this.OPTION7(() => this.CONSUME7(TOKENS.DISTINCT));
                    this.SUBRULE7(this.expression);
                    this.OPTION8(() => {
                        this.CONSUME(TOKENS.SEMICOLON);
                        this.CONSUME(TOKENS.SEPARATOR);
                        this.CONSUME(TOKENS.EQ);
                        this.SUBRULE(this.string);
                    });
                    this.CONSUME7(TOKENS.RPARENT);
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
                { ALT: () => this.CONSUME(TOKENS.LANGTAG) },
                {
                    ALT: () => {
                        this.CONSUME(TOKENS.DCARET);
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
            { ALT: () => this.CONSUME(TOKENS.INTEGER) },
            { ALT: () => this.CONSUME(TOKENS.DECIMAL) },
            { ALT: () => this.CONSUME(TOKENS.DOUBLE) }
        ]);
    });

    /**
     * [142] NumericLiteralPositive ::= INTEGER_POSITIVE | DECIMAL_POSITIVE | DOUBLE_POSITIVE
     */
    numericLiteralPositive = this.RULE('numericLiteralPositive', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.INTEGER_POSITIVE) },
            { ALT: () => this.CONSUME(TOKENS.DECIMAL_POSITIVE) },
            { ALT: () => this.CONSUME(TOKENS.DOUBLE_POSITIVE) }
        ]);
    });

    /**
     * [143] NumericLiteralNegative ::= INTEGER_NEGATIVE | DECIMAL_NEGATIVE | DOUBLE_NEGATIVE
     */
    numericLiteralNegative = this.RULE('numericLiteralNegative', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.INTEGER_NEGATIVE) },
            { ALT: () => this.CONSUME(TOKENS.DECIMAL_NEGATIVE) },
            { ALT: () => this.CONSUME(TOKENS.DOUBLE_NEGATIVE) }
        ]);
    });

    /**
     * [144] BooleanLiteral ::= 'true' | 'false'
     */
    booleanLiteral = this.RULE('booleanLiteral', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.TRUE) },
            { ALT: () => this.CONSUME(TOKENS.FALSE) }
        ]);
    });

    /**
     * [145] String ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE | STRING_LITERAL_LONG_QUOTE | STRING_LITERAL_LONG_SINGLE_QUOTE
     */
    string = this.RULE('string', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(TOKENS.STRING_LITERAL_SINGLE_QUOTE) },
            { ALT: () => this.CONSUME(TOKENS.STRING_LITERAL_LONG_QUOTE) },
            { ALT: () => this.CONSUME(TOKENS.STRING_LITERAL_LONG_SINGLE_QUOTE) }
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
            { ALT: () => this.CONSUME(TOKENS.IRIREF) },
            { ALT: () => this.SUBRULE(this.prefixedName) }
        ]);
    });

    /**
     * [147] PrefixedName ::= PNAME_LN | PNAME_NS
     */
    prefixedName = this.RULE('prefixedName', () => {
        const token = this.OR([
            { ALT: () => this.CONSUME(TOKENS.PNAME_LN) },
            { ALT: () => this.CONSUME(TOKENS.PNAME_NS) }
        ]);

        if (token?.image) {
            const n = token.image.indexOf(':');
            const prefix = n > -1 ? token.image.slice(0, n) : token.image;

            if (this.namespaces[prefix] === undefined) {
                const error = new Error(`Undefined prefix: ${prefix}`);
                (error as any).name = 'UndefinedNamespacePrefixError';
                (error as any).token = token;
                (error as any).stack = [...(this as any).RULE_OCCURRENCE_STACK];

                throw error;
            }
        }
    });

    /**
     * [148] BlankNode ::= BLANK_NODE_LABEL | ANON
     */
    blankNode = this.RULE('blankNode', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME(TOKENS.LBRACKET);
        this.CONSUME(TOKENS.RBRACKET);
    });

    // ==========================================
    // Var and helper productions
    // ==========================================

    /**
     * Var ::= VAR1 | VAR2
     */
    var = this.RULE('var', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.VAR1) },
            { ALT: () => this.CONSUME(TOKENS.VAR2) }
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
            { ALT: () => this.CONSUME(TOKENS.NIL) },
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
        this.CONSUME(TOKENS.LBRACKET);
        this.SUBRULE(this.propertyListNotEmpty);
        this.CONSUME(TOKENS.RBRACKET);
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
        this.CONSUME(TOKENS.LBRACKET);
        this.SUBRULE(this.propertyListPathNotEmpty);
        this.CONSUME(TOKENS.RBRACKET);
    });

    /**
     * Collection ::= '(' GraphNode+ ')'
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(TOKENS.LPARENT);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.graphNode));
        this.CONSUME(TOKENS.RPARENT);
    });

    /**
     * CollectionPath ::= '(' GraphNodePath+ ')'
     */
    collectionPath = this.RULE('collectionPath', () => {
        this.CONSUME(TOKENS.LPARENT);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.graphNodePath));
        this.CONSUME(TOKENS.RPARENT);
    });

    /**
     * ValuesClause ::= ('VALUES' DataBlock)?
     */
    valuesClause = this.RULE('valuesClause', () => {
        this.OPTION(() => {
            this.CONSUME(TOKENS.VALUES);
            this.SUBRULE(this.dataBlock);
        });
    });
}
