import { CstNode, IToken, Lexer, TokenType, ILexingResult } from 'chevrotain';
import { RdfToken } from '../tokens.js';
import { TurtleParserBase } from '../turtle/parser.js';
import { IParser, ILexer } from '../syntax.js';
import { assignBlankNodeIds, BlankNodeIdGenerator, defaultBlankNodeIdGenerator } from '../utils.js';

// The order of tokens matters if multiple can match the same text
export const TrigTokens: TokenType[] = [
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
    RdfToken.LCURLY,
    RdfToken.RCURLY,
    RdfToken.A,
    RdfToken.TRUE,
    RdfToken.FALSE,
    RdfToken.VERSION,
    RdfToken.TTL_PREFIX,
    RdfToken.TTL_BASE,
    RdfToken.SPARQL_VERSION,
    RdfToken.PREFIX,
    RdfToken.BASE,
    RdfToken.GRAPH,
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
 * A W3C compliant lexer for the TriG syntax.
 */
export class TrigLexer extends Lexer implements ILexer {
    /**
     * Optional blank node ID generator function.
     * When set or undefined, the lexer will automatically assign blank node IDs to tokens.
     * Set to null to disable automatic blank node ID assignment.
     */
    blankNodeIdGenerator?: BlankNodeIdGenerator | null;

    constructor(blankNodeIdGenerator?: BlankNodeIdGenerator | null) {
        super(TrigTokens);
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
 * A W3C compliant parser for the TriG syntax.
 * https://www.w3.org/TR/trig
 */
export class TrigParser extends TurtleParserBase implements IParser {
    constructor() {
        super(TrigTokens, {
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
        // Filter out comment tokens - they are kept in the token stream for formatters
        // but should not be processed by the parser
        this.input = tokens.filter(t => t.tokenType.name !== 'COMMENT');

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
                    this.CONSUME(RdfToken.GRAPH);
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
        this.CONSUME(RdfToken.LCURLY);
        this.OPTION(() => { this.SUBRULE(this.triplesBlock) });
        this.CONSUME(RdfToken.RCURLY);
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
                                this.CONSUME(RdfToken.PERIOD);
                            }
                        }
                    ]);
                }
            },
            {
                ALT: () => {
                    this.SUBRULE(this.reifiedTriple);
                    this.OPTION(() => { this.SUBRULE2(this.predicateObjectList) });
                    this.CONSUME2(RdfToken.PERIOD);
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
            this.CONSUME(RdfToken.PERIOD);

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

        this.CONSUME(RdfToken.PERIOD);
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
