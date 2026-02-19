import { Lexer, CstParser } from 'chevrotain';
import { tokens } from '../tokens.mjs';

// The order of tokens matters if multiple can match the same text
const allTokens = [
    tokens.WS,
    tokens.PERIOD,
    tokens.IRIREF_ABS,
    tokens.BLANK_NODE_LABEL,
    tokens.STRING_LITERAL_QUOTE,
    tokens.DCARET,
    tokens.LANGTAG,
    tokens.COMMENT
];

/**
 * A W3C compliant lexer for the N-Triples syntax.
 */
export class NTriplesLexer extends Lexer {
    constructor() {
        super(allTokens);
    }
}

/**
 * Base class for parsers of the N-Triples syntax.
 */
export class NTriplesParserBase extends CstParser {
    /**
    * https://www.w3.org/TR/n-triples/#grammar-production-subject
    */
    subject = this.RULE('subject', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.IRIREF_ABS) },
            { ALT: () => this.CONSUME(tokens.BLANK_NODE_LABEL) }
        ]);
    });

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-predicate
     */
    predicate = this.RULE('predicate', () => {
        this.CONSUME(tokens.IRIREF_ABS);
    });

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-object
     */
    object = this.RULE('object', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.IRIREF_ABS) },
            { ALT: () => this.CONSUME(tokens.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.literal) },
        ]);
    });

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-literal
     */
    literal = this.RULE('literal', () => {
        this.CONSUME(tokens.STRING_LITERAL_QUOTE);
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.datatype) },
                { ALT: () => this.CONSUME(tokens.LANGTAG) }
            ]);
        });
    });

    datatype = this.RULE('datatype', () => {
        this.CONSUME(tokens.DCARET);
        this.CONSUME(tokens.IRIREF_ABS);
    });
}

/**
 * A W3C compliant parser for the N-Triples syntax.
 * https://www.w3.org/TR/n-triples
 */
export class NTriplesParser extends NTriplesParserBase {
    constructor() {
        super(allTokens);

        this.performSelfAnalysis();
    }

    /**
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed N-Triples document.
     * @param tokens A set of tokens created by the lexer.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(tokens) {
        this.input = tokens;

        const cst = this.ntriplesDoc();

        if (this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-ntriplesDoc
     */
    ntriplesDoc = this.RULE('ntriplesDoc', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.triple) }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-triple
     */
    triple = this.RULE('triple', () => {
        this.SUBRULE(this.subject);
        this.SUBRULE1(this.predicate);
        this.SUBRULE2(this.object);
        this.CONSUME(tokens.PERIOD);
    });
}