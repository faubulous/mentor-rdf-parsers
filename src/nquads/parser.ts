import { Lexer, IToken, CstNode, TokenType, ILexingResult } from 'chevrotain';
import { RdfToken } from '../tokens.js';
import { IParser, ILexer } from '../syntax.js';
import { NTriplesParserBase } from '../ntriples/parser.js';
import { assignBlankNodeIds, BlankNodeIdGenerator, defaultBlankNodeIdGenerator } from '../utils.js';

// The order of tokens matters if multiple can match the same text
export const NQuadsTokens: TokenType[] = [
    RdfToken.WS,
    RdfToken.PERIOD,
    RdfToken.OPEN_TRIPLE_TERM,
    RdfToken.CLOSE_TRIPLE_TERM,
    RdfToken.OPEN_REIFIED_TRIPLE,
    RdfToken.CLOSE_REIFIED_TRIPLE,
    RdfToken.IRIREF_ABS,
    RdfToken.BLANK_NODE_LABEL,
    RdfToken.STRING_LITERAL_QUOTE,
    RdfToken.DCARET,
    RdfToken.LANGTAG,
    RdfToken.SPARQL_VERSION,
    RdfToken.COMMENT,
];

/**
 * A W3C compliant lexer for the N-Quads syntax.
 */
export class NQuadsLexer extends Lexer implements ILexer {
    /**
     * Optional blank node ID generator function.
     * When set or undefined, the lexer will automatically assign blank node IDs to tokens.
     * Set to null to disable automatic blank node ID assignment.
     */
    blankNodeIdGenerator?: BlankNodeIdGenerator | null;

    constructor(blankNodeIdGenerator?: BlankNodeIdGenerator | null) {
        super(NQuadsTokens);
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
 * A W3C compliant parser for the N-Quads syntax.
 * https://www.w3.org/TR/n-quads
 */
export class NQuadsParser extends NTriplesParserBase implements IParser {
    constructor() {
        super(NQuadsTokens);

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
        // Filter out comment tokens - they are kept in the token stream for formatters
        // but should not be processed by the parser
        this.input = tokens.filter(t => t.tokenType.name !== 'COMMENT');

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
        this.CONSUME(RdfToken.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-graphLabel
     */
    graphLabel = this.RULE('graphLabel', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.IRIREF_ABS) },
            { ALT: () => this.CONSUME(RdfToken.BLANK_NODE_LABEL) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-versionDirective
     * versionDirective ::= 'VERSION' versionSpecifier
     */
    versionDirective = this.RULE('versionDirective', () => {
        this.CONSUME(RdfToken.SPARQL_VERSION);
        this.CONSUME(RdfToken.STRING_LITERAL_QUOTE);
    });
}
