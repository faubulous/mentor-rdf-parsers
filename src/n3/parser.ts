import { Lexer, CstParser, IToken, CstNode, TokenType, IRecognitionException, ILexingResult } from 'chevrotain';
import { RdfToken } from '../tokens.js';
import { IParser, ILexer } from '../syntax.js';
import { assignBlankNodeIds, BlankNodeIdGenerator, defaultBlankNodeIdGenerator } from '../utils.js';

// N3 token order - note that longer/more specific patterns must come before shorter ones
const allTokens: TokenType[] = [
    RdfToken.WS,
    RdfToken.COMMA,
    RdfToken.SEMICOLON,
    RdfToken.DCARET,         // ^^ before CARET ^
    RdfToken.LBRACKET,
    RdfToken.RBRACKET,
    RdfToken.LPARENT,
    RdfToken.RPARENT,
    RdfToken.LCURLY,
    RdfToken.RCURLY,
    RdfToken.IMPLIES,        // => before EQUALS_SIGN =
    RdfToken.IMPLIED_BY,     // <= before EQUALS_SIGN = and before IRIREF <
    RdfToken.EQUALS_SIGN,    // =
    RdfToken.INVERSE_OF,     // <- before IRIREF <
    RdfToken.EXCL,           // !
    RdfToken.CARET,          // ^ (single caret, after DCARET ^^)
    RdfToken.A,
    RdfToken.TRUE,
    RdfToken.FALSE,
    RdfToken.FORALL,         // @forAll before PREFIX @prefix
    RdfToken.FORSOME,        // @forSome before PREFIX @prefix
    RdfToken.TTL_PREFIX,
    RdfToken.TTL_BASE,
    RdfToken.PREFIX,
    RdfToken.BASE,
    RdfToken.HAS,
    RdfToken.IS,
    RdfToken.OF,
    RdfToken.QUICK_VAR,
    RdfToken.PNAME_LN,
    RdfToken.PNAME_NS,
    RdfToken.BLANK_NODE_LABEL,
    RdfToken.LANGTAG,
    RdfToken.DOUBLE,
    RdfToken.DECIMAL,
    RdfToken.INTEGER,
    RdfToken.PERIOD,
    RdfToken.IRIREF,
    RdfToken.STRING_LITERAL_LONG_SINGLE_QUOTE,
    RdfToken.STRING_LITERAL_LONG_QUOTE,
    RdfToken.STRING_LITERAL_SINGLE_QUOTE,
    RdfToken.STRING_LITERAL_QUOTE,
    RdfToken.COMMENT,
];

/**
 * A W3C compliant lexer for the N3 (Notation3) syntax.
 */
export class N3Lexer extends Lexer implements ILexer {
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

    /**
     * Tokenizes a string input and optionally assigns blank node IDs to relevant tokens.
     */
    tokenize(text: string, initialMode?: string): ILexingResult {
        const result = super.tokenize(text, initialMode);

        // Unless explicitly disabled (null), assign blank node IDs
        if (this.blankNodeIdGenerator !== null) {
            assignBlankNodeIds(result.tokens, this.blankNodeIdGenerator ?? defaultBlankNodeIdGenerator);
        }

        return result;
    }
}

/**
 * A W3C compliant parser for the N3 (Notation3) syntax.
 * Based on the N3 grammar: https://w3c.github.io/N3/spec/
 *
 * n3Doc ::= (n3Statement '.' | sparqlDirective)* EOF
 * n3Statement ::= n3Directive | triples
 * n3Directive ::= prefixID | base | forAll | forSome
 * triples ::= subject predicateObjectList?
 *
 * verb ::= predicate | 'a' | 'has' expression | 'is' expression 'of' | '=' | '<=' | '=>'
 * predicate ::= expression | '<-' expression
 * expression ::= path
 * path ::= pathItem ('!' path | '^' path)?
 * pathItem ::= iri | blankNode | quickVar | collection | blankNodePropertyList | literal | formula
 * formula ::= '{' formulaContent? '}'
 * formulaContent ::= n3Statement ('.' formulaContent?)? | sparqlDirective formulaContent?
 */
export class N3Parser extends CstParser implements IParser {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces: Record<string, string> = {};

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

        const cst = this.n3Doc();

        if (throwOnErrors && this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    // ── Top-level ──────────────────────────────────────────────────────────

    /**
     * n3Doc ::= (n3Statement '.' | sparqlDirective)* EOF
     */
    n3Doc = this.RULE('n3Doc', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.sparqlDirective) },
                {
                    ALT: () => {
                        this.SUBRULE(this.n3Statement);
                        this.CONSUME(RdfToken.PERIOD);
                    }
                }
            ]);
        });
    });

    /**
     * n3Statement ::= n3Directive | triples
     */
    n3Statement = this.RULE('n3Statement', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.n3Directive) },
            { ALT: () => this.SUBRULE(this.triples) }
        ]);
    });

    /**
     * n3Directive ::= prefixID | base | forAll | forSome
     */
    n3Directive = this.RULE('n3Directive', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.prefix) },
            { ALT: () => this.SUBRULE(this.base) },
            { ALT: () => this.SUBRULE(this.forAll) },
            { ALT: () => this.SUBRULE(this.forSome) }
        ]);
    });

    /**
     * sparqlDirective ::= sparqlPrefix | sparqlBase
     */
    sparqlDirective = this.RULE('sparqlDirective', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.sparqlPrefix) },
            { ALT: () => this.SUBRULE(this.sparqlBase) }
        ]);
    });

    // ── Directives ─────────────────────────────────────────────────────────

    /**
     * prefixID ::= '@prefix' PNAME_NS IRIREF '.'
     * Note: The '.' is consumed by n3Doc.
     */
    prefix = this.RULE('prefix', () => {
        this.CONSUME(RdfToken.TTL_PREFIX);
        const prefixToken = this.CONSUME(RdfToken.PNAME_NS);
        const iriToken = this.CONSUME(RdfToken.IRIREF);

        this.registerNamespace(prefixToken, iriToken);
    });

    /**
     * base ::= '@base' IRIREF '.'
     * Note: The '.' is consumed by n3Doc.
     */
    base = this.RULE('base', () => {
        this.CONSUME(RdfToken.TTL_BASE);
        this.CONSUME(RdfToken.IRIREF);
    });

    /**
     * sparqlPrefix ::= 'PREFIX' PNAME_NS IRIREF
     */
    sparqlPrefix = this.RULE('sparqlPrefix', () => {
        this.CONSUME(RdfToken.PREFIX);
        const prefixToken = this.CONSUME(RdfToken.PNAME_NS);
        const iriToken = this.CONSUME(RdfToken.IRIREF);

        this.registerNamespace(prefixToken, iriToken);
    });

    /**
     * sparqlBase ::= 'BASE' IRIREF
     */
    sparqlBase = this.RULE('sparqlBase', () => {
        this.CONSUME(RdfToken.BASE);
        this.CONSUME(RdfToken.IRIREF);
    });

    /**
     * @forAll :x, :y, :z.
     */
    forAll = this.RULE('forAll', () => {
        this.CONSUME(RdfToken.FORALL);
        this.SUBRULE1(this.iri);
        this.MANY(() => {
            this.CONSUME(RdfToken.COMMA);
            this.SUBRULE2(this.iri);
        });
    });

    /**
     * @forSome :a, :b, :c.
     */
    forSome = this.RULE('forSome', () => {
        this.CONSUME(RdfToken.FORSOME);
        this.SUBRULE1(this.iri);
        this.MANY(() => {
            this.CONSUME(RdfToken.COMMA);
            this.SUBRULE2(this.iri);
        });
    });

    // ── Triples ────────────────────────────────────────────────────────────

    /**
     * triples ::= subject predicateObjectList?
     *
     * In N3, subjects with zero predicates are valid (e.g., `:a .`).
     */
    triples = this.RULE('triples', () => {
        this.SUBRULE(this.subject);
        this.OPTION(() => {
            this.SUBRULE(this.predicateObjectList);
        });
    });

    /**
     * subject ::= expression
     */
    subject = this.RULE('subject', () => {
        this.SUBRULE(this.expression);
    });

    /**
     * predicateObjectList ::= verb objectList (';' (verb objectList)?)*
     */
    predicateObjectList = this.RULE('predicateObjectList', () => {
        this.SUBRULE1(this.verb);
        this.SUBRULE1(this.objectList);

        this.MANY(() => {
            this.CONSUME(RdfToken.SEMICOLON);

            this.OPTION(() => {
                this.SUBRULE2(this.verb);
                this.SUBRULE2(this.objectList);
            });
        });
    });

    /**
     * verb ::= predicate | 'a' | 'has' expression | 'is' expression 'of' | '=' | '<=' | '=>'
     */
    verb = this.RULE('verb', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.A) },
            {
                ALT: () => {
                    this.CONSUME(RdfToken.HAS);
                    this.SUBRULE1(this.expression);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(RdfToken.IS);
                    this.SUBRULE2(this.expression);
                    this.CONSUME(RdfToken.OF);
                }
            },
            { ALT: () => this.CONSUME(RdfToken.EQUALS_SIGN) },
            { ALT: () => this.CONSUME(RdfToken.IMPLIED_BY) },
            { ALT: () => this.CONSUME(RdfToken.IMPLIES) },
            { ALT: () => this.SUBRULE3(this.predicate) }
        ]);
    });

    /**
     * predicate ::= expression | '<-' expression
     */
    predicate = this.RULE('predicate', () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(RdfToken.INVERSE_OF);
                    this.SUBRULE1(this.expression);
                }
            },
            { ALT: () => this.SUBRULE2(this.expression) }
        ]);
    });

    /**
     * objectList ::= object (',' object)*
     */
    objectList = this.RULE('objectList', () => {
        this.SUBRULE1(this.object);
        this.MANY(() => {
            this.CONSUME(RdfToken.COMMA);
            this.SUBRULE2(this.object);
        });
    });

    /**
     * object ::= expression
     */
    object = this.RULE('object', () => {
        this.SUBRULE(this.expression);
    });

    // ── Expressions & Paths ────────────────────────────────────────────────

    /**
     * expression ::= path
     */
    expression = this.RULE('expression', () => {
        this.SUBRULE(this.path);
    });

    /**
     * path ::= pathItem ('!' path | '^' path)?
     */
    path = this.RULE('path', () => {
        this.SUBRULE(this.pathItem);

        this.OPTION(() => {
            this.OR([
                {
                    ALT: () => {
                        this.CONSUME(RdfToken.EXCL);
                        this.SUBRULE1(this.path);
                    }
                },
                {
                    ALT: () => {
                        this.CONSUME(RdfToken.CARET);
                        this.SUBRULE2(this.path);
                    }
                }
            ]);
        });
    });

    /**
     * pathItem ::= iri | blankNode | quickVar | collection | blankNodePropertyList | literal | formula
     */
    pathItem = this.RULE('pathItem', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.formula) },
            { ALT: () => this.SUBRULE(this.collection) },
            { ALT: () => this.SUBRULE(this.blankNodePropertyList) },
            { ALT: () => this.SUBRULE(this.quickVar) },
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.SUBRULE(this.literal) },
        ]);
    });

    // ── Formula ────────────────────────────────────────────────────────────

    /**
     * formula ::= '{' formulaContent? '}'
     */
    formula = this.RULE('formula', () => {
        this.CONSUME(RdfToken.LCURLY);
        this.OPTION(() => this.SUBRULE(this.formulaContent));
        this.CONSUME(RdfToken.RCURLY);
    });

    /**
     * formulaContent ::= n3Statement ('.' formulaContent?)? | sparqlDirective formulaContent?
     */
    formulaContent = this.RULE('formulaContent', () => {
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE1(this.sparqlDirective);
                    this.OPTION1(() => this.SUBRULE1(this.formulaContent));
                }
            },
            {
                ALT: () => {
                    this.SUBRULE2(this.n3Statement);
                    this.OPTION2(() => {
                        this.CONSUME(RdfToken.PERIOD);
                        this.OPTION3(() => this.SUBRULE2(this.formulaContent));
                    });
                }
            }
        ]);
    });

    // ── Quick Variables ────────────────────────────────────────────────────

    /**
     * quickVar ::= '?' PN_CHARS_U PN_CHARS*
     */
    quickVar = this.RULE('quickVar', () => {
        this.CONSUME(RdfToken.QUICK_VAR);
    });

    // ── Collections ────────────────────────────────────────────────────────

    /**
     * collection ::= '(' object* ')'
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(RdfToken.LPARENT);
        this.MANY(() => this.SUBRULE(this.object));
        this.CONSUME(RdfToken.RPARENT);
    });

    // ── Blank Node Property List ───────────────────────────────────────────

    /**
     * blankNodePropertyList ::= '[' predicateObjectList ']'
     */
    blankNodePropertyList = this.RULE('blankNodePropertyList', () => {
        this.CONSUME1(RdfToken.LBRACKET);
        this.SUBRULE(this.predicateObjectList);
        this.CONSUME2(RdfToken.RBRACKET);
    });

    // ── IRIs ───────────────────────────────────────────────────────────────

    /**
     * iri ::= IRIREF | prefixedName
     */
    iri = this.RULE('iri', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.IRIREF) },
            { ALT: () => this.SUBRULE(this.prefixedName) }
        ]);
    });

    /**
     * prefixedName ::= PNAME_LN | PNAME_NS
     *
     * N3 is more lenient than Turtle: it allows the empty prefix `:` to be
     * used without explicit declaration, implicitly resolving to `<#>`.
     */
    prefixedName = this.RULE('prefixedName', () => {
        const token = this.OR([
            { ALT: () => this.CONSUME(RdfToken.PNAME_LN) },
            { ALT: () => this.CONSUME(RdfToken.PNAME_NS) },
        ]);

        if (token?.image) {
            const n = token.image.indexOf(':');
            const prefix = n > -1 ? token.image.slice(0, n) : token.image;

            if (this.namespaces[prefix] === undefined) {
                // N3 allows implicit empty prefix
                if (prefix === '') {
                    this.namespaces[''] = '#';
                } else {
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
        }
    });

    // ── Blank Nodes ────────────────────────────────────────────────────────

    /**
     * blankNode ::= BLANK_NODE_LABEL | anon
     */
    blankNode = this.RULE('blankNode', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME1(RdfToken.LBRACKET);
        this.MANY(() => this.CONSUME2(RdfToken.WS));
        this.CONSUME3(RdfToken.RBRACKET);
    });

    // ── Literals ───────────────────────────────────────────────────────────

    /**
     * literal ::= stringLiteral | numericLiteral | booleanLiteral
     */
    literal = this.RULE('literal', () => {
        this.OR([
            { ALT: () => this.SUBRULE1(this.stringLiteral) },
            { ALT: () => this.SUBRULE2(this.numericLiteral) },
            { ALT: () => this.SUBRULE3(this.booleanLiteral) }
        ]);
    });

    numericLiteral = this.RULE('numericLiteral', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.INTEGER) },
            { ALT: () => this.CONSUME(RdfToken.DECIMAL) },
            { ALT: () => this.CONSUME(RdfToken.DOUBLE) }
        ]);
    });

    booleanLiteral = this.RULE('booleanLiteral', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.TRUE) },
            { ALT: () => this.CONSUME(RdfToken.FALSE) }
        ]);
    });

    stringLiteral = this.RULE('stringLiteral', () => {
        this.SUBRULE1(this.string);

        this.OPTION(() => {
            this.OR([
                { ALT: () => this.CONSUME(RdfToken.LANGTAG) },
                { ALT: () => this.SUBRULE2(this.datatype) }
            ]);
        });
    });

    string = this.RULE('string', () => {
        this.OR([
            { ALT: () => this.CONSUME1(RdfToken.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME2(RdfToken.STRING_LITERAL_SINGLE_QUOTE) },
            { ALT: () => this.CONSUME3(RdfToken.STRING_LITERAL_LONG_QUOTE) },
            { ALT: () => this.CONSUME4(RdfToken.STRING_LITERAL_LONG_SINGLE_QUOTE) }
        ]);
    });

    datatype = this.RULE('datatype', () => {
        this.CONSUME(RdfToken.DCARET);
        this.SUBRULE(this.iri);
    });
}
