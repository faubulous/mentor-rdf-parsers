import { Lexer, CstParser, IToken, CstNode, TokenType } from 'chevrotain';
import { tokens } from '../tokens.js';

// N3 token order - note that longer/more specific patterns must come before shorter ones
const allTokens: TokenType[] = [
    tokens.WS,
    tokens.COMMA,
    tokens.SEMICOLON,
    tokens.DCARET,         // ^^ before CARET ^
    tokens.LBRACKET,
    tokens.RBRACKET,
    tokens.LPARENT,
    tokens.RPARENT,
    tokens.LCURLY,
    tokens.RCURLY,
    tokens.IMPLIES,        // => before EQUALS_SIGN =
    tokens.IMPLIED_BY,     // <= before EQUALS_SIGN = and before IRIREF <
    tokens.EQUALS_SIGN,    // =
    tokens.INVERSE_OF,     // <- before IRIREF <
    tokens.EXCL,           // !
    tokens.CARET,          // ^ (single caret, after DCARET ^^)
    tokens.A,
    tokens.TRUE,
    tokens.FALSE,
    tokens.FORALL,         // @forAll before PREFIX @prefix
    tokens.FORSOME,        // @forSome before PREFIX @prefix
    tokens.PREFIX,
    tokens.BASE,
    tokens.SPARQL_PREFIX,
    tokens.SPARQL_BASE,
    tokens.HAS,
    tokens.IS,
    tokens.OF,
    tokens.QUICK_VAR,
    tokens.PNAME_LN,
    tokens.PNAME_NS,
    tokens.BLANK_NODE_LABEL,
    tokens.LANGTAG,
    tokens.DOUBLE,
    tokens.DECIMAL,
    tokens.INTEGER,
    tokens.PERIOD,
    tokens.IRIREF,
    tokens.STRING_LITERAL_LONG_SINGLE_QUOTE,
    tokens.STRING_LITERAL_LONG_QUOTE,
    tokens.STRING_LITERAL_SINGLE_QUOTE,
    tokens.STRING_LITERAL_QUOTE,
    tokens.COMMENT,
];

/**
 * A W3C compliant lexer for the N3 (Notation3) syntax.
 */
export class N3Lexer extends Lexer {
    constructor() {
        super(allTokens);
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
export class N3Parser extends CstParser {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces: Record<string, string> = {};

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
     * Parses a set of tokens into a CST.
     */
    parse(documentIri: string, inputTokens: IToken[]): CstNode {
        this.input = inputTokens;

        const cst = this.n3Doc();

        if (this.errors.length > 0) {
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
                        this.CONSUME(tokens.PERIOD);
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
        this.CONSUME(tokens.PREFIX);
        const prefixToken = this.CONSUME(tokens.PNAME_NS);
        const iriToken = this.CONSUME(tokens.IRIREF);

        this.registerNamespace(prefixToken, iriToken);
    });

    /**
     * base ::= '@base' IRIREF '.'
     * Note: The '.' is consumed by n3Doc.
     */
    base = this.RULE('base', () => {
        this.CONSUME(tokens.BASE);
        this.CONSUME(tokens.IRIREF);
    });

    /**
     * sparqlPrefix ::= 'PREFIX' PNAME_NS IRIREF
     */
    sparqlPrefix = this.RULE('sparqlPrefix', () => {
        this.CONSUME(tokens.SPARQL_PREFIX);
        const prefixToken = this.CONSUME(tokens.PNAME_NS);
        const iriToken = this.CONSUME(tokens.IRIREF);

        this.registerNamespace(prefixToken, iriToken);
    });

    /**
     * sparqlBase ::= 'BASE' IRIREF
     */
    sparqlBase = this.RULE('sparqlBase', () => {
        this.CONSUME(tokens.SPARQL_BASE);
        this.CONSUME(tokens.IRIREF);
    });

    /**
     * @forAll :x, :y, :z.
     */
    forAll = this.RULE('forAll', () => {
        this.CONSUME(tokens.FORALL);
        this.SUBRULE1(this.iri);
        this.MANY(() => {
            this.CONSUME(tokens.COMMA);
            this.SUBRULE2(this.iri);
        });
    });

    /**
     * @forSome :a, :b, :c.
     */
    forSome = this.RULE('forSome', () => {
        this.CONSUME(tokens.FORSOME);
        this.SUBRULE1(this.iri);
        this.MANY(() => {
            this.CONSUME(tokens.COMMA);
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
            this.CONSUME(tokens.SEMICOLON);

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
            { ALT: () => this.CONSUME(tokens.A) },
            {
                ALT: () => {
                    this.CONSUME(tokens.HAS);
                    this.SUBRULE1(this.expression);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(tokens.IS);
                    this.SUBRULE2(this.expression);
                    this.CONSUME(tokens.OF);
                }
            },
            { ALT: () => this.CONSUME(tokens.EQUALS_SIGN) },
            { ALT: () => this.CONSUME(tokens.IMPLIED_BY) },
            { ALT: () => this.CONSUME(tokens.IMPLIES) },
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
                    this.CONSUME(tokens.INVERSE_OF);
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
            this.CONSUME(tokens.COMMA);
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
                        this.CONSUME(tokens.EXCL);
                        this.SUBRULE1(this.path);
                    }
                },
                {
                    ALT: () => {
                        this.CONSUME(tokens.CARET);
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
        this.CONSUME(tokens.LCURLY);
        this.OPTION(() => this.SUBRULE(this.formulaContent));
        this.CONSUME(tokens.RCURLY);
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
                        this.CONSUME(tokens.PERIOD);
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
        this.CONSUME(tokens.QUICK_VAR);
    });

    // ── Collections ────────────────────────────────────────────────────────

    /**
     * collection ::= '(' object* ')'
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(tokens.LPARENT);
        this.MANY(() => this.SUBRULE(this.object));
        this.CONSUME(tokens.RPARENT);
    });

    // ── Blank Node Property List ───────────────────────────────────────────

    /**
     * blankNodePropertyList ::= '[' predicateObjectList ']'
     */
    blankNodePropertyList = this.RULE('blankNodePropertyList', () => {
        this.CONSUME1(tokens.LBRACKET);
        this.SUBRULE(this.predicateObjectList);
        this.CONSUME2(tokens.RBRACKET);
    });

    // ── IRIs ───────────────────────────────────────────────────────────────

    /**
     * iri ::= IRIREF | prefixedName
     */
    iri = this.RULE('iri', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.IRIREF) },
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
            { ALT: () => this.CONSUME(tokens.PNAME_LN) },
            { ALT: () => this.CONSUME(tokens.PNAME_NS) },
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
                    (error as any).stack = [...(this as any).RULE_OCCURRENCE_STACK];
                    throw error;
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
            { ALT: () => this.CONSUME(tokens.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME1(tokens.LBRACKET);
        this.MANY(() => this.CONSUME2(tokens.WS));
        this.CONSUME3(tokens.RBRACKET);
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
            { ALT: () => this.CONSUME(tokens.INTEGER) },
            { ALT: () => this.CONSUME(tokens.DECIMAL) },
            { ALT: () => this.CONSUME(tokens.DOUBLE) }
        ]);
    });

    booleanLiteral = this.RULE('booleanLiteral', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.TRUE) },
            { ALT: () => this.CONSUME(tokens.FALSE) }
        ]);
    });

    stringLiteral = this.RULE('stringLiteral', () => {
        this.SUBRULE1(this.string);

        this.OPTION(() => {
            this.OR([
                { ALT: () => this.CONSUME(tokens.LANGTAG) },
                { ALT: () => this.SUBRULE2(this.datatype) }
            ]);
        });
    });

    string = this.RULE('string', () => {
        this.OR([
            { ALT: () => this.CONSUME1(tokens.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME2(tokens.STRING_LITERAL_SINGLE_QUOTE) },
            { ALT: () => this.CONSUME3(tokens.STRING_LITERAL_LONG_QUOTE) },
            { ALT: () => this.CONSUME4(tokens.STRING_LITERAL_LONG_SINGLE_QUOTE) }
        ]);
    });

    datatype = this.RULE('datatype', () => {
        this.CONSUME(tokens.DCARET);
        this.SUBRULE(this.iri);
    });
}
