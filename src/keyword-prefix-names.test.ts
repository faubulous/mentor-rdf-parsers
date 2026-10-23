import { CstNode, IToken, Lexer, TokenType } from 'chevrotain';
import { RdfToken } from './tokens.js';
import { TurtleLexer, TurtleParser } from './turtle/parser.js';
import { TrigLexer, TrigParser } from './trig/parser.js';
import { N3Lexer, N3Parser } from './n3/parser.js';
import { SparqlLexer, SparqlParser } from './sparql/parser.js';

/**
 * Regression tests for https://github.com/faubulous/mentor-rdf-parsers/issues/5:
 * prefix names that start with or equal a keyword, such as 'prefix:', 'true:' or
 * 'graph.x:', must be lexed as prefixed names and not as keywords.
 */

/**
 * A lexer and parser for one syntax, with a function that creates a document
 * declaring and using a given prefix name.
 */
interface SyntaxFixture {
    name: string;
    lexer: Lexer;
    parser: { parse(tokens: IToken[]): CstNode };
    createDocument: (prefix: string) => string;
}

const syntaxes: SyntaxFixture[] = [
    {
        name: 'Turtle',
        lexer: new TurtleLexer(),
        parser: new TurtleParser(),
        createDocument: (prefix) => `@prefix ${prefix}: <http://example.org/> .\n${prefix}:a ${prefix}:b ${prefix}:c .\n`
    },
    {
        name: 'TriG',
        lexer: new TrigLexer(),
        parser: new TrigParser(),
        createDocument: (prefix) => `PREFIX ${prefix}: <http://example.org/>\n${prefix}:g { ${prefix}:a ${prefix}:b ${prefix}:c . }\n`
    },
    {
        name: 'N3',
        lexer: new N3Lexer(),
        parser: new N3Parser(),
        createDocument: (prefix) => `@prefix ${prefix}: <http://example.org/> .\n${prefix}:a ${prefix}:b ${prefix}:c .\n`
    },
    {
        name: 'SPARQL',
        lexer: new SparqlLexer(),
        parser: new SparqlParser(),
        createDocument: (prefix) => `PREFIX ${prefix}: <http://example.org/>\nSELECT * WHERE { ${prefix}:a ${prefix}:b ${prefix}:c . }\n`
    }
];

const sharedKeywordPrefixes = [
    'prefix', 'PREFIX', 'Prefix',
    'base', 'BASE',
    'true', 'false',
    'trueish', 'falsey',
    'true.x', 'a.b', 'prefix.x'
];

const keywordPrefixesBySyntax: Record<string, string[]> = {
    Turtle: [...sharedKeywordPrefixes, 'version', 'VERSION'],
    TriG: [...sharedKeywordPrefixes, 'version', 'VERSION', 'graph', 'GRAPH', 'graph.x'],
    N3: [...sharedKeywordPrefixes, 'has', 'is', 'of'],
    SPARQL: [...sharedKeywordPrefixes, 'version', 'graph', 'select', 'where']
};

const syntaxCases = syntaxes.flatMap(syntax =>
    keywordPrefixesBySyntax[syntax.name].map(prefix => ({ ...syntax, prefix }))
);

/**
 * Tokenizes a text and fails on lexing errors.
 * @param lexer The lexer to use.
 * @param text The text to tokenize.
 * @returns The tokens without skipped whitespace.
 */
function tokenize(lexer: Lexer, text: string): IToken[] {
    const result = lexer.tokenize(text);

    expect(result.errors).toEqual([]);

    return result.tokens;
}

/**
 * Gets the token types of the tokens whose image is one of the given images.
 * @param tokens The tokens to search.
 * @param images The token images to look up.
 * @returns The token types in the order of the given images.
 */
function getTokenTypes(tokens: IToken[], ...images: string[]): TokenType[] {
    return images.map(image => tokens.find(token => token.image === image)?.tokenType as TokenType);
}

describe('Keyword-like prefix names (issue #5)', () => {
    describe('lexing', () => {
        it.each(syntaxCases)('$name lexes "$prefix:" and "$prefix:a" as prefixed names', ({ lexer, createDocument, prefix }) => {
            const tokens = tokenize(lexer, createDocument(prefix));

            expect(getTokenTypes(tokens, `${prefix}:`, `${prefix}:a`, `${prefix}:b`, `${prefix}:c`)).toEqual([
                RdfToken.PNAME_NS,
                RdfToken.PNAME_LN,
                RdfToken.PNAME_LN,
                RdfToken.PNAME_LN
            ]);
        });
    });

    describe('parsing', () => {
        it.each(syntaxCases)('$name parses a document with the prefix "$prefix:"', ({ lexer, parser, createDocument, prefix }) => {
            const tokens = tokenize(lexer, createDocument(prefix));

            expect(() => parser.parse(tokens)).not.toThrow();
        });
    });

    describe('keywords are still recognized', () => {
        it('Turtle lexes directives, "a" and booleans before a period as keywords', () => {
            const tokens = tokenize(new TurtleLexer(), 'PREFIX ex: <http://example.org/>\nBASE <http://example.org/>\nVERSION "1.2"\nex:s a ex:o ; ex:p true, false.\n');

            expect(getTokenTypes(tokens, 'PREFIX', 'BASE', 'VERSION', 'a', 'true', 'false')).toEqual([
                RdfToken.PREFIX,
                RdfToken.BASE,
                RdfToken.SPARQL_VERSION,
                RdfToken.A,
                RdfToken.TRUE,
                RdfToken.FALSE
            ]);

            expect(tokens[tokens.length - 1].tokenType).toBe(RdfToken.PERIOD);
        });

        it('TriG lexes GRAPH as a keyword', () => {
            const tokens = tokenize(new TrigLexer(), 'PREFIX ex: <http://example.org/>\nGRAPH ex:g { ex:s ex:p true. }\n');

            expect(getTokenTypes(tokens, 'GRAPH', 'true', '.')).toEqual([
                RdfToken.GRAPH,
                RdfToken.TRUE,
                RdfToken.PERIOD
            ]);
        });

        it('N3 lexes "has", "is" and "of" as keywords', () => {
            const tokens = tokenize(new N3Lexer(), '@prefix ex: <http://example.org/> .\nex:s has ex:p ex:o .\nex:o is ex:p of ex:s .\n');

            expect(getTokenTypes(tokens, 'has', 'is', 'of')).toEqual([
                RdfToken.HAS,
                RdfToken.IS,
                RdfToken.OF
            ]);
        });

        it('SPARQL lexes booleans and "a" as keywords', () => {
            const tokens = tokenize(new SparqlLexer(), 'ASK { ?s a ?o ; ?p true, false. }');

            expect(getTokenTypes(tokens, 'a', 'true', 'false')).toEqual([
                RdfToken.A,
                RdfToken.TRUE,
                RdfToken.FALSE
            ]);
        });
    });
});
