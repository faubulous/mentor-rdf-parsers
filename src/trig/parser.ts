import { CstNode, IToken, Lexer, TokenType } from 'chevrotain';
import { TOKENS } from '../tokens.js';
import { TurtleParserBase } from '../turtle/parser.js';
import { IParser } from '../syntax.js';

// The order of tokens matters if multiple can match the same text
const allTokens: TokenType[] = [
    TOKENS.WS,
    TOKENS.COMMA,
    TOKENS.SEMICOLON,
    TOKENS.DCARET,
    TOKENS.LBRACKET,
    TOKENS.RBRACKET,
    TOKENS.OPEN_ANNOTATION,
    TOKENS.CLOSE_ANNOTATION,
    TOKENS.OPEN_TRIPLE_TERM,
    TOKENS.CLOSE_TRIPLE_TERM,
    TOKENS.OPEN_REIFIED_TRIPLE,
    TOKENS.CLOSE_REIFIED_TRIPLE,
    TOKENS.TILDE,
    TOKENS.LPARENT,
    TOKENS.RPARENT,
    TOKENS.LCURLY,
    TOKENS.RCURLY,
    TOKENS.A,
    TOKENS.TRUE,
    TOKENS.FALSE,
    TOKENS.VERSION,
    TOKENS.TTL_PREFIX,
    TOKENS.TTL_BASE,
    TOKENS.SPARQL_VERSION,
    TOKENS.PREFIX,
    TOKENS.BASE,
    TOKENS.GRAPH,
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
 * A W3C compliant lexer for the TriG syntax.
 */
export class TrigLexer extends Lexer {
    constructor() {
        super(allTokens);
    }
}

/**
 * A W3C compliant parser for the TriG syntax.
 * https://www.w3.org/TR/trig
 */
export class TrigParser extends TurtleParserBase implements IParser {
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
        this.input = tokens;

        const cst = this.trigDoc();

        if (throwOnErrors && this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    /**
     * https://www.w3.org/TR/trig/#grammar-production-trigDoc
     */
    trigDoc = this.RULE('trigDoc', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.directive) },
                { ALT: () => this.SUBRULE(this.block) }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/rdf12-trig/#grammar-production-block
     */
    block = this.RULE('block', () => {
        this.OR([
            { ALT: () => { this.SUBRULE1(this.triplesOrGraph) } },
            { ALT: () => { this.SUBRULE2(this.wrappedGraph) } },
            { ALT: () => { this.SUBRULE3(this.triples2) } },
            {
                ALT: () => {
                    this.CONSUME(TOKENS.GRAPH);
                    this.SUBRULE4(this.labelOrSubject);
                    this.SUBRULE5(this.wrappedGraph);
                }
            }
        ])
    });

    /**
     * https://www.w3.org/TR/rdf12-trig/#grammar-production-wrappedGraph
     */
    wrappedGraph = this.RULE('wrappedGraph', () => {
        this.CONSUME(TOKENS.LCURLY);
        this.OPTION(() => { this.SUBRULE(this.triplesBlock) });
        this.CONSUME(TOKENS.RCURLY);
    });

    /**
     * https://www.w3.org/TR/rdf12-trig/#grammar-production-triplesOrGraph
     */
    triplesOrGraph = this.RULE('triplesOrGraph', () => {
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE(this.labelOrSubject);
                    this.OR2([
                        { ALT: () => { this.SUBRULE(this.wrappedGraph) } },
                        {
                            ALT: () => {
                                this.SUBRULE(this.predicateObjectList);
                                this.CONSUME(TOKENS.PERIOD);
                            }
                        }
                    ]);
                }
            },
            {
                ALT: () => {
                    this.SUBRULE(this.reifiedTriple);
                    this.OPTION(() => { this.SUBRULE2(this.predicateObjectList) });
                    this.CONSUME2(TOKENS.PERIOD);
                }
            }
        ]);
    });

    /**
     * https://www.w3.org/TR/trig/#grammar-production-triplesBlock
     */
    triplesBlock = this.RULE('triplesBlock', () => {
        this.SUBRULE(this.triples);

        this.OPTION(() => {
            this.CONSUME(TOKENS.PERIOD);

            this.OPTION1(() => {
                this.SUBRULE1(this.triplesBlock);
            });
        });
    });

    /**
     * https://www.w3.org/TR/trig/#grammar-production-triples2
     */
    triples2 = this.RULE('triples2', () => {
        this.OR([
            {
                ALT: () => {
                    this.SUBRULE1(this.blankNodePropertyList);
                    this.OPTION(() => { this.SUBRULE2(this.predicateObjectList) });
                }
            },
            {
                ALT: () => {
                    this.SUBRULE3(this.collection);
                    this.SUBRULE4(this.predicateObjectList);
                }
            }
        ]);

        this.CONSUME(TOKENS.PERIOD);
    });

    /**
     * https://www.w3.org/TR/trig/#grammar-production-labelOrSubject
     */
    labelOrSubject = this.RULE('labelOrSubject', () => {
        this.OR([
            { ALT: () => { this.SUBRULE(this.iri) } },
            { ALT: () => { this.SUBRULE(this.blankNode) } }
        ]);
    });

    /**
     * https://www.w3.org/TR/trig/#grammar-production-blank
     */
    blank = this.RULE('blank', () => {
        this.OR([
            { ALT: () => { this.SUBRULE1(this.blankNode) } },
            { ALT: () => { this.SUBRULE2(this.collection) } }
        ]);
    });

    subject = this.RULE('subject', () => {
        this.OR([
            { ALT: () => { this.SUBRULE1(this.iri) } },
            { ALT: () => { this.SUBRULE2(this.blank) } }
        ])
    });

    object = this.RULE('object', () => {
        this.OR([
            { ALT: () => { this.SUBRULE1(this.iri) } },
            { ALT: () => { this.SUBRULE2(this.blank) } },
            { ALT: () => { this.SUBRULE3(this.blankNodePropertyList) } },
            { ALT: () => { this.SUBRULE4(this.literal) } },
            { ALT: () => { this.SUBRULE5(this.tripleTerm) } },
            { ALT: () => { this.SUBRULE6(this.reifiedTriple) } },
        ])
    });
}
