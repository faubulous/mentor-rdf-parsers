import { Lexer, CstParser, IToken, CstNode, TokenType, ILexingResult } from 'chevrotain';
import { RdfToken } from '../tokens.js';
import { IParser, ILexer } from '../syntax.js';
import { assignBlankNodeIds, BlankNodeIdGenerator, defaultBlankNodeIdGenerator } from '../utils.js';

// TODO:
// - Define 'triples' acoording to https://www.w3.org/TR/n-quads/#grammar-production-triples

// The order of tokens matters if multiple can match the same text
const allTokens: TokenType[] = [
    RdfToken.WS,
    RdfToken.COMMA,
    RdfToken.SEMICOLON,
    RdfToken.DCARET,
    RdfToken.LBRACKET,
    RdfToken.RBRACKET,
    RdfToken.OPEN_ANNOTATION,
    RdfToken.CLOSE_ANNOTATION,
    RdfToken.OPEN_TRIPLE_TERM,
    RdfToken.CLOSE_TRIPLE_TERM,
    RdfToken.OPEN_REIFIED_TRIPLE,
    RdfToken.CLOSE_REIFIED_TRIPLE,
    RdfToken.TILDE,
    RdfToken.LPARENT,
    RdfToken.RPARENT,
    RdfToken.A,
    RdfToken.TRUE,
    RdfToken.FALSE,
    RdfToken.VERSION,
    RdfToken.TTL_PREFIX,
    RdfToken.TTL_BASE,
    RdfToken.SPARQL_VERSION,
    RdfToken.PREFIX,
    RdfToken.BASE,
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
 * A W3C compliant lexer for the Turtle syntax.
 */
export class TurtleLexer extends Lexer implements ILexer {
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
 * A base class for W3C compliant parsers for the Turtle syntax.
 */
export class TurtleParserBase extends CstParser {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces: Record<string, string> = {};

    /**
     * Whether to throw errors during parsing or collect them.
     */
    protected _throwOnErrors: boolean = true;

    /**
     * Semantic errors collected during parsing (e.g., UndefinedNamespacePrefixError).
     */
    semanticErrors: any[] = [];

    // These are declared here but defined in derived classes
    protected subject!: ReturnType<typeof this.RULE>;
    protected object!: ReturnType<typeof this.RULE>;

    registerNamespace(prefixToken: IToken, iriToken: IToken) {
        const prefix = prefixToken.image.slice(0, -1);
        const iri = iriToken.image.slice(1, -1);

        this.namespaces[prefix] = iri;
    }

    directive = this.RULE('directive', () => {
        this.OR([
            { ALT: () => this.SUBRULE1(this.prefix) },
            { ALT: () => this.SUBRULE2(this.base) },
            { ALT: () => this.SUBRULE3(this.sparqlPrefix) },
            { ALT: () => this.SUBRULE4(this.sparqlBase) },
            { ALT: () => this.SUBRULE5(this.version) },
            { ALT: () => this.SUBRULE6(this.sparqlVersion) }
        ]);
    });

    /**
    * https://www.w3.org/TR/rdf12-turtle/#grammar-production-triples
    */
    triples = this.RULE('triples', () => {
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE1(this.subject);
                    this.SUBRULE2(this.predicateObjectList);
                }
            }, {
                ALT: () => {
                    this.SUBRULE(this.blankNodePropertyList);
                    this.OPTION(() => {
                        this.SUBRULE(this.predicateObjectList);
                    });
                }
            }, {
                ALT: () => {
                    this.SUBRULE(this.reifiedTriple);
                    this.OPTION2(() => {
                        this.SUBRULE3(this.predicateObjectList);
                    });
                }
            }
        ]);
    });

    /**
     * https://www.w3.org/TR/n-quads/#grammar-production-predicate
     */
    predicate = this.RULE('predicate', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.CONSUME(RdfToken.A) }
        ]);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-iri
     */
    iri = this.RULE('iri', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.IRIREF) },
            { ALT: () => this.SUBRULE(this.prefixedName) }
        ]);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-BlankNode
     */
    blankNode = this.RULE('blankNode', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-PrefixedName
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
                const error = new Error(`Undefined prefix: ${prefix}`);
                (error as any).name = 'UndefinedNamespacePrefixError';
                (error as any).token = token;
                (error as any).ruleStack = [...(this as any).RULE_OCCURRENCE_STACK];

                if (this._throwOnErrors) {
                    throw error;
                } else {
                    this.semanticErrors.push(error);
                }
            }
        }
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-prefixID
     */
    prefix = this.RULE('prefix', () => {
        this.CONSUME(RdfToken.TTL_PREFIX);
        const prefix = this.CONSUME(RdfToken.PNAME_NS);
        const iri = this.CONSUME(RdfToken.IRIREF);
        this.CONSUME(RdfToken.PERIOD);

        this.registerNamespace(prefix, iri);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-base
     */
    base = this.RULE('base', () => {
        this.CONSUME(RdfToken.TTL_BASE);
        this.CONSUME(RdfToken.IRIREF);
        this.CONSUME(RdfToken.PERIOD);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-sparqlPrefix
     */
    sparqlPrefix = this.RULE('sparqlPrefix', () => {
        this.CONSUME(RdfToken.PREFIX);
        const prefix = this.CONSUME(RdfToken.PNAME_NS);
        const iri = this.CONSUME(RdfToken.IRIREF);

        this.registerNamespace(prefix, iri);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-sparqlBase
     */
    sparqlBase = this.RULE('sparqlBase', () => {
        this.CONSUME(RdfToken.BASE);
        this.CONSUME(RdfToken.IRIREF);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-version
     * version ::= '@version' VersionSpecifier '.'
     */
    version = this.RULE('version', () => {
        this.CONSUME(RdfToken.VERSION);
        this.SUBRULE(this.versionSpecifier);
        this.CONSUME(RdfToken.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-sparqlVersion
     * sparqlVersion ::= "VERSION" VersionSpecifier
     */
    sparqlVersion = this.RULE('sparqlVersion', () => {
        this.CONSUME(RdfToken.SPARQL_VERSION);
        this.SUBRULE(this.versionSpecifier);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-VersionSpecifier
     * VersionSpecifier ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE
     */
    versionSpecifier = this.RULE('versionSpecifier', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(RdfToken.STRING_LITERAL_SINGLE_QUOTE) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-reifiedTriple
     * reifiedTriple ::= '<<' rtSubject verb rtObject reifier? '>>'
     */
    reifiedTriple = this.RULE('reifiedTriple', () => {
        this.CONSUME(RdfToken.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.rtSubject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.rtObject);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(RdfToken.CLOSE_REIFIED_TRIPLE);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-rtSubject
     * rtSubject ::= iri | BlankNode | reifiedTriple
     */
    rtSubject = this.RULE('rtSubject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.SUBRULE(this.reifiedTriple) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-rtObject
     * rtObject ::= iri | BlankNode | literal | tripleTerm | reifiedTriple
     */
    rtObject = this.RULE('rtObject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.SUBRULE(this.literal) },
            { ALT: () => this.SUBRULE(this.tripleTerm) },
            { ALT: () => this.SUBRULE(this.reifiedTriple) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-tripleTerm
     * tripleTerm ::= '<<(' ttSubject verb ttObject ')>>'
     */
    tripleTerm = this.RULE('tripleTerm', () => {
        this.CONSUME(RdfToken.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.ttSubject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.ttObject);
        this.CONSUME(RdfToken.CLOSE_TRIPLE_TERM);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-ttSubject
     * ttSubject ::= iri | BlankNode
     */
    ttSubject = this.RULE('ttSubject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.blankNode) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-ttObject
     * ttObject ::= iri | BlankNode | literal | tripleTerm
     */
    ttObject = this.RULE('ttObject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.SUBRULE(this.literal) },
            { ALT: () => this.SUBRULE(this.tripleTerm) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-reifier
     * reifier ::= '~' (iri | BlankNode)?
     */
    reifier = this.RULE('reifier', () => {
        this.CONSUME(RdfToken.TILDE);
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.iri) },
                { ALT: () => this.SUBRULE(this.blankNode) }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-annotation
     * annotation ::= (reifier | annotationBlock)*
     */
    annotation = this.RULE('annotation', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.reifier) },
                { ALT: () => this.SUBRULE(this.annotationBlock) }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-annotationBlock
     * annotationBlock ::= '{|' predicateObjectList '|}'
     */
    annotationBlock = this.RULE('annotationBlock', () => {
        this.CONSUME(RdfToken.OPEN_ANNOTATION);
        this.SUBRULE(this.predicateObjectList);
        this.CONSUME(RdfToken.CLOSE_ANNOTATION);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-collection
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(RdfToken.LPARENT);
        this.MANY(() => this.SUBRULE(this.object));
        this.CONSUME(RdfToken.RPARENT);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-predicateObjectList
     */
    predicateObjectList = this.RULE('predicateObjectList', () => {
        this.SUBRULE1(this.predicate);
        this.SUBRULE2(this.objectList);

        this.MANY(() => {
            this.CONSUME(RdfToken.SEMICOLON);

            this.OPTION(() => {
                this.SUBRULE3(this.predicate);
                this.SUBRULE4(this.objectList);
            });
        });
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-objectList
     * objectList ::= object annotation ( ',' object annotation )*
     */
    objectList = this.RULE('objectList', () => {
        this.SUBRULE1(this.object);
        this.SUBRULE1(this.annotation);

        this.MANY(() => {
            this.CONSUME(RdfToken.COMMA);
            this.SUBRULE2(this.object);
            this.SUBRULE2(this.annotation);
        });
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-blankNodePropertyList
     */
    blankNodePropertyList = this.RULE('blankNodePropertyList', () => {
        this.CONSUME1(RdfToken.LBRACKET);

        this.SUBRULE(this.predicateObjectList);

        this.CONSUME2(RdfToken.RBRACKET);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME1(RdfToken.LBRACKET);

        this.MANY(() => {
            this.CONSUME2(RdfToken.WS);
        });

        this.CONSUME3(RdfToken.RBRACKET);
    });

    /**
     * https://www.w3.org/TR/n-quads/#grammar-production-literal
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

/**
 * A W3C compliant parser for the Turtle syntax.
 * https://www.w3.org/TR/turtle
 */
export class TurtleParser extends TurtleParserBase implements IParser {

    constructor() {
        super(allTokens, {
            recoveryEnabled: true
        });

        this.performSelfAnalysis();
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

        const cst = this.turtleDoc();

        if (throwOnErrors && this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    /**
     * https://www.w3.org/TR/n-quads/#grammar-production-turtleDoc
     */
    turtleDoc = this.RULE('turtleDoc', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.directive) },
                {
                    ALT: () => {
                        this.SUBRULE(this.triples);
                        this.CONSUME(RdfToken.PERIOD);
                    }
                }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/n-quads/#grammar-production-subject
     */
    subject = this.RULE('subject', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.iri) },
            { ALT: () => this.SUBRULE(this.blankNode) },
            { ALT: () => this.SUBRULE(this.collection) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-object
     */
    object = this.RULE('object', () => {
        this.OR([
            { ALT: () => this.SUBRULE1(this.iri) },
            { ALT: () => this.SUBRULE2(this.blankNode) },
            { ALT: () => this.SUBRULE3(this.collection) },
            { ALT: () => this.SUBRULE4(this.blankNodePropertyList) },
            { ALT: () => this.SUBRULE5(this.literal) },
            { ALT: () => this.SUBRULE6(this.tripleTerm) },
            { ALT: () => this.SUBRULE7(this.reifiedTriple) },
        ]);
    });
}
