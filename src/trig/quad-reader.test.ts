import type { Quad } from '@rdfjs/types';
import { expectSameQuadsAsSyntaxTreeReader, listFixtures, readFixture, SyntaxUnderTest } from '../quad-reader-fixtures.js';
import { TrigLexer, TrigParser } from './parser.js';
import { TrigReader } from './reader.js';
import { TrigQuadReader } from './quad-reader.js';

const fixturesDirectory = new URL('./tests/', import.meta.url).pathname;

const PREAMBLE = 'PREFIX ex: <http://example.org/>\n';

/**
 * TriG with its lexer, parser and readers.
 */
const TRIG: SyntaxUnderTest = {
    tokenize: text => new TrigLexer().tokenize(text),
    parse: tokens => {
        const parser = new TrigParser();
        const cst = parser.parse(tokens, false);

        return { cst, accepted: parser.errors.length === 0 && parser.semanticErrors.length === 0 };
    },
    visit: cst => new TrigReader().visit(cst) as Quad[],
    createQuadReader: () => new TrigQuadReader()
};

/**
 * Reads TriG text statement by statement.
 */
function readStatements(text: string) {
    return new TrigQuadReader().readStatements(TRIG.tokenize(text).tokens);
}

/**
 * Renders quads as `subject graph` by their local names, `-` for the default graph.
 */
function placesOf(quads: Quad[]): string[] {
    return quads.map(quad => `${quad.subject.value.replace('http://example.org/', '')} ${quad.graph.value.replace('http://example.org/', '') || '-'}`);
}

describe('TrigQuadReader', () => {
    describe('against the syntax tree reader on the W3C fixtures', () => {
        const fixtures = [...listFixtures(fixturesDirectory, '.', '.trig'), ...listFixtures(fixturesDirectory, 'rdf12', '.trig')];

        it('covers the fixture corpus', () => {
            expect(fixtures.length).toBeGreaterThan(350);
        });

        for (const fixture of fixtures) {
            it(fixture, () => {
                expectSameQuadsAsSyntaxTreeReader(TRIG, readFixture(fixturesDirectory, fixture));
            });
        }
    });

    describe('reading statement by statement', () => {
        it('skips a broken statement inside a graph block and goes on in the block', () => {
            const { quads, errors } = readStatements(`${PREAMBLE}ex:g { ex:a ex:p ex:b . ex:c ex:p . ex:d ex:p ex:e }\nex:f ex:p ex:g .`);

            expect(placesOf(quads)).toEqual(['a g', 'd g', 'f -']);
            expect(errors).toHaveLength(1);
        });

        it('never reads the statements of a block into the default graph after an error before it', () => {
            const { quads } = readStatements(`${PREAMBLE}ex:a ex:p ex:b\nex:g { ex:c ex:p ex:d . }\nex:e ex:p ex:f .`);

            expect(placesOf(quads)).toEqual(['e -']);
        });

        it('drops a block that is not closed with everything after it', () => {
            const { quads, errors } = readStatements(`${PREAMBLE}ex:a ex:p ex:b .\nex:g1 { ex:c ex:p ex:d .\nex:g2 { ex:e ex:p ex:f . }\nex:h ex:p ex:i .`);

            expect(placesOf(quads)).toEqual(['a -']);
            expect(errors[errors.length - 1].token).toBeUndefined();
        });

        it('removes the quads a broken statement in a block emitted before its error', () => {
            const { quads } = readStatements(`${PREAMBLE}GRAPH ex:g { ex:a ex:p [ ex:q ex:r ] ; ex:s . ex:b ex:p ex:c . }`);

            expect(placesOf(quads)).toEqual(['b g']);
        });

        it('resumes at the GRAPH keyword after a statement that is not terminated', () => {
            const { quads } = readStatements(`${PREAMBLE}ex:a ex:p\nGRAPH ex:g { ex:b ex:p ex:c }`);

            expect(placesOf(quads)).toEqual(['b g']);
        });

        it('reads the default graph block and blank node graph labels', () => {
            const { quads, errors } = readStatements(`${PREAMBLE}{ ex:a ex:p ex:b } _:g { ex:c ex:p ex:d . } [] { ex:e ex:p ex:f }`);

            expect(errors).toEqual([]);
            expect(quads.map(quad => quad.graph.termType)).toEqual(['DefaultGraph', 'BlankNode', 'BlankNode']);
        });
    });
});
