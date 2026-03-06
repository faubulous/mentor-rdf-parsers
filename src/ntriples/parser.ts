import { Lexer, CstParser, IToken, CstNode, TokenType, IRecognitionException, ILexingResult } from 'chevrotain';
import { DocumentToken } from '../tokens.js';
import { IParser, ILexer } from '../syntax.js';
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
    DocumentToken.COMMENT
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
            { ALT: () => this.CONSUME(DocumentToken.IRIREF_ABS) },
            { ALT: () => this.CONSUME(DocumentToken.BLANK_NODE_LABEL) }
        ]);
    });

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-predicate
     */
    predicate = this.RULE('predicate', () => {
        this.CONSUME(DocumentToken.IRIREF_ABS);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-object
     */
    object = this.RULE('object', () => {
        this.OR([
            { ALT: () => this.CONSUME(DocumentToken.IRIREF_ABS) },
            { ALT: () => this.CONSUME(DocumentToken.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.literal) },
            { ALT: () => this.SUBRULE(this.tripleTerm) },
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-literal
     */
    literal = this.RULE('literal', () => {
        this.CONSUME(DocumentToken.STRING_LITERAL_QUOTE);
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.datatype) },
                { ALT: () => this.CONSUME(DocumentToken.LANGTAG) }
            ]);
        });
    });

    datatype = this.RULE('datatype', () => {
        this.CONSUME(DocumentToken.DCARET);
        this.CONSUME(DocumentToken.IRIREF_ABS);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-tripleTerm
     * tripleTerm ::= '<<(' subject predicate object ')>>'
     */
    tripleTerm = this.RULE('tripleTerm', () => {
        this.CONSUME(DocumentToken.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.subject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.object);
        this.CONSUME(DocumentToken.CLOSE_TRIPLE_TERM);
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
        this.CONSUME(DocumentToken.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-versionDirective
     * versionDirective ::= 'VERSION' versionSpecifier
     */
    versionDirective = this.RULE('versionDirective', () => {
        this.CONSUME(DocumentToken.SPARQL_VERSION);
        this.CONSUME(DocumentToken.STRING_LITERAL_QUOTE);
    });
}
