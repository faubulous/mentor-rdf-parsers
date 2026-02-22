import { Lexer, CstParser, IToken, CstNode, TokenType } from 'chevrotain';
import { tokens } from '../tokens.js';
import { IParser } from '../syntax.js';

// The order of tokens matters if multiple can match the same text
const allTokens: TokenType[] = [
    tokens.WS,
    tokens.PERIOD,
    tokens.OPEN_TRIPLE_TERM,
    tokens.CLOSE_TRIPLE_TERM,
    tokens.OPEN_REIFIED_TRIPLE,
    tokens.CLOSE_REIFIED_TRIPLE,
    tokens.IRIREF_ABS,
    tokens.BLANK_NODE_LABEL,
    tokens.STRING_LITERAL_QUOTE,
    tokens.DCARET,
    tokens.LANGTAG,
    tokens.SPARQL_VERSION,
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
    constructor(tokenVocabulary: TokenType[] = allTokens, config?: object) {
        super(tokenVocabulary, config);
    }

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
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-object
     */
    object = this.RULE('object', () => {
        this.OR([
            { ALT: () => this.CONSUME(tokens.IRIREF_ABS) },
            { ALT: () => this.CONSUME(tokens.BLANK_NODE_LABEL) },
            { ALT: () => this.SUBRULE(this.literal) },
            { ALT: () => this.SUBRULE(this.tripleTerm) },
        ]);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-literal
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

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-tripleTerm
     * tripleTerm ::= '<<(' subject predicate object ')>>'
     */
    tripleTerm = this.RULE('tripleTerm', () => {
        this.CONSUME(tokens.OPEN_TRIPLE_TERM);
        this.SUBRULE(this.subject);
        this.SUBRULE(this.predicate);
        this.SUBRULE(this.object);
        this.CONSUME(tokens.CLOSE_TRIPLE_TERM);
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
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed N-Triples document.
     * @param tokens A set of tokens created by the lexer.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(inputTokens: IToken[]): CstNode {
        this.input = inputTokens;

        const cst = this.ntriplesDoc();

        if (this.errors.length > 0) {
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
        this.CONSUME(tokens.PERIOD);
    });

    /**
     * https://www.w3.org/TR/rdf12-n-triples/#grammar-production-versionDirective
     * versionDirective ::= 'VERSION' versionSpecifier
     */
    versionDirective = this.RULE('versionDirective', () => {
        this.CONSUME(tokens.SPARQL_VERSION);
        this.CONSUME(tokens.STRING_LITERAL_QUOTE);
    });
}
