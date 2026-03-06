import { Lexer, CstParser, IToken, CstNode, TokenType, IRecognitionException, ILexingResult } from 'chevrotain';
import { RdfToken } from '../tokens.js';
import { IParser, ILexer } from '../syntax.js';
import { assignBlankNodeIds, BlankNodeIdGenerator, defaultBlankNodeIdGenerator } from '../utils.js';

// The order of tokens matters if multiple can match the same text
const allTokens: TokenType[] = [
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
    RdfToken.COMMENT
];

/**
 * A W3C compliant lexer for the N-Triples syntax.
 */
export class NTriplesLexer extends Lexer implements ILexer {
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
 * Base class for parsers of the N-Triples syntax.
 */
export class NTriplesParserBase extends CstParser {
    readonly semanticErrors: IRecognitionException[] = [];
    
    constructor(tokenVocabulary: TokenType[] = allTokens, config?: object) {
        super(tokenVocabulary, config);
    }

    /**
    * https://www.w3.org/TR/n-triples/#grammar-production-subject
    */
    subject = this.RULE('subject', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.IRIREF_ABS) },
            { ALT: () => this.CONSUME(RdfToken.BLANK_NODE_LABEL) }
        ]);
    });

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-predicate
     */
    predicate = this.RULE('predicate', () => {
        this.CONSUME(RdfToken.IRIREF_ABS);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-object
     */
    object = this.RULE('object', () => {
        this.OR([
            { ALT: () => this.CONSUME(RdfToken.IRIREF_ABS) },
            { ALT: () => this.CONSUME(RdfToken.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.literal) },
            { ALT: () => this.SUBRULE(this.tripleTerm) },
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-literal
     */
    literal = this.RULE('literal', () => {
        this.CONSUME(RdfToken.STRING_LITERAL_QUOTE);
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.datatype) },
                { ALT: () => this.CONSUME(RdfToken.LANGTAG) }
            ]);
        });
    });

    datatype = this.RULE('datatype', () => {
        this.CONSUME(RdfToken.DCARET);
        this.CONSUME(RdfToken.IRIREF_ABS);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-tripleTerm
     * tripleTerm ::= '<<(' subject predicate object ')>>'
     */
    tripleTerm = this.RULE('tripleTerm', () => {
        this.CONSUME(RdfToken.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.subject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.object);
        this.CONSUME(RdfToken.CLOSE_TRIPLE_TERM);
    });
}

/**
 * A W3C compliant parser for the N-Triples syntax.
 * https://www.w3.org/TR/n-triples
 */
export class NTriplesParser extends NTriplesParserBase implements IParser {
    constructor() {
        super(allTokens);

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

        const cst = this.ntriplesDoc();

        if (throwOnErrors && this.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(this.errors));
        }

        return cst;
    }

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-ntriplesDoc
     */
    ntriplesDoc = this.RULE('ntriplesDoc', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.triple) },
                { ALT: () => this.SUBRULE(this.versionDirective) }
            ]);
        });
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-triple
     */
    triple = this.RULE('triple', () => {
        this.SUBRULE(this.subject);
        this.SUBRULE1(this.predicate);
        this.SUBRULE2(this.object);
        this.CONSUME(RdfToken.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-versionDirective
     * versionDirective ::= 'VERSION' versionSpecifier
     */
    versionDirective = this.RULE('versionDirective', () => {
        this.CONSUME(RdfToken.SPARQL_VERSION);
        this.CONSUME(RdfToken.STRING_LITERAL_QUOTE);
    });
}
