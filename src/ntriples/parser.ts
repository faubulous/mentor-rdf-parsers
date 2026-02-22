import { Lexer, CstParser, IToken, CstNode, TokenType } from 'chevrotain';
import { TOKENS } from '../tokens.js';
import { IParser } from '../syntax.js';

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
    TOKENS.COMMENT
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
    constructor(tokenVocabulary: TokenType[] = allTokens, config?: object) {
        super(tokenVocabulary, config);
    }

    /**
    * https://www.w3.org/TR/n-triples/#grammar-production-subject
    */
    subject = this.RULE('subject', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.IRIREF_ABS) },
            { ALT: () => this.CONSUME(TOKENS.BLANK_NODE_LABEL) }
        ]);
    });

    /**
     * https://www.w3.org/TR/n-triples/#grammar-production-predicate
     */
    predicate = this.RULE('predicate', () => {
        this.CONSUME(TOKENS.IRIREF_ABS);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-object
     */
    object = this.RULE('object', () => {
        this.OR([
            { ALT: () => this.CONSUME(TOKENS.IRIREF_ABS) },
            { ALT: () => this.CONSUME(TOKENS.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.literal) },
            { ALT: () => this.SUBRULE(this.tripleTerm) },
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-literal
     */
    literal = this.RULE('literal', () => {
        this.CONSUME(TOKENS.STRING_LITERAL_QUOTE);
        this.OPTION(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.datatype) },
                { ALT: () => this.CONSUME(TOKENS.LANGTAG) }
            ]);
        });
    });

    datatype = this.RULE('datatype', () => {
        this.CONSUME(TOKENS.DCARET);
        this.CONSUME(TOKENS.IRIREF_ABS);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-tripleTerm
     * tripleTerm ::= '<<(' subject predicate object ')>>'
     */
    tripleTerm = this.RULE('tripleTerm', () => {
        this.CONSUME(TOKENS.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.subject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.object);
        this.CONSUME(TOKENS.CLOSE_TRIPLE_TERM);
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
        this.CONSUME(TOKENS.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-versionDirective
     * versionDirective ::= 'VERSION' versionSpecifier
     */
    versionDirective = this.RULE('versionDirective', () => {
        this.CONSUME(TOKENS.SPARQL_VERSION);
        this.CONSUME(TOKENS.STRING_LITERAL_QUOTE);
    });
}
