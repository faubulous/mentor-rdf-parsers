import { Lexer, CstParser } from 'chevrotain';
import { tokens } from '../tokens.mjs';

// TODO:
// - Define 'triples' acoording to https://www.w3.org/TR/n-quads/#grammar-production-triples

// The order of tokens matters if multiple can match the same text
const allTokens = [
    tokens.WS,
    tokens.COMMA,
    tokens.SEMICOLON,
    tokens.DCARET,
    tokens.LBRACKET,
    tokens.RBRACKET,
    tokens.OPEN_ANNOTATION,
    tokens.CLOSE_ANNOTATION,
    tokens.OPEN_TRIPLE_TERM,
    tokens.CLOSE_TRIPLE_TERM,
    tokens.OPEN_REIFIED_TRIPLE,
    tokens.CLOSE_REIFIED_TRIPLE,
    tokens.TILDE,
    tokens.LPARENT,
    tokens.RPARENT,
    tokens.A,
    tokens.TRUE,
    tokens.FALSE,
    tokens.VERSION,
    tokens.PREFIX,
    tokens.BASE,
    tokens.SPARQL_VERSION,
    tokens.SPARQL_PREFIX,
    tokens.SPARQL_BASE,
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
 * A W3C compliant lexer for the Turtle syntax.
 */
export class TurtleLexer extends Lexer {
    constructor() {
        super(allTokens);
    }
}

/**
 * A base class for W3C compliant parsers for the Turtle syntax.
 */
export class TurtleParserBase extends CstParser {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces = {};

    registerNamespace(prefixToken, iriToken) {
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
            { ALT: () => this.CONSUME(tokens.A) }
        ]);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-iri
     */
    iri = this.RULE('iri', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.IRIREF) },
            { ALT: () => this.SUBRULE(this.prefixedName) }
        ]);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-BlankNode
     */
    blankNode = this.RULE('blankNode', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.anon) }
        ]);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-PrefixedName
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
                const error = new Error(`Undefined prefix: ${prefix}`);
                error.stack = [...this.RULE_OCCURRENCE_STACK];

                throw error;
            }
        }
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-prefixID
     */
    prefix = this.RULE('prefix', () => {
        this.CONSUME(tokens.PREFIX);
        const prefix = this.CONSUME(tokens.PNAME_NS);
        const iri = this.CONSUME(tokens.IRIREF);
        this.CONSUME(tokens.PERIOD);

        this.registerNamespace(prefix, iri);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-base
     */
    base = this.RULE('base', () => {
        this.CONSUME(tokens.BASE);
        this.CONSUME(tokens.IRIREF);
        this.CONSUME(tokens.PERIOD);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-sparqlPrefix
     */
    sparqlPrefix = this.RULE('sparqlPrefix', () => {
        this.CONSUME(tokens.SPARQL_PREFIX);
        const prefix = this.CONSUME(tokens.PNAME_NS);
        const iri = this.CONSUME(tokens.IRIREF);

        this.registerNamespace(prefix, iri);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-sparqlBase
     */
    sparqlBase = this.RULE('sparqlBase', () => {
        this.CONSUME(tokens.SPARQL_BASE);
        this.CONSUME(tokens.IRIREF);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-version
     * version ::= '@version' VersionSpecifier '.'
     */
    version = this.RULE('version', () => {
        this.CONSUME(tokens.VERSION);
        this.SUBRULE(this.versionSpecifier);
        this.CONSUME(tokens.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-sparqlVersion
     * sparqlVersion ::= "VERSION" VersionSpecifier
     */
    sparqlVersion = this.RULE('sparqlVersion', () => {
        this.CONSUME(tokens.SPARQL_VERSION);
        this.SUBRULE(this.versionSpecifier);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-VersionSpecifier
     * VersionSpecifier ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE
     */
    versionSpecifier = this.RULE('versionSpecifier', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_QUOTE) },
            { ALT: () => this.CONSUME(tokens.STRING_LITERAL_SINGLE_QUOTE) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-turtle/#grammar-production-reifiedTriple
     * reifiedTriple ::= '<<' rtSubject verb rtObject reifier? '>>'
     */
    reifiedTriple = this.RULE('reifiedTriple', () => {
        this.CONSUME(tokens.OPEN_REIFIED_TRIPLE);
        this.SUBRULE(this.rtSubject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.rtObject);
        this.OPTION(() => this.SUBRULE(this.reifier));
        this.CONSUME(tokens.CLOSE_REIFIED_TRIPLE);
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
        this.CONSUME(tokens.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.ttSubject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.ttObject);
        this.CONSUME(tokens.CLOSE_TRIPLE_TERM);
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
        this.CONSUME(tokens.TILDE);
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
        this.CONSUME(tokens.OPEN_ANNOTATION);
        this.SUBRULE(this.predicateObjectList);
        this.CONSUME(tokens.CLOSE_ANNOTATION);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-collection
     */
    collection = this.RULE('collection', () => {
        this.CONSUME(tokens.LPARENT);
        this.MANY(() => this.SUBRULE(this.object));
        this.CONSUME(tokens.RPARENT);
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-predicateObjectList
     */
    predicateObjectList = this.RULE('predicateObjectList', () => {
        this.SUBRULE1(this.predicate);
        this.SUBRULE2(this.objectList);

        this.MANY(() => {
            this.CONSUME(tokens.SEMICOLON);

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
            this.CONSUME(tokens.COMMA);
            this.SUBRULE2(this.object);
            this.SUBRULE2(this.annotation);
        });
    });

    /**
     * https://www.w3.org/TR/turtle/#grammar-production-blankNodePropertyList
     */
    blankNodePropertyList = this.RULE('blankNodePropertyList', () => {
        this.CONSUME1(tokens.LBRACKET);

        this.SUBRULE(this.predicateObjectList);

        this.CONSUME2(tokens.RBRACKET);
    });

    anon = this.RULE('anon', () => {
        this.CONSUME1(tokens.LBRACKET);

        this.MANY(() => {
            this.CONSUME2(tokens.WS);
        });

        this.CONSUME3(tokens.RBRACKET);
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

/**
 * A W3C compliant parser for the Turtle syntax.
 * https://www.w3.org/TR/turtle
 */
export class TurtleParser extends TurtleParserBase {

    constructor() {
        super(allTokens, {
            recoveryEnabled: true
        });

        this.performSelfAnalysis();
    }

    /**
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed N-Quads document.
     * @param tokens A set of tokens created by the lexer.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(documentIri, tokens) {
        this.input = tokens;

        const cst = this.turtleDoc();

        if (this.errors.length > 0) {
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
                        this.CONSUME(tokens.PERIOD);
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