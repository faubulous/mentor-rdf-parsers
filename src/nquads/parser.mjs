import { Lexer } from 'chevrotain';
import { tokens } from '../tokens.mjs';
import { NTriplesParserBase } from '../ntriples/parser.mjs';

// The order of tokens matters if multiple can match the same text
const allTokens = [
    tokens.WS,
    tokens.PERIOD,
    tokens.IRIREF_ABS,
    tokens.BLANK_NODE_LABEL,
    tokens.STRING_LITERAL_QUOTE,
    tokens.DCARET,
    tokens.LANGTAG,
    tokens.COMMENT,
];

/**
 * A W3C compliant lexer for the N-Quads syntax.
 */
export class NQuadsLexer extends Lexer {
    constructor() {
        super(allTokens);
    }
}

/**
 * A W3C compliant parser for the N-Quads syntax.
 * https://www.w3.org/TR/n-quads
 */
export class NQuadsParser extends NTriplesParserBase {
    constructor() {
        super(allTokens);

        this.performSelfAnalysis();
    }

    /**
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed N-Quads document.
     * @param tokens A set of tokens created by the lexer.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(tokens) {
        this.input = tokens;

        const cst = this.nquadsDoc();

        if (this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    /**
     * https://www.w3.org/TR/n-quads/#grammar-production-nquadsDoc
     */
    nquadsDoc = this.RULE('nquadsDoc', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.statement) }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/n-quads/#grammar-production-statement
     */
    statement = this.RULE('statement', () => {
        this.SUBRULE1(this.subject);
        this.SUBRULE2(this.predicate);
        this.SUBRULE3(this.object);
        this.OPTION1(() => this.SUBRULE4(this.graphLabel));
        this.CONSUME(tokens.PERIOD);
    });

    /**
     * https://www.w3.org/TR/n-quads/#grammar-production-graphLabel
     */
    graphLabel = this.RULE('graphLabel', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.IRIREF_ABS) },
            { ALT: () => this.CONSUME(tokens.BLANK_NODE_LABEL) }
        ]);
    });
}