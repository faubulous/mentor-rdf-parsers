import { Lexer, CstParser, IToken, CstNode, TokenType, ILexingResult, IRecognitionException } from 'chevrotain';
import { DocumentToken } from '../tokens.js';
import { IParser, ILexer } from '../syntax.js';
import { assignBlankNodeIds, BlankNodeIdGenerator, defaultBlankNodeIdGenerator } from '../utils.js';

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
    DocumentToken.WS,
    DocumentToken.COMMENT,

    // Multi-char operators/punctuation (before single-char)
    DocumentToken.DCARET,         // ^^ before CARET
    DocumentToken.CARET,          // ^ (inverse path)
    DocumentToken.AND,            // &&
    DocumentToken.OR,             // || before PIPE |
    DocumentToken.NEQ,            // != before BANG !
    DocumentToken.LTE,            // <= before LT <
    DocumentToken.GTE,            // >= before GT >
    DocumentToken.OPEN_ANNOTATION,    // {| before LCURLY {
    DocumentToken.CLOSE_ANNOTATION,   // |} before PIPE |
    DocumentToken.OPEN_TRIPLE_TERM,   // <<( before OPEN_REIFIED_TRIPLE <<
    DocumentToken.CLOSE_TRIPLE_TERM,  // )>> before RPARENT )
    DocumentToken.OPEN_REIFIED_TRIPLE, // <<
    DocumentToken.CLOSE_REIFIED_TRIPLE, // >>

    // Punctuation
    DocumentToken.TILDE,
    DocumentToken.COMMA,
    DocumentToken.SEMICOLON,
    DocumentToken.PERIOD,
    DocumentToken.LBRACKET,
    DocumentToken.RBRACKET,
    DocumentToken.NIL,            // () before LPARENT ( and RPARENT )
    DocumentToken.LPARENT,
    DocumentToken.RPARENT,
    DocumentToken.LCURLY,
    DocumentToken.RCURLY,

    // SPARQL variables (before QUESTION_MARK to avoid ?name → ? + name)
    DocumentToken.VAR1,
    DocumentToken.VAR2,

    // IRIs must come before LT/GT to avoid <http://...> being split into < + http: + ...
    DocumentToken.IRIREF,

    DocumentToken.STAR,
    DocumentToken.SLASH,
    DocumentToken.PIPE,
    DocumentToken.PLUS_SIGN,
    DocumentToken.MINUS_SIGN,
    DocumentToken.BANG,
    DocumentToken.EQ,
    DocumentToken.LT,
    DocumentToken.GT,
    DocumentToken.QUESTION_MARK,

    // Boolean literals
    DocumentToken.TRUE,
    DocumentToken.FALSE,

    // RDF literal keywords
    DocumentToken.A,

    // Prefixed names must come before keywords to allow keywords as prefix names
    // e.g., 'data:' should be PNAME_NS, not DATA keyword + ':'
    DocumentToken.PNAME_LN,
    DocumentToken.PNAME_NS,

    // SPARQL aggregate keywords (longer first)
    DocumentToken.GROUP_CONCAT,

    // SPARQL built-in functions (longer/more specific first)
    DocumentToken.ENCODE_FOR_URI,
    DocumentToken.LANGMATCHES,
    DocumentToken.LANGDIR,
    DocumentToken.STRLANGDIR,
    DocumentToken.STRLANG,
    DocumentToken.STRSTARTS,
    DocumentToken.STRENDS,
    DocumentToken.STRBEFORE,
    DocumentToken.STRAFTER,
    DocumentToken.STRLEN,
    DocumentToken.STRUUID,
    DocumentToken.STRDT,
    DocumentToken.STR,
    DocumentToken.LANG_KW,
    DocumentToken.DATATYPE,
    DocumentToken.BOUND,
    DocumentToken.IRI_KW,
    DocumentToken.URI_KW,
    DocumentToken.BNODE_KW,
    DocumentToken.RAND,
    DocumentToken.ABS_KW,
    DocumentToken.CEIL,
    DocumentToken.FLOOR,
    DocumentToken.ROUND,
    DocumentToken.CONCAT,
    DocumentToken.UCASE,
    DocumentToken.LCASE,
    DocumentToken.CONTAINS,
    DocumentToken.YEAR,
    DocumentToken.MONTH,
    DocumentToken.DAY,
    DocumentToken.HOURS,
    DocumentToken.MINUTES,
    DocumentToken.SECONDS,
    DocumentToken.TIMEZONE,
    DocumentToken.TZ_KW,
    DocumentToken.NOW,
    DocumentToken.UUID_KW,
    DocumentToken.MD5,
    DocumentToken.SHA256,
    DocumentToken.SHA384,
    DocumentToken.SHA512,
    DocumentToken.SHA1,
    DocumentToken.COALESCE,
    DocumentToken.IF_KW,
    DocumentToken.SAMETERM,
    DocumentToken.ISIRI,
    DocumentToken.ISURI,
    DocumentToken.ISBLANK,
    DocumentToken.ISLITERAL,
    DocumentToken.ISNUMERIC,
    DocumentToken.ISTRIPLE,
    DocumentToken.TRIPLE_KW,
    DocumentToken.SUBJECT_KW,
    DocumentToken.PREDICATE_KW,
    DocumentToken.OBJECT_KW,
    DocumentToken.HASLANGDIR,
    DocumentToken.HASLANG,
    DocumentToken.REGEX,
    DocumentToken.SUBSTR,
    DocumentToken.REPLACE_KW,

    // SPARQL aggregate keywords
    DocumentToken.COUNT,
    DocumentToken.SAMPLE,
    DocumentToken.SUM,
    DocumentToken.MIN_KW,
    DocumentToken.MAX_KW,
    DocumentToken.AVG,
    DocumentToken.SEPARATOR,

    // SPARQL keywords (longer first)
    DocumentToken.CONSTRUCT,
    DocumentToken.DESCRIBE,
    DocumentToken.DISTINCT,
    DocumentToken.OPTIONAL_KW,
    DocumentToken.REDUCED,
    DocumentToken.SELECT,
    DocumentToken.SERVICE,
    DocumentToken.DEFAULT_KW,
    DocumentToken.DELETE_KW,
    DocumentToken.EXISTS,
    DocumentToken.FILTER,
    DocumentToken.HAVING,
    DocumentToken.INSERT,
    DocumentToken.OFFSET,
    DocumentToken.SILENT,
    DocumentToken.VALUES,
    DocumentToken.CREATE_KW,
    DocumentToken.MINUS_KW,
    DocumentToken.NAMED,
    DocumentToken.ORDER,
    DocumentToken.CLEAR,
    DocumentToken.GROUP,
    DocumentToken.LIMIT,
    DocumentToken.UNION,
    DocumentToken.UNDEF,
    DocumentToken.USING,
    DocumentToken.WHERE,
    DocumentToken.WITH_KW,
    DocumentToken.BIND_KW,
    DocumentToken.COPY,
    DocumentToken.DATA,
    DocumentToken.DROP,
    DocumentToken.FROM,
    DocumentToken.INTO,
    DocumentToken.LOAD,
    DocumentToken.MOVE,
    DocumentToken.ADD_KW,
    DocumentToken.ALL_KW,
    DocumentToken.ASC_KW,
    DocumentToken.ASK,
    DocumentToken.DESC_KW,
    DocumentToken.NOT,
    DocumentToken.AS_KW,
    DocumentToken.BY,
    DocumentToken.IN_KW,
    DocumentToken.TO,

    // Directives
    DocumentToken.SPARQL_VERSION,
    DocumentToken.PREFIX,
    DocumentToken.BASE,
    DocumentToken.GRAPH,

    // RDF terms
    DocumentToken.BLANK_NODE_LABEL,
    DocumentToken.LANGTAG,

    // Numeric literals (more specific first)
    DocumentToken.DOUBLE_POSITIVE,
    DocumentToken.DECIMAL_POSITIVE,
    DocumentToken.INTEGER_POSITIVE,
    DocumentToken.DOUBLE_NEGATIVE,
    DocumentToken.DECIMAL_NEGATIVE,
    DocumentToken.INTEGER_NEGATIVE,
    DocumentToken.DOUBLE,
    DocumentToken.DECIMAL,
    DocumentToken.INTEGER,

    // String literals (long before short)
    DocumentToken.STRING_LITERAL_LONG_SINGLE_QUOTE,
    DocumentToken.STRING_LITERAL_LONG_QUOTE,
    DocumentToken.STRING_LITERAL_SINGLE_QUOTE,
    DocumentToken.STRING_LITERAL_QUOTE,
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
export class SparqlLexer extends Lexer implements ILexer {
    /**
     * Optional blank node ID generator function.
     * When set or undefined, the lexer will automatically assign blank node IDs to tokens.
     * Set to null to disable automatic blank node ID assignment.
     */
    blankNodeIdGenerator?: BlankNodeIdGenerator | null;

    constructor(blankNodeIdGenerator?: BlankNodeIdGenerator | null) {
        super(allTokens);
        this.blankNodeIdGenerator = blankNodeIdGenerator;
    }

    override tokenize(text: string, initialMode?: string): ILexingResult {
        // Per SPARQL 1.2 spec section 19.2, codepoint escape sequences 
        // (\uXXXX and \UXXXXXXXX) are resolved before parsing by the grammar.
        // https://www.w3.org/TR/sparql12-query/#codepointEscape
        const resolvedText = resolveCodepointEscapes(text);

        const result = super.tokenize(resolvedText, initialMode);

        // Unless explicitly disabled (null), assign blank node IDs
        if (this.blankNodeIdGenerator !== null) {
            assignBlankNodeIds(result.tokens, this.blankNodeIdGenerator ?? defaultBlankNodeIdGenerator);
        }

        return result;
    }
}

/**
 * Helper class for extracting variables from SPARQL query CST nodes.
 */
export class SparqlVariableParser {
    /**
     * Extracts the result variables from a SELECT query in the order they are defined.
     * 
     * Handles:
     * - Simple variable projections: `SELECT ?x ?y`
     * - Projections with AS: `SELECT (?x AS ?y)`
     * - Aggregates with AS: `SELECT (COUNT(?x) AS ?count)`
     * - SELECT *: returns all variables from the WHERE clause in order of first appearance
     * 
     * @param cst - The concrete syntax tree from parsing a SPARQL query
     * @returns An array of variable names (without the ? or $ prefix) in projection order
     * @throws Error if the query is not a SELECT query
     */
    getSelectedVariables(cst: CstNode): string[] {
        // Navigate to selectClause: queryOrUpdate > queryBody > selectQuery > selectClause
        const queryBody = cst.children?.queryBody?.[0] as CstNode | undefined;

        if (!queryBody) {
            throw new Error('Not a query (no queryBody found)');
        }

        const selectQuery = queryBody.children?.selectQuery?.[0] as CstNode | undefined;

        if (!selectQuery) {
            throw new Error('Not a SELECT query');
        }

        const selectClause = selectQuery.children?.selectClause?.[0] as CstNode | undefined;

        if (!selectClause) {
            throw new Error('No selectClause found');
        }

        // Handle SELECT * by extracting variables from WHERE clause
        if (selectClause.children?.STAR) {
            const whereClause = selectQuery.children?.whereClause?.[0] as CstNode | undefined;

            return this._extractAllVariables(whereClause);
        } else {
            return this._extractVariablesFromSelectClause(selectClause);
        }
    }

    /**
     * Internal helper to extract variables from a selectClause CST node.
     */
    private _extractVariablesFromSelectClause(selectClause: CstNode): string[] {
        const varNodes = selectClause.children?.var as CstNode[] | undefined;

        if (!varNodes?.length) {
            return [];
        }

        // All vars directly under selectClause are result variables
        // (both simple projections and AS targets)
        return varNodes
            .map(varNode => this._getVarToken(varNode))
            .filter((token): token is IToken => token !== undefined)
            .sort((a, b) => a.startOffset - b.startOffset)
            .map(token => token.image.slice(1));
    }

    /**
     * Recursively extracts all unique variables from a CST node.
     * Returns variables in order of first appearance.
     */
    private _extractAllVariables(node: CstNode | undefined): string[] {
        if (!node) {
            return [];
        }

        const seen = new Set<string>();
        const result: { name: string; offset: number }[] = [];

        const traverse = (n: CstNode) => {
            // Check for var nodes
            if (n.children?.var) {
                for (const varNode of n.children.var as CstNode[]) {
                    const token = this._getVarToken(varNode);
                    if (token) {
                        const name = token.image.slice(1);
                        if (!seen.has(name)) {
                            seen.add(name);
                            result.push({ name, offset: token.startOffset });
                        }
                    }
                }
            }

            // Check for direct VAR1/VAR2 tokens (in some contexts)
            for (const key of ['VAR1', 'VAR2']) {
                if (n.children?.[key]) {
                    for (const token of n.children[key] as IToken[]) {
                        const name = token.image.slice(1);
                        if (!seen.has(name)) {
                            seen.add(name);
                            result.push({ name, offset: token.startOffset });
                        }
                    }
                }
            }

            // Recursively traverse all child nodes
            if (n.children) {
                for (const key of Object.keys(n.children)) {
                    if (key === 'var' || key === 'VAR1' || key === 'VAR2') continue;
                    const children = n.children[key];
                    if (Array.isArray(children)) {
                        for (const child of children) {
                            if (child && typeof child === 'object' && 'children' in child) {
                                traverse(child as CstNode);
                            }
                        }
                    }
                }
            }
        };

        traverse(node);

        // Sort by first appearance and return names
        return result.sort((a, b) => a.offset - b.offset).map(v => v.name);
    }

    /**
     * Gets the VAR1 or VAR2 token from a var CST node.
     */
    private _getVarToken(varNode: CstNode): IToken | undefined {
        return (varNode.children?.VAR1?.[0] || varNode.children?.VAR2?.[0]) as IToken | undefined;
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

    /**
     * Whether to throw errors during parsing or collect them.
     */
    private _throwOnErrors: boolean = true;

    /**
     * Semantic errors collected during parsing (e.g., UndefinedNamespacePrefixError).
     */
    semanticErrors: IRecognitionException[] = [];

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
        this._throwOnErrors = throwOnErrors;
        this.semanticErrors = [];
        this.namespaces = {};
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
        this.CONSUME(DocumentToken.BASE);
        this.CONSUME(DocumentToken.IRIREF);
    });

    /**
     * [6] PrefixDecl ::= 'PREFIX' PNAME_NS IRIREF
     */
    prefixDecl = this.RULE('prefixDecl', () => {
        this.CONSUME(DocumentToken.PREFIX);
        const prefix = this.CONSUME(DocumentToken.PNAME_NS);
        const iri = this.CONSUME(DocumentToken.IRIREF);
        this.registerNamespace(prefix, iri);
    });

    /**
     * [7] VersionDecl ::= 'VERSION' VersionSpecifier
     */
    versionDecl = this.RULE('versionDecl', () => {
        this.CONSUME(DocumentToken.SPARQL_VERSION);
        this.SUBRULE(this.versionSpecifier);
    });

    /**
     * [8] VersionSpecifier ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE
     */
    versionSpecifier = this.RULE('versionSpecifier', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(DocumentToken.STRING_LITERAL_SINGLE_QUOTE) }
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
        this.CONSUME(DocumentToken.SELECT);
        this.OPTION(() => {
            this.OR1([
                { ALT: () => this.CONSUME(DocumentToken.DISTINCT) },
                { ALT: () => this.CONSUME(DocumentToken.REDUCED) }
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
                                    this.CONSUME(DocumentToken.LPARENT);
                                    this.SUBRULE(this.expression);
                                    this.CONSUME(DocumentToken.AS_KW);
                                    this.SUBRULE2(this.var);
                                    this.CONSUME(DocumentToken.RPARENT);
                                }
                            }
                        ]);
                    });
                }
            },
            { ALT: () => this.CONSUME(DocumentToken.STAR) }
        ]);
    });

    /**
     * [12] ConstructQuery ::= 'CONSTRUCT' (ConstructTemplate DatasetClause* WhereClause SolutionModifier
     *                       | DatasetClause* 'WHERE' '{' TriplesTemplate? '}' SolutionModifier)
     */
    constructQuery = this.RULE('constructQuery', () => {
        this.CONSUME(DocumentToken.CONSTRUCT);
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
                    this.CONSUME(DocumentToken.WHERE);
                    this.CONSUME(DocumentToken.LCURLY);
                    this.OPTION(() => this.SUBRULE(this.triplesTemplate));
                    this.CONSUME(DocumentToken.RCURLY);
                    this.SUBRULE2(this.solutionModifier);
                }
            }
        ]);
    });

    /**
     * [13] DescribeQuery ::= 'DESCRIBE' (VarOrIri+ | '*') DatasetClause* WhereClause? SolutionModifier
     */
    describeQuery = this.RULE('describeQuery', () => {
        this.CONSUME(DocumentToken.DESCRIBE);
        this.OR([
            { ALT: () => this.AT_LEAST_ONE(() => this.SUBRULE(this.varOrIri)) },
            { ALT: () => this.CONSUME(DocumentToken.STAR) }
        ]);
        this.MANY(() => this.SUBRULE(this.datasetClause));
        this.OPTION(() => this.SUBRULE(this.whereClause));
        this.SUBRULE(this.solutionModifier);
    });

    /**
     * [14] AskQuery ::= 'ASK' DatasetClause* WhereClause SolutionModifier
     */
    askQuery = this.RULE('askQuery', () => {
        this.CONSUME(DocumentToken.ASK);
        this.MANY(() => this.SUBRULE(this.datasetClause));
        this.SUBRULE(this.whereClause);
        this.SUBRULE(this.solutionModifier);
    });

    /**
     * [15] DatasetClause ::= 'FROM' (DefaultGraphClause | NamedGraphClause)
     */
    datasetClause = this.RULE('datasetClause', () => {
        this.CONSUME(DocumentToken.FROM);
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
        this.CONSUME(DocumentToken.NAMED);
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
        this.OPTION(() => this.CONSUME(DocumentToken.WHERE));
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
        this.CONSUME(DocumentToken.GROUP);
        this.CONSUME(DocumentToken.BY);
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
                    this.CONSUME(DocumentToken.LPARENT);
                    this.SUBRULE(this.expression);
                    this.OPTION(() => {
                        this.CONSUME(DocumentToken.AS_KW);
                        this.SUBRULE(this.var);
                    });
                    this.CONSUME(DocumentToken.RPARENT);
                }
            },
            { ALT: () => this.SUBRULE2(this.var) }
        ]);
    });

    /**
     * [23] HavingClause ::= 'HAVING' HavingCondition+
     */
    havingClause = this.RULE('havingClause', () => {
        this.CONSUME(DocumentToken.HAVING);
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
        this.CONSUME(DocumentToken.ORDER);
        this.CONSUME(DocumentToken.BY);
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
                        { ALT: () => this.CONSUME(DocumentToken.ASC_KW) },
                        { ALT: () => this.CONSUME(DocumentToken.DESC_KW) }
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
        this.CONSUME(DocumentToken.LIMIT);
        this.CONSUME(DocumentToken.INTEGER);
    });

    /**
     * [29] OffsetClause ::= 'OFFSET' INTEGER
     */
    offsetClause = this.RULE('offsetClause', () => {
        this.CONSUME(DocumentToken.OFFSET);
        this.CONSUME(DocumentToken.INTEGER);
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
                this.CONSUME(DocumentToken.SEMICOLON);
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
        this.CONSUME(DocumentToken.LOAD);
        this.OPTION1(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE(this.iri);
        this.OPTION2(() => {
            this.CONSUME(DocumentToken.INTO);
            this.SUBRULE(this.graphRef);
        });
    });

    /**
     * [34] Clear ::= 'CLEAR' 'SILENT'? GraphRefAll
     */
    clear = this.RULE('clear', () => {
        this.CONSUME(DocumentToken.CLEAR);
        this.OPTION(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE(this.graphRefAll);
    });

    /**
     * [35] Drop ::= 'DROP' 'SILENT'? GraphRefAll
     */
    drop = this.RULE('drop', () => {
        this.CONSUME(DocumentToken.DROP);
        this.OPTION(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE(this.graphRefAll);
    });

    /**
     * [36] Create ::= 'CREATE' 'SILENT'? GraphRef
     */
    create = this.RULE('create', () => {
        this.CONSUME(DocumentToken.CREATE_KW);
        this.OPTION(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE(this.graphRef);
    });

    /**
     * [37] Add ::= 'ADD' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    add = this.RULE('add', () => {
        this.CONSUME(DocumentToken.ADD_KW);
        this.OPTION(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(DocumentToken.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [38] Move ::= 'MOVE' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    move = this.RULE('move', () => {
        this.CONSUME(DocumentToken.MOVE);
        this.OPTION(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(DocumentToken.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [39] Copy ::= 'COPY' 'SILENT'? GraphOrDefault 'TO' GraphOrDefault
     */
    copy = this.RULE('copy', () => {
        this.CONSUME(DocumentToken.COPY);
        this.OPTION(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE1(this.graphOrDefault);
        this.CONSUME(DocumentToken.TO);
        this.SUBRULE2(this.graphOrDefault);
    });

    /**
     * [40] InsertData ::= 'INSERT' 'DATA' QuadData
     */
    insertData = this.RULE('insertData', () => {
        this.CONSUME(DocumentToken.INSERT);
        this.CONSUME(DocumentToken.DATA);
        this.SUBRULE(this.quadData);
    });

    /**
     * [41] DeleteData ::= 'DELETE' 'DATA' QuadData
     */
    deleteData = this.RULE('deleteData', () => {
        this.CONSUME(DocumentToken.DELETE_KW);
        this.CONSUME(DocumentToken.DATA);
        const prev = this._insideDeleteBlock;
        this._insideDeleteBlock = true;
        this.SUBRULE(this.quadData);
        this._insideDeleteBlock = prev;
    });

    /**
     * [42] DeleteWhere ::= 'DELETE' 'WHERE' QuadPattern
     */
    deleteWhere = this.RULE('deleteWhere', () => {
        this.CONSUME(DocumentToken.DELETE_KW);
        this.CONSUME(DocumentToken.WHERE);
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
            this.CONSUME(DocumentToken.WITH_KW);
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
        this.CONSUME(DocumentToken.WHERE);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [44] DeleteClause ::= 'DELETE' QuadPattern
     */
    deleteClause = this.RULE('deleteClause', () => {
        this.CONSUME(DocumentToken.DELETE_KW);
        const prev = this._insideDeleteBlock;
        this._insideDeleteBlock = true;
        this.SUBRULE(this.quadPattern);
        this._insideDeleteBlock = prev;
    });

    /**
     * [45] InsertClause ::= 'INSERT' QuadPattern
     */
    insertClause = this.RULE('insertClause', () => {
        this.CONSUME(DocumentToken.INSERT);
        this.SUBRULE(this.quadPattern);
    });

    /**
     * [46] UsingClause ::= 'USING' (iri | 'NAMED' iri)
     */
    usingClause = this.RULE('usingClause', () => {
        this.CONSUME(DocumentToken.USING);
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.NAMED);
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
            { ALT: () => this.CONSUME(DocumentToken.DEFAULT_KW) },
            {
                ALT: () => {
                    this.OPTION(() => this.CONSUME(DocumentToken.GRAPH));
                    this.SUBRULE(this.iri);
                }
            }
        ]);
    });

    /**
     * [48] GraphRef ::= 'GRAPH' iri
     */
    graphRef = this.RULE('graphRef', () => {
        this.CONSUME(DocumentToken.GRAPH);
        this.SUBRULE(this.iri);
    });

    /**
     * [49] GraphRefAll ::= GraphRef | 'DEFAULT' | 'NAMED' | 'ALL'
     */
    graphRefAll = this.RULE('graphRefAll', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.graphRef) },
            { ALT: () => this.CONSUME(DocumentToken.DEFAULT_KW) },
            { ALT: () => this.CONSUME(DocumentToken.NAMED) },
            { ALT: () => this.CONSUME(DocumentToken.ALL_KW) }
        ]);
    });

    // ==========================================
    // Quad productions [50]-[54]
    // ==========================================

    /**
     * [50] QuadPattern ::= '{' Quads '}'
     */
    quadPattern = this.RULE('quadPattern', () => {
        this.CONSUME(DocumentToken.LCURLY);
        this.SUBRULE(this.quads);
        this.CONSUME(DocumentToken.RCURLY);
    });

    /**
     * [51] QuadData ::= '{' Quads '}'
     */
    quadData = this.RULE('quadData', () => {
        this.CONSUME(DocumentToken.LCURLY);
        this.SUBRULE(this.quads);
        this.CONSUME(DocumentToken.RCURLY);
    });

    /**
     * [52] Quads ::= TriplesTemplate? (QuadsNotTriples '.'? TriplesTemplate?)*
     */
    quads = this.RULE('quads', () => {
        this.OPTION1(() => this.SUBRULE1(this.triplesTemplate));
        this.MANY(() => {
            this.SUBRULE(this.quadsNotTriples);
            this.OPTION2(() => this.CONSUME(DocumentToken.PERIOD));
            this.OPTION3(() => this.SUBRULE2(this.triplesTemplate));
        });
    });

    /**
     * [53] QuadsNotTriples ::= 'GRAPH' VarOrIri '{' TriplesTemplate? '}'
     */
    quadsNotTriples = this.RULE('quadsNotTriples', () => {
        this.CONSUME(DocumentToken.GRAPH);
        this.SUBRULE(this.varOrIri);
        this.CONSUME(DocumentToken.LCURLY);
        this.OPTION(() => this.SUBRULE(this.triplesTemplate));
        this.CONSUME(DocumentToken.RCURLY);
    });

    /**
     * [54] TriplesTemplate ::= TriplesSameSubject ('.' TriplesTemplate?)?
     */
    triplesTemplate = this.RULE('triplesTemplate', () => {
        this.SUBRULE(this.triplesSameSubject);
        this.OPTION(() => {
            this.CONSUME(DocumentToken.PERIOD);
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
        this.CONSUME(DocumentToken.LCURLY);
        this.OR([
            { ALT: () => this.SUBRULE(this.subSelect) },
            { ALT: () => this.SUBRULE(this.groupGraphPatternSub) }
        ]);
        this.CONSUME(DocumentToken.RCURLY);
    });

    /**
     * [56] GroupGraphPatternSub ::= TriplesBlock? (GraphPatternNotTriples '.'? TriplesBlock?)*
     */
    groupGraphPatternSub = this.RULE('groupGraphPatternSub', () => {
        this.OPTION1(() => this.SUBRULE1(this.triplesBlock));
        this.MANY(() => {
            this.SUBRULE(this.graphPatternNotTriples);
            this.OPTION2(() => this.CONSUME(DocumentToken.PERIOD));
            this.OPTION3(() => this.SUBRULE2(this.triplesBlock));
        });
    });

    /**
     * [57] TriplesBlock ::= TriplesSameSubjectPath ('.' TriplesBlock?)?
     */
    triplesBlock = this.RULE('triplesBlock', () => {
        this.SUBRULE(this.triplesSameSubjectPath);
        this.OPTION(() => {
            this.CONSUME(DocumentToken.PERIOD);
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
        this.CONSUME(DocumentToken.OPTIONAL_KW);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [61] GraphGraphPattern ::= 'GRAPH' VarOrIri GroupGraphPattern
     */
    graphGraphPattern = this.RULE('graphGraphPattern', () => {
        this.CONSUME(DocumentToken.GRAPH);
        this.SUBRULE(this.varOrIri);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [62] ServiceGraphPattern ::= 'SERVICE' 'SILENT'? VarOrIri GroupGraphPattern
     */
    serviceGraphPattern = this.RULE('serviceGraphPattern', () => {
        this.CONSUME(DocumentToken.SERVICE);
        this.OPTION(() => this.CONSUME(DocumentToken.SILENT));
        this.SUBRULE(this.varOrIri);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [63] Bind ::= 'BIND' '(' Expression 'AS' Var ')'
     */
    bind = this.RULE('bind', () => {
        this.CONSUME(DocumentToken.BIND_KW);
        this.CONSUME(DocumentToken.LPARENT);
        this.SUBRULE(this.expression);
        this.CONSUME(DocumentToken.AS_KW);
        this.SUBRULE(this.var);
        this.CONSUME(DocumentToken.RPARENT);
    });

    /**
     * [64] InlineData ::= 'VALUES' DataBlock
     */
    inlineData = this.RULE('inlineData', () => {
        this.CONSUME(DocumentToken.VALUES);
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
        this.CONSUME(DocumentToken.LCURLY);
        this.MANY(() => this.SUBRULE(this.dataBlockValue));
        this.CONSUME(DocumentToken.RCURLY);
    });

    /**
     * [67] InlineDataFull ::= (NIL | '(' Var* ')') '{' ('(' DataBlockValue* ')' | NIL)* '}'
     */
    inlineDataFull = this.RULE('inlineDataFull', () => {
        this.OR1([
            { ALT: () => this.CONSUME1(DocumentToken.NIL) },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.LPARENT);
                    this.MANY1(() => this.SUBRULE(this.var));
                    this.CONSUME(DocumentToken.RPARENT);
                }
            }
        ]);
        this.CONSUME(DocumentToken.LCURLY);
        this.MANY2(() => {
            this.OR2([
                {
                    ALT: () => {
                        this.CONSUME2(DocumentToken.LPARENT);
                        this.MANY3(() => this.SUBRULE(this.dataBlockValue));
                        this.CONSUME2(DocumentToken.RPARENT);
                    }
                },
                { ALT: () => this.CONSUME2(DocumentToken.NIL) }
            ]);
        });
        this.CONSUME(DocumentToken.RCURLY);
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
            { ALT: () => this.CONSUME(DocumentToken.UNDEF) },
            { ALT: () => this.SUBRULE(this.tripleTermData) }
        ]);
    });

    /**
     * [69] MinusGraphPattern ::= 'MINUS' GroupGraphPattern
     */
    minusGraphPattern = this.RULE('minusGraphPattern', () => {
        this.CONSUME(DocumentToken.MINUS_KW);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [70] GroupOrUnionGraphPattern ::= GroupGraphPattern ('UNION' GroupGraphPattern)*
     */
    groupOrUnionGraphPattern = this.RULE('groupOrUnionGraphPattern', () => {
        this.SUBRULE1(this.groupGraphPattern);
        this.MANY(() => {
            this.CONSUME(DocumentToken.UNION);
            this.SUBRULE2(this.groupGraphPattern);
        });
    });

    /**
     * [71] Filter ::= 'FILTER' Constraint
     */
    filter = this.RULE('filter', () => {
        this.CONSUME(DocumentToken.FILTER);
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
            { ALT: () => this.CONSUME(DocumentToken.NIL) },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.LPARENT);
                    this.OPTION(() => this.CONSUME(DocumentToken.DISTINCT));
                    this.SUBRULE1(this.expression);
                    this.MANY(() => {
                        this.CONSUME(DocumentToken.COMMA);
                        this.SUBRULE2(this.expression);
                    });
                    this.CONSUME(DocumentToken.RPARENT);
                }
            }
        ]);
    });

    /**
     * [75] ExpressionList ::= NIL | '(' Expression (',' Expression)* ')'
     */
    expressionList = this.RULE('expressionList', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.NIL) },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.MANY(() => {
                        this.CONSUME(DocumentToken.COMMA);
                        this.SUBRULE2(this.expression);
                    });
                    this.CONSUME(DocumentToken.RPARENT);
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
        this.CONSUME(DocumentToken.LCURLY);
        this.OPTION(() => this.SUBRULE(this.constructTriples));
        this.CONSUME(DocumentToken.RCURLY);
    });

    /**
     * [77] ConstructTriples ::= TriplesSameSubject ('.' ConstructTriples?)?
     */
    constructTriples = this.RULE('constructTriples', () => {
        this.SUBRULE(this.triplesSameSubject);
        this.OPTION(() => {
            this.CONSUME(DocumentToken.PERIOD);
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
            this.CONSUME(DocumentToken.SEMICOLON);
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
            { ALT: () => this.CONSUME(DocumentToken.A) }
        ]);
    });

    /**
     * [85] ObjectList ::= Object (',' Object)*
     */
    objectList = this.RULE('objectList', () => {
        this.SUBRULE1(this.graphObject);
        this.MANY(() => {
            this.CONSUME(DocumentToken.COMMA);
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
            this.CONSUME(DocumentToken.SEMICOLON);
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
            this.CONSUME(DocumentToken.COMMA);
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
            this.CONSUME(DocumentToken.PIPE);
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
            this.CONSUME(DocumentToken.SLASH);
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
                    this.CONSUME(DocumentToken.CARET);
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
            { ALT: () => this.CONSUME(DocumentToken.QUESTION_MARK) },
            { ALT: () => this.CONSUME(DocumentToken.STAR) },
            { ALT: () => this.CONSUME(DocumentToken.PLUS_SIGN) }
        ]);
    });

    /**
     * [97] PathPrimary ::= iri | 'a' | '!' PathNegatedPropertySet | '(' Path ')'
     */
    pathPrimary = this.RULE('pathPrimary', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.CONSUME(DocumentToken.A) },
            {
                ALT: () => {
                    this._verbIsSimplePath = false;
                    this.CONSUME(DocumentToken.BANG);
                    this.SUBRULE(this.pathNegatedPropertySet);
                }
            },
            {
                ALT: () => {
                    this._verbIsSimplePath = false;
                    this.CONSUME(DocumentToken.LPARENT);
                    this.SUBRULE(this.path);
                    this.CONSUME(DocumentToken.RPARENT);
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
                    this.CONSUME(DocumentToken.LPARENT);
                    this.OPTION(() => {
                        this.SUBRULE2(this.pathOneInPropertySet);
                        this.MANY(() => {
                            this.CONSUME(DocumentToken.PIPE);
                            this.SUBRULE3(this.pathOneInPropertySet);
                        });
                    });
                    this.CONSUME(DocumentToken.RPARENT);
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
            { ALT: () => this.CONSUME(DocumentToken.A) },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.CARET);
                    this.OR2([
                        { ALT: () => this.SUBRULE2(this.iri) },
                        { ALT: () => this.CONSUME2(DocumentToken.A) }
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
        this.CONSUME(DocumentToken.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.reifiedTripleSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.reifiedTripleObject);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(DocumentToken.CLOSE_REIFIED_TRIPLE);
    });

    /**
     * [103] ReifiedTriplePath ::= '<<' ReifiedTripleSubject VerbPath ReifiedTripleObjectPath Reifier? '>>'
     */
    reifiedTriplePath = this.RULE('reifiedTriplePath', () => {
        this.CONSUME(DocumentToken.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.reifiedTripleSubject);
        this.SUBRULE(this.verbPath);
        this.SUBRULE(this.reifiedTripleObjectPath);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(DocumentToken.CLOSE_REIFIED_TRIPLE);
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
        this.CONSUME(DocumentToken.OPEN_ANNOTATION);
        this.SUBRULE(this.propertyListPathNotEmpty);
        this.CONSUME(DocumentToken.CLOSE_ANNOTATION);
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
        this.CONSUME(DocumentToken.OPEN_ANNOTATION);
        this.SUBRULE(this.propertyListNotEmpty);
        this.CONSUME(DocumentToken.CLOSE_ANNOTATION);
    });

    /**
     * [111] Reifier ::= '~' VarOrReifierId?
     */
    reifier = this.RULE('reifier', () => {
        this.CONSUME(DocumentToken.TILDE);
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
        this.CONSUME(DocumentToken.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.tripleTermSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.tripleTermObject);
        this.CONSUME(DocumentToken.CLOSE_TRIPLE_TERM);
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
        this.CONSUME(DocumentToken.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.tripleTermDataSubject);
        this.OR([
            { ALT: () => this.SUBRULE1(this.iri) },
            { ALT: () => this.CONSUME(DocumentToken.A) }
        ]);
        this.SUBRULE(this.tripleTermDataObject);
        this.CONSUME(DocumentToken.CLOSE_TRIPLE_TERM);
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
            this.CONSUME(DocumentToken.OR);
            this.SUBRULE2(this.conditionalAndExpression);
        });
    });

    /**
     * [121] ConditionalAndExpression ::= ValueLogical ('&&' ValueLogical)*
     */
    conditionalAndExpression = this.RULE('conditionalAndExpression', () => {
        this.SUBRULE1(this.valueLogical);
        this.MANY(() => {
            this.CONSUME(DocumentToken.AND);
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
                { ALT: () => { this.CONSUME(DocumentToken.EQ); this.SUBRULE2(this.numericExpression); } },
                { ALT: () => { this.CONSUME(DocumentToken.NEQ); this.SUBRULE3(this.numericExpression); } },
                { ALT: () => { this.CONSUME(DocumentToken.LT); this.SUBRULE4(this.numericExpression); } },
                { ALT: () => { this.CONSUME(DocumentToken.GT); this.SUBRULE5(this.numericExpression); } },
                { ALT: () => { this.CONSUME(DocumentToken.LTE); this.SUBRULE6(this.numericExpression); } },
                { ALT: () => { this.CONSUME(DocumentToken.GTE); this.SUBRULE7(this.numericExpression); } },
                { ALT: () => { this.CONSUME(DocumentToken.IN_KW); this.SUBRULE1(this.expressionList); } },
                { ALT: () => { this.CONSUME(DocumentToken.NOT); this.CONSUME2(DocumentToken.IN_KW); this.SUBRULE2(this.expressionList); } }
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
                        this.CONSUME(DocumentToken.PLUS_SIGN);
                        this.SUBRULE2(this.multiplicativeExpression);
                    }
                },
                {
                    ALT: () => {
                        this.CONSUME(DocumentToken.MINUS_SIGN);
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
                                { ALT: () => { this.CONSUME(DocumentToken.STAR); this.SUBRULE1(this.unaryExpression); } },
                                { ALT: () => { this.CONSUME(DocumentToken.SLASH); this.SUBRULE2(this.unaryExpression); } }
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
                { ALT: () => { this.CONSUME(DocumentToken.STAR); this.SUBRULE2(this.unaryExpression); } },
                { ALT: () => { this.CONSUME(DocumentToken.SLASH); this.SUBRULE3(this.unaryExpression); } }
            ]);
        });
    });

    /**
     * [135] UnaryExpression ::= '!' UnaryExpression | '+' PrimaryExpression | '-' PrimaryExpression | PrimaryExpression
     */
    unaryExpression = this.RULE('unaryExpression', () => {
        this.OR([
            { ALT: () => { this.CONSUME(DocumentToken.BANG); this.SUBRULE1(this.unaryExpression); } },
            { ALT: () => { this.CONSUME(DocumentToken.PLUS_SIGN); this.SUBRULE2(this.primaryExpression); } },
            { ALT: () => { this.CONSUME(DocumentToken.MINUS_SIGN); this.SUBRULE3(this.primaryExpression); } },
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
        this.CONSUME(DocumentToken.LPARENT);
        this.SUBRULE(this.expression);
        this.CONSUME(DocumentToken.RPARENT);
    });

    /**
     * [137] ExprTripleTerm ::= '<<(' ExprTripleTermSubject Verb ExprTripleTermObject ')>>'
     */
    exprTripleTerm = this.RULE('exprTripleTerm', () => {
        this.CONSUME(DocumentToken.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.exprTripleTermSubject);
        this.SUBRULE(this.verb);
        this.SUBRULE(this.exprTripleTermObject);
        this.CONSUME(DocumentToken.CLOSE_TRIPLE_TERM);
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
                    this.CONSUME(DocumentToken.STR);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.LANG_KW);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.LANGMATCHES);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME1(DocumentToken.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.LANGDIR);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.DATATYPE);
                    this.CONSUME5(DocumentToken.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.IRI_KW);
                    this.CONSUME6(DocumentToken.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME6(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.URI_KW);
                    this.CONSUME7(DocumentToken.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME7(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.BNODE_KW);
                    this.OR2([
                        {
                            ALT: () => {
                                this.CONSUME8(DocumentToken.LPARENT);
                                this.SUBRULE9(this.expression);
                                this.CONSUME8(DocumentToken.RPARENT);
                            }
                        },
                        { ALT: () => this.CONSUME1(DocumentToken.NIL) }
                    ]);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.BOUND);
                    this.CONSUME9(DocumentToken.LPARENT);
                    this.SUBRULE1(this.var);
                    this.CONSUME9(DocumentToken.RPARENT);
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
                    this.CONSUME(DocumentToken.STRLEN);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.UCASE);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.LCASE);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.ENCODE_FOR_URI);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.CONTAINS);
                    this.CONSUME5(DocumentToken.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME1(DocumentToken.COMMA);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.STRSTARTS);
                    this.CONSUME6(DocumentToken.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME2(DocumentToken.COMMA);
                    this.SUBRULE8(this.expression);
                    this.CONSUME6(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.CONCAT);
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
                    this.CONSUME(DocumentToken.STRENDS);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.STRBEFORE);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(DocumentToken.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.STRAFTER);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME3(DocumentToken.COMMA);
                    this.SUBRULE6(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
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
                    this.CONSUME(DocumentToken.STRLANG);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.STRLANGDIR);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(DocumentToken.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(DocumentToken.COMMA);
                    this.SUBRULE5(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.STRDT);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME4(DocumentToken.COMMA);
                    this.SUBRULE7(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
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
                    this.CONSUME(DocumentToken.ABS_KW);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.CEIL);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.FLOOR);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.ROUND);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.RAND);
                    this.CONSUME1(DocumentToken.NIL);
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
                    this.CONSUME(DocumentToken.YEAR);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.MONTH);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.DAY);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.HOURS);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.MINUTES);
                    this.CONSUME5(DocumentToken.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SECONDS);
                    this.CONSUME6(DocumentToken.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME6(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.TIMEZONE);
                    this.CONSUME7(DocumentToken.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME7(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.TZ_KW);
                    this.CONSUME8(DocumentToken.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME8(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.NOW);
                    this.CONSUME2(DocumentToken.NIL);
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
                    this.CONSUME(DocumentToken.MD5);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SHA1);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SHA256);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SHA384);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SHA512);
                    this.CONSUME5(DocumentToken.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(DocumentToken.RPARENT);
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
                    this.CONSUME(DocumentToken.SAMETERM);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.ISIRI);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.ISURI);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE4(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.ISBLANK);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.ISLITERAL);
                    this.CONSUME5(DocumentToken.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME5(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.ISNUMERIC);
                    this.CONSUME6(DocumentToken.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME6(DocumentToken.RPARENT);
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
                    this.CONSUME(DocumentToken.COALESCE);
                    this.SUBRULE1(this.expressionList);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.IF_KW);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.COMMA);
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(DocumentToken.COMMA);
                    this.SUBRULE3(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.UUID_KW);
                    this.CONSUME1(DocumentToken.NIL);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.STRUUID);
                    this.CONSUME2(DocumentToken.NIL);
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
                    this.CONSUME(DocumentToken.ISTRIPLE);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.SUBRULE1(this.expression);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.TRIPLE_KW);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.SUBRULE2(this.expression);
                    this.CONSUME1(DocumentToken.COMMA);
                    this.SUBRULE3(this.expression);
                    this.CONSUME2(DocumentToken.COMMA);
                    this.SUBRULE4(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SUBJECT_KW);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.SUBRULE5(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.PREDICATE_KW);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.SUBRULE6(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.OBJECT_KW);
                    this.CONSUME5(DocumentToken.LPARENT);
                    this.SUBRULE7(this.expression);
                    this.CONSUME5(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.HASLANG);
                    this.CONSUME6(DocumentToken.LPARENT);
                    this.SUBRULE8(this.expression);
                    this.CONSUME6(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.HASLANGDIR);
                    this.CONSUME7(DocumentToken.LPARENT);
                    this.SUBRULE9(this.expression);
                    this.CONSUME7(DocumentToken.RPARENT);
                }
            }
        ]);
    });

    /**
     * [132] RegexExpression ::= 'REGEX' '(' Expression ',' Expression (',' Expression)? ')'
     */
    regexExpression = this.RULE('regexExpression', () => {
        this.CONSUME(DocumentToken.REGEX);
        this.CONSUME(DocumentToken.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(DocumentToken.COMMA);
        this.SUBRULE2(this.expression);
        this.OPTION(() => {
            this.CONSUME2(DocumentToken.COMMA);
            this.SUBRULE3(this.expression);
        });
        this.CONSUME(DocumentToken.RPARENT);
    });

    /**
     * [133] SubstringExpression ::= 'SUBSTR' '(' Expression ',' Expression (',' Expression)? ')'
     */
    substringExpression = this.RULE('substringExpression', () => {
        this.CONSUME(DocumentToken.SUBSTR);
        this.CONSUME(DocumentToken.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(DocumentToken.COMMA);
        this.SUBRULE2(this.expression);
        this.OPTION(() => {
            this.CONSUME2(DocumentToken.COMMA);
            this.SUBRULE3(this.expression);
        });
        this.CONSUME(DocumentToken.RPARENT);
    });

    /**
     * [134] StrReplaceExpression ::= 'REPLACE' '(' Expression ',' Expression ',' Expression (',' Expression)? ')'
     */
    strReplaceExpression = this.RULE('strReplaceExpression', () => {
        this.CONSUME(DocumentToken.REPLACE_KW);
        this.CONSUME(DocumentToken.LPARENT);
        this.SUBRULE1(this.expression);
        this.CONSUME1(DocumentToken.COMMA);
        this.SUBRULE2(this.expression);
        this.CONSUME2(DocumentToken.COMMA);
        this.SUBRULE3(this.expression);
        this.OPTION(() => {
            this.CONSUME3(DocumentToken.COMMA);
            this.SUBRULE4(this.expression);
        });
        this.CONSUME(DocumentToken.RPARENT);
    });

    /**
     * [135] ExistsFunc ::= 'EXISTS' GroupGraphPattern
     */
    existsFunc = this.RULE('existsFunc', () => {
        this.CONSUME(DocumentToken.EXISTS);
        this.SUBRULE(this.groupGraphPattern);
    });

    /**
     * [136] NotExistsFunc ::= 'NOT' 'EXISTS' GroupGraphPattern
     */
    notExistsFunc = this.RULE('notExistsFunc', () => {
        this.CONSUME(DocumentToken.NOT);
        this.CONSUME(DocumentToken.EXISTS);
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
                    this.CONSUME(DocumentToken.COUNT);
                    this.CONSUME1(DocumentToken.LPARENT);
                    this.OPTION1(() => this.CONSUME1(DocumentToken.DISTINCT));
                    this.OR2([
                        { ALT: () => this.CONSUME(DocumentToken.STAR) },
                        { ALT: () => this.SUBRULE1(this.expression) }
                    ]);
                    this.CONSUME1(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SUM);
                    this.CONSUME2(DocumentToken.LPARENT);
                    this.OPTION2(() => this.CONSUME2(DocumentToken.DISTINCT));
                    this.SUBRULE2(this.expression);
                    this.CONSUME2(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.MIN_KW);
                    this.CONSUME3(DocumentToken.LPARENT);
                    this.OPTION3(() => this.CONSUME3(DocumentToken.DISTINCT));
                    this.SUBRULE3(this.expression);
                    this.CONSUME3(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.MAX_KW);
                    this.CONSUME4(DocumentToken.LPARENT);
                    this.OPTION4(() => this.CONSUME4(DocumentToken.DISTINCT));
                    this.SUBRULE4(this.expression);
                    this.CONSUME4(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.AVG);
                    this.CONSUME5(DocumentToken.LPARENT);
                    this.OPTION5(() => this.CONSUME5(DocumentToken.DISTINCT));
                    this.SUBRULE5(this.expression);
                    this.CONSUME5(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.SAMPLE);
                    this.CONSUME6(DocumentToken.LPARENT);
                    this.OPTION6(() => this.CONSUME6(DocumentToken.DISTINCT));
                    this.SUBRULE6(this.expression);
                    this.CONSUME6(DocumentToken.RPARENT);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(DocumentToken.GROUP_CONCAT);
                    this.CONSUME7(DocumentToken.LPARENT);
                    this.OPTION7(() => this.CONSUME7(DocumentToken.DISTINCT));
                    this.SUBRULE7(this.expression);
                    this.OPTION8(() => {
                        this.CONSUME(DocumentToken.SEMICOLON);
                        this.CONSUME(DocumentToken.SEPARATOR);
                        this.CONSUME(DocumentToken.EQ);
                        this.SUBRULE(this.string);
                    });
                    this.CONSUME7(DocumentToken.RPARENT);
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
                { ALT: () => this.CONSUME(DocumentToken.LANGTAG) },
                {
                    ALT: () => {
                        this.CONSUME(DocumentToken.DCARET);
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
            { ALT: () => this.CONSUME(DocumentToken.INTEGER) },
            { ALT: () => this.CONSUME(DocumentToken.DECIMAL) },
            { ALT: () => this.CONSUME(DocumentToken.DOUBLE) }
        ]);
    });

    /**
     * [142] NumericLiteralPositive ::= INTEGER_POSITIVE | DECIMAL_POSITIVE | DOUBLE_POSITIVE
     */
    numericLiteralPositive = this.RULE('numericLiteralPositive', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.INTEGER_POSITIVE) },
            { ALT: () => this.CONSUME(DocumentToken.DECIMAL_POSITIVE) },
            { ALT: () => this.CONSUME(DocumentToken.DOUBLE_POSITIVE) }
        ]);
    });

    /**
     * [143] NumericLiteralNegative ::= INTEGER_NEGATIVE | DECIMAL_NEGATIVE | DOUBLE_NEGATIVE
     */
    numericLiteralNegative = this.RULE('numericLiteralNegative', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.INTEGER_NEGATIVE) },
            { ALT: () => this.CONSUME(DocumentToken.DECIMAL_NEGATIVE) },
            { ALT: () => this.CONSUME(DocumentToken.DOUBLE_NEGATIVE) }
        ]);
    });

    /**
     * [144] BooleanLiteral ::= 'true' | 'false'
     */
    booleanLiteral = this.RULE('booleanLiteral', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.TRUE) },
            { ALT: () => this.CONSUME(DocumentToken.FALSE) }
        ]);
    });

    /**
     * [145] String ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE | STRING_LITERAL_LONG_QUOTE | STRING_LITERAL_LONG_SINGLE_QUOTE
     */
    string = this.RULE('string', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(DocumentToken.STRING_LITERAL_SINGLE_QUOTE) },
            { ALT: () => this.CONSUME(DocumentToken.STRING_LITERAL_LONG_QUOTE) },
            { ALT: () => this.CONSUME(DocumentToken.STRING_LITERAL_LONG_SINGLE_QUOTE) }
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
            { ALT: () => this.CONSUME(DocumentToken.IRIREF) },
            { ALT: () => this.SUBRULE(this.prefixedName) }
        ]);
    });

    /**
     * [147] PrefixedName ::= PNAME_LN | PNAME_NS
     */
    prefixedName = this.RULE('prefixedName', () => {
        const token = this.OR([
            { ALT: () => this.CONSUME(DocumentToken.PNAME_LN) },
            { ALT: () => this.CONSUME(DocumentToken.PNAME_NS) }
        ]);

        if (token?.image) {
            const n = token.image.indexOf(':');
            const prefix = n > -1 ? token.image.slice(0, n) : token.image;

            if (this.namespaces[prefix] === undefined) {
                const error = new Error(`Undefined prefix: ${prefix}`);
                (error as any).name = 'UndefinedNamespacePrefixError';
                (error as any).token = token;
                (error as any).ruleStack = [...(this as any).RULE_OCCURRENCE_STACK];

                if (this._throwOnErrors) {
                    throw error;
                } else {
                    this.semanticErrors.push(error as IRecognitionException);
                }
            }
        }
    });

    /**
     * [148] BlankNode ::= BLANK_NODE_LABEL | ANON
     */
    blankNode = this.RULE('blankNode', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME(DocumentToken.LBRACKET);
        this.CONSUME(DocumentToken.RBRACKET);
    });

    // ==========================================
    // Var and helper productions
    // ==========================================

    /**
     * Var ::= VAR1 | VAR2
     */
    var = this.RULE('var', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.VAR1) },
            { ALT: () => this.CONSUME(DocumentToken.VAR2) }
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
            { ALT: () => this.CONSUME(DocumentToken.NIL) },
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
        this.CONSUME(DocumentToken.LBRACKET);
        this.SUBRULE(this.propertyListNotEmpty);
        this.CONSUME(DocumentToken.RBRACKET);
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
        this.CONSUME(DocumentToken.LBRACKET);
        this.SUBRULE(this.propertyListPathNotEmpty);
        this.CONSUME(DocumentToken.RBRACKET);
    });

    /**
     * Collection ::= '(' GraphNode+ ')'
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(DocumentToken.LPARENT);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.graphNode));
        this.CONSUME(DocumentToken.RPARENT);
    });

    /**
     * CollectionPath ::= '(' GraphNodePath+ ')'
     */
    collectionPath = this.RULE('collectionPath', () => {
        this.CONSUME(DocumentToken.LPARENT);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.graphNodePath));
        this.CONSUME(DocumentToken.RPARENT);
    });

    /**
     * ValuesClause ::= ('VALUES' DataBlock)?
     */
    valuesClause = this.RULE('valuesClause', () => {
        this.OPTION(() => {
            this.CONSUME(DocumentToken.VALUES);
            this.SUBRULE(this.dataBlock);
        });
    });
}
