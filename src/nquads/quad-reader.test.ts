import type { Quad } from '@rdfjs/types';
import { expectSameQuadsAsSyntaxTreeReader, listFixtures, quadKeys, readFixture, SyntaxUnderTest } from '../quad-reader-fixtures.js';
import { NQuadsLexer, NQuadsParser } from './parser.js';
import { NQuadsReader } from './reader.js';
import { NQuadsQuadReader } from './quad-reader.js';

const fixturesDirectory = new URL('./tests/', import.meta.url).pathname;

/**
 * N-Quads with its lexer, parser and readers.
 */
const N_QUADS: SyntaxUnderTest = {
    tokenize: text => new NQuadsLexer().tokenize(text),
    parse: tokens => {
        const parser = new NQuadsParser();
        const cst = parser.parse(tokens, false);

        return { cst, accepted: parser.errors.length === 0 };
    },
    visit: cst => new NQuadsReader().visit(cst) as Quad[],
    createQuadReader: () => new NQuadsQuadReader()
};

describe('NQuadsQuadReader', () => {
    describe('against the syntax tree reader on the W3C fixtures', () => {
        const fixtures = [...listFixtures(fixturesDirectory, '.', '.nq'), ...listFixtures(fixturesDirectory, 'rdf12', '.nq')];

        it('covers the fixture corpus', () => {
            expect(fixtures.length).toBeGreaterThan(100);
        });

        for (const fixture of fixtures) {
            it(fixture, () => {
                expectSameQuadsAsSyntaxTreeReader(N_QUADS, readFixture(fixturesDirectory, fixture));
            });
        }
    });

    describe('reading statement by statement', () => {
        it('skips a broken line and keeps the others in their graphs', () => {
            const text = '<http://e/a> <http://e/p> <http://e/b> <http://e/g1> .\n<http://e/a> <http://e/p> <http://e/b> <http://e/g2> <http://e/g3> .\n<http://e/c> <http://e/p> <http://e/d> _:g .';
            const { quads, errors } = new NQuadsQuadReader().readStatements(N_QUADS.tokenize(text).tokens);

            expect(quadKeys(quads)).toEqual([
                'NamedNode:http://e/a NamedNode:http://e/p NamedNode:http://e/b NamedNode:http://e/g1',
                'NamedNode:http://e/c NamedNode:http://e/p NamedNode:http://e/d BlankNode:g'
            ]);
            expect(errors).toHaveLength(1);
        });
    });
});
