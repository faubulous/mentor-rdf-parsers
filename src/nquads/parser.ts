import { Lexer, IToken, CstNode, TokenType, ILexingResult } from 'chevrotain';
import { DocumentToken } from '../tokens.js';
import { IParser, ILexer } from '../syntax.js';
import { NTriplesParserBase } from '../ntriples/parser.js';
import { assignBlankNodeIds, BlankNodeIdGenerator, defaultBlankNodeIdGenerator } from '../utils.js';

// The order of tokens matters if multiple can match the same text
const allTokens: TokenType[] = [
    DocumentToken.WS,
    DocumentToken.PERIOD,
    DocumentToken.OPEN_TRIPLE_TERM,
    DocumentToken.CLOSE_TRIPLE_TERM,
    DocumentToken.OPEN_REIFIED_TRIPLE,
    DocumentToken.CLOSE_REIFIED_TRIPLE,
    DocumentToken.IRIREF_ABS,
    DocumentToken.BLANK_NODE_LABEL,
    DocumentToken.STRING_LITERAL_QUOTE,
    DocumentToken.DCARET,
    DocumentToken.LANGTAG,
    DocumentToken.SPARQL_VERSION,
    DocumentToken.COMMENT,
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
        this.CONSUME(DocumentToken.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-graphLabel
     */
    graphLabel = this.RULE('graphLabel', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.IRIREF_ABS) },
            { ALT: () => this.CONSUME(DocumentToken.BLANK_NODE_LABEL) }
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-quads/#grammar-production-versionDirective
     * versionDirective ::= 'VERSION' versionSpecifier
     */
    versionDirective = this.RULE('versionDirective', () => {
        this.CONSUME(DocumentToken.SPARQL_VERSION);
        this.CONSUME(DocumentToken.STRING_LITERAL_QUOTE);
    });
}
