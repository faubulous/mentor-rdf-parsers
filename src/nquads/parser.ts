import { Lexer, IToken, CstNode, TokenType } from 'chevrotain';
import { TOKENS } from '../tokens.js';
import { IParser } from '../syntax.js';
import { NTriplesParserBase } from '../ntriples/parser.js';

// The order of tokens matters if multiple can match the same text
const allTokens: TokenType[] = [
    TOKENS.WS,
    TOKENS.PERIOD,
    TOKENS.OPEN_TRIPLE_TERM,
    TOKENS.CLOSE_TRIPLE_TERM,
    TOKENS.OPEN_REIFIED_TRIPLE,
    TOKENS.CLOSE_REIFIED_TRIPLE,
    TOKENS.IRIREF_ABS,
    TOKENS.BLANK_NODE_LABEL,
    TOKENS.STRING_LITERAL_QUOTE,
    TOKENS.DCARET,
    TOKENS.LANGTAG,
    TOKENS.SPARQL_VERSION,
    TOKENS.COMMENT,
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
export class NQuadsParser extends NTriplesParserBase implements IParser {
    constructor() {
        super(allTokens);

        this.performSelfAnalysis();
    }

    /**
    /**
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed document.
     * @param tokens A set of tokens created by the lexer.
     * @param throwOnErrors Whether to throw an error if any parsing errors are detected. Defaults to true.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(tokens: IToken[], throwOnErrors: boolean = true): CstNode {
        this.input = tokens;

        const cst = this.nquadsDoc();

        if (throwOnErrors && this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-nquadsDoc
     */
    nquadsDoc = this.RULE('nquadsDoc', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.statement) },
                { ALT: () => this.SUBRULE(this.versionDirective) }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-statement
     */
    statement = this.RULE('statement', () => {
        this.SUBRULE1(this.subject);
        this.SUBRULE2(this.predicate);
        this.SUBRULE3(this.object);
        this.OPTION1(() => this.SUBRULE4(this.graphLabel));
        this.CONSUME(TOKENS.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-graphLabel
     */
    graphLabel = this.RULE('graphLabel', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.IRIREF_ABS) },
            { ALT: () => this.CONSUME(TOKENS.BLANK_NODE_LABEL) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-versionDirective
     * versionDirective ::= 'VERSION' versionSpecifier
     */
    versionDirective = this.RULE('versionDirective', () => {
        this.CONSUME(TOKENS.SPARQL_VERSION);
        this.CONSUME(TOKENS.STRING_LITERAL_QUOTE);
    });
}
