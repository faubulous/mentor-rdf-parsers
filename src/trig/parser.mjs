import { Lexer } from 'chevrotain';
import { tokens } from '../tokens.mjs';
import { TurtleParserBase } from '../turtle/parser.mjs';

// The order of tokens matters if multiple can match the same text
const allTokens = [
    tokens.WS,
    tokens.COMMA,
    tokens.SEMICOLON,
    tokens.DCARET,
    tokens.LBRACKET,
    tokens.RBRACKET,
    tokens.LPARENT,
    tokens.RPARENT,
    tokens.LCURLY,
    tokens.RCURLY,
    tokens.A,
    tokens.TRUE,
    tokens.FALSE,
    tokens.PREFIX,
    tokens.BASE,
    tokens.SPARQL_PREFIX,
    tokens.SPARQL_BASE,
    tokens.GRAPH,
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
export class TrigParser extends TurtleParserBase {
    constructor() {
        super(allTokens, {
            recoveryEnabled: true
        });

        this.performSelfAnalysis();
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
     * https://www.w3.org/TR/trig/#grammar-production-block
     */
    block = this.RULE('block', () => {
        this.OR([
            { ALT: () => { this.SUBRULE1(this.triplesOrGraph) } },
            { ALT: () => { this.SUBRULE2(this.wrappedGraph) } },
            { ALT: () => { this.SUBRULE3(this.triples2) } },
            {
                ALT: () => {
                    this.CONSUME(tokens.GRAPH);
                    this.SUBRULE4(this.labelOrSubject);
                    this.SUBRULE5(this.wrappedGraph);
                }
            }
        ])
    });

    /**
     * https://www.w3.org/TR/trig/#grammar-production-wrappedGraph
     */
    wrappedGraph = this.RULE('wrappedGraph', () => {
        this.CONSUME(tokens.LCURLY);
        this.OPTION(() => { this.SUBRULE(this.triplesBlock) });
        this.CONSUME(tokens.RCURLY);
    });

    /**
     * https://www.w3.org/TR/trig/#grammar-production-triplesOrGraph
     */
    triplesOrGraph = this.RULE('triplesOrGraph', () => {
        this.SUBRULE(this.labelOrSubject);
        this.OR([
            { ALT: () => { this.SUBRULE(this.wrappedGraph) } },
            {
                ALT: () => {
                    this.SUBRULE(this.predicateObjectList);
                    this.CONSUME(tokens.PERIOD);
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
            this.CONSUME(tokens.PERIOD);

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

        this.CONSUME(tokens.PERIOD);
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
        ])
    });
}