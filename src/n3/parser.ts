import { Lexer, CstParser, IToken, CstNode, TokenType } from 'chevrotain';
import { TOKENS } from '../tokens.js';
import { IParser } from '../syntax.js';

// N3 token order - note that longer/more specific patterns must come before shorter ones
const allTokens: TokenType[] = [
    TOKENS.WS,
    TOKENS.COMMA,
    TOKENS.SEMICOLON,
    TOKENS.DCARET,         // ^^ before CARET ^
    TOKENS.LBRACKET,
    TOKENS.RBRACKET,
    TOKENS.LPARENT,
    TOKENS.RPARENT,
    TOKENS.LCURLY,
    TOKENS.RCURLY,
    TOKENS.IMPLIES,        // => before EQUALS_SIGN =
    TOKENS.IMPLIED_BY,     // <= before EQUALS_SIGN = and before IRIREF <
    TOKENS.EQUALS_SIGN,    // =
    TOKENS.INVERSE_OF,     // <- before IRIREF <
    TOKENS.EXCL,           // !
    TOKENS.CARET,          // ^ (single caret, after DCARET ^^)
    TOKENS.A,
    TOKENS.TRUE,
    TOKENS.FALSE,
    TOKENS.FORALL,         // @forAll before PREFIX @prefix
    TOKENS.FORSOME,        // @forSome before PREFIX @prefix
    TOKENS.TTL_PREFIX,
    TOKENS.TTL_BASE,
    TOKENS.PREFIX,
    TOKENS.BASE,
    TOKENS.HAS,
    TOKENS.IS,
    TOKENS.OF,
    TOKENS.QUICK_VAR,
    TOKENS.PNAME_LN,
    TOKENS.PNAME_NS,
    TOKENS.BLANK_NODE_LABEL,
    TOKENS.LANGTAG,
    TOKENS.DOUBLE,
    TOKENS.DECIMAL,
    TOKENS.INTEGER,
    TOKENS.PERIOD,
    TOKENS.IRIREF,
    TOKENS.STRING_LITERAL_LONG_SINGLE_QUOTE,
    TOKENS.STRING_LITERAL_LONG_QUOTE,
    TOKENS.STRING_LITERAL_SINGLE_QUOTE,
    TOKENS.STRING_LITERAL_QUOTE,
    TOKENS.COMMENT,
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
export class N3Parser extends CstParser implements IParser {
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
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed document.
     * @param tokens A set of tokens created by the lexer.
     * @param throwOnErrors Whether to throw an error if any parsing errors are detected. Defaults to true.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(tokens: IToken[], throwOnErrors: boolean = true): CstNode {
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
                        this.CONSUME(TOKENS.PERIOD);
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
        this.CONSUME(TOKENS.TTL_PREFIX);
        const prefixToken = this.CONSUME(TOKENS.PNAME_NS);
        const iriToken = this.CONSUME(TOKENS.IRIREF);

        this.registerNamespace(prefixToken, iriToken);
    });

    /**
     * base ::= '@base' IRIREF '.'
     * Note: The '.' is consumed by n3Doc.
     */
    base = this.RULE('base', () => {
        this.CONSUME(TOKENS.TTL_BASE);
        this.CONSUME(TOKENS.IRIREF);
    });

    /**
     * sparqlPrefix ::= 'PREFIX' PNAME_NS IRIREF
     */
    sparqlPrefix = this.RULE('sparqlPrefix', () => {
        this.CONSUME(TOKENS.PREFIX);
        const prefixToken = this.CONSUME(TOKENS.PNAME_NS);
        const iriToken = this.CONSUME(TOKENS.IRIREF);

        this.registerNamespace(prefixToken, iriToken);
    });

    /**
     * sparqlBase ::= 'BASE' IRIREF
     */
    sparqlBase = this.RULE('sparqlBase', () => {
        this.CONSUME(TOKENS.BASE);
        this.CONSUME(TOKENS.IRIREF);
    });

    /**
     * @forAll :x, :y, :z.
     */
    forAll = this.RULE('forAll', () => {
        this.CONSUME(TOKENS.FORALL);
        this.SUBRULE1(this.iri);
        this.MANY(() => {
            this.CONSUME(TOKENS.COMMA);
            this.SUBRULE2(this.iri);
        });
    });

    /**
     * @forSome :a, :b, :c.
     */
    forSome = this.RULE('forSome', () => {
        this.CONSUME(TOKENS.FORSOME);
        this.SUBRULE1(this.iri);
        this.MANY(() => {
            this.CONSUME(TOKENS.COMMA);
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
            this.CONSUME(TOKENS.SEMICOLON);

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
            { ALT: () => this.CONSUME(TOKENS.A) },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.HAS);
                    this.SUBRULE1(this.expression);
                }
            },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.IS);
                    this.SUBRULE2(this.expression);
                    this.CONSUME(TOKENS.OF);
                }
            },
            { ALT: () => this.CONSUME(TOKENS.EQUALS_SIGN) },
            { ALT: () => this.CONSUME(TOKENS.IMPLIED_BY) },
            { ALT: () => this.CONSUME(TOKENS.IMPLIES) },
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
                    this.CONSUME(TOKENS.INVERSE_OF);
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
            this.CONSUME(TOKENS.COMMA);
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
                        this.CONSUME(TOKENS.EXCL);
                        this.SUBRULE1(this.path);
                    }
                },
                {
                    ALT: () => {
                        this.CONSUME(TOKENS.CARET);
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
        this.CONSUME(TOKENS.LCURLY);
        this.OPTION(() => this.SUBRULE(this.formulaContent));
        this.CONSUME(TOKENS.RCURLY);
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
                        this.CONSUME(TOKENS.PERIOD);
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
        this.CONSUME(TOKENS.QUICK_VAR);
    });

    // ── Collections ────────────────────────────────────────────────────────

    /**
     * collection ::= '(' object* ')'
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(TOKENS.LPARENT);
        this.MANY(() => this.SUBRULE(this.object));
        this.CONSUME(TOKENS.RPARENT);
    });

    // ── Blank Node Property List ───────────────────────────────────────────

    /**
     * blankNodePropertyList ::= '[' predicateObjectList ']'
     */
    blankNodePropertyList = this.RULE('blankNodePropertyList', () => {
        this.CONSUME1(TOKENS.LBRACKET);
        this.SUBRULE(this.predicateObjectList);
        this.CONSUME2(TOKENS.RBRACKET);
    });

    // ── IRIs ───────────────────────────────────────────────────────────────

    /**
     * iri ::= IRIREF | prefixedName
     */
    iri = this.RULE('iri', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.IRIREF) },
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
            { ALT: () => this.CONSUME(TOKENS.PNAME_LN) },
            { ALT: () => this.CONSUME(TOKENS.PNAME_NS) },
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
            { ALT: () => this.CONSUME(TOKENS.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME1(TOKENS.LBRACKET);
        this.MANY(() => this.CONSUME2(TOKENS.WS));
        this.CONSUME3(TOKENS.RBRACKET);
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
            { ALT: () => this.CONSUME(TOKENS.INTEGER) },
            { ALT: () => this.CONSUME(TOKENS.DECIMAL) },
            { ALT: () => this.CONSUME(TOKENS.DOUBLE) }
        ]);
    });

    booleanLiteral = this.RULE('booleanLiteral', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.TRUE) },
            { ALT: () => this.CONSUME(TOKENS.FALSE) }
        ]);
    });

    stringLiteral = this.RULE('stringLiteral', () => {
        this.SUBRULE1(this.string);

        this.OPTION(() => {
            this.OR([
                { ALT: () => this.CONSUME(TOKENS.LANGTAG) },
                { ALT: () => this.SUBRULE2(this.datatype) }
            ]);
        });
    });

    string = this.RULE('string', () => {
        this.OR([
            { ALT: () => this.CONSUME1(TOKENS.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME2(TOKENS.STRING_LITERAL_SINGLE_QUOTE) },
            { ALT: () => this.CONSUME3(TOKENS.STRING_LITERAL_LONG_QUOTE) },
            { ALT: () => this.CONSUME4(TOKENS.STRING_LITERAL_LONG_SINGLE_QUOTE) }
        ]);
    });

    datatype = this.RULE('datatype', () => {
        this.CONSUME(TOKENS.DCARET);
        this.SUBRULE(this.iri);
    });
}
