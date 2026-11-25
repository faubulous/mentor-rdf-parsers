import type { Quad } from '@rdfjs/types';
import { QuadReaderError } from '../quad-reader-error.js';
import { expectSameQuadsAsSyntaxTreeReader, listFixtures, readFixture, SyntaxUnderTest } from '../quad-reader-fixtures.js';
import { NTriplesLexer, NTriplesParser } from './parser.js';
import { NTriplesReader } from './reader.js';
import { NTriplesQuadReader } from './quad-reader.js';

const fixturesDirectory = new URL('./tests/', import.meta.url).pathname;

/**
 * N-Triples with its lexer, parser and readers.
 */
const N_TRIPLES: SyntaxUnderTest = {
    tokenize: text => new NTriplesLexer().tokenize(text),
    parse: tokens => {
        const parser = new NTriplesParser();
        const cst = parser.parse(tokens, false);

        return { cst, accepted: parser.errors.length === 0 };
    },
    visit: cst => new NTriplesReader().visit(cst) as Quad[],
    createQuadReader: () => new NTriplesQuadReader()
};

/**
 * Tokenizes N-Triples text.
 */
function tokenize(text: string) {
    return new NTriplesLexer().tokenize(text);
}

/**
 * Reads quads to the first error, returning the error instead of throwing.
 */
function readQuads(text: string): { quads?: Quad[]; error?: QuadReaderError } {
    try {
        return { quads: new NTriplesQuadReader().read(tokenize(text).tokens) };
    } catch (error) {
        return { error: error as QuadReaderError };
    }
}

/**
 * Reads N-Triples text statement by statement.
 */
function readStatements(text: string) {
    return new NTriplesQuadReader().readStatements(tokenize(text).tokens);
}

describe('NTriplesQuadReader', () => {
    describe('against the syntax tree reader on the W3C fixtures', () => {
        const fixtures = [...listFixtures(fixturesDirectory, '.', '.nt'), ...listFixtures(fixturesDirectory, 'rdf12', '.nt')];

        it('covers the fixture corpus', () => {
            expect(fixtures.length).toBeGreaterThan(90);
        });

        for (const fixture of fixtures) {
            it(fixture, () => {
                expectSameQuadsAsSyntaxTreeReader(N_TRIPLES, readFixture(fixturesDirectory, fixture));
            });
        }
    });

    describe('reading statement by statement', () => {
        it('skips a line without an object and reads the others', () => {
            const { quads, errors } = readStatements('<http://e/a> <http://e/p> <http://e/b> .\n<http://e/c> <http://e/p> .\n<http://e/d> <http://e/p> "d"@en .');

            expect(quads.map(quad => quad.subject.value)).toEqual(['http://e/a', 'http://e/d']);
            expect(errors).toHaveLength(1);
            expect(errors[0].token?.image).toBe('.');
        });

        it('skips a line without its period together with the line after it', () => {
            const { quads } = readStatements('<http://e/a> <http://e/p> <http://e/b>\n<http://e/c> <http://e/p> <http://e/d> .\n_:e <http://e/p> <http://e/f> .');

            expect(quads.map(quad => quad.subject.value)).toEqual(['e']);
        });

        it('resumes at a version directive', () => {
            const { quads } = readStatements('<http://e/a> <http://e/p>\nVERSION "1.2"\n<http://e/c> <http://e/p> <http://e/d> .');

            expect(quads.map(quad => quad.subject.value)).toEqual(['http://e/c']);
        });

        it('reports the end of the input as an error without a token', () => {
            const { quads, errors } = readStatements('<http://e/a> <http://e/p> <http://e/b> .\n<http://e/c> <http://e/p>');

            expect(quads).toHaveLength(1);
            expect(errors[0].token).toBeUndefined();
        });

        it('stops at the first error when reading to the end', () => {
            expect(readQuads('<http://e/a> <http://e/p> .').error?.message).toBe("Expected an object but found '.'");
        });
    });
});
