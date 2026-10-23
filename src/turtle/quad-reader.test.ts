import * as fs from 'fs';
import * as path from 'path';
import type { Quad, Term } from '@rdfjs/types';
import { parseQuads, parseNTriples12, quadsMatch } from '../helpers.js';
import { createFileBlankNodeIdGenerator } from '../utils.js';
import { QuadReaderError } from '../quad-reader-error.js';
import { TurtleLexer, TurtleParser } from './parser.js';
import { TurtleReader } from './reader.js';
import { TurtleQuadReader } from './quad-reader.js';

const fixturesDirectory = new URL('./tests/', import.meta.url).pathname;

/**
 * Fixtures that redeclare a prefix. The syntax tree reader applies every directive to the
 * whole document, the quad reader applies them in order as the specification says, so these
 * are checked against N3 instead.
 */
const REDECLARING_FIXTURES = new Set(['prefix_reassigned_and_used.ttl', 'turtle-subm-25.ttl', 'turtle-subm-27.ttl']);

/**
 * Fixtures on which the syntax tree reader draws an anonymous reifier id from the data model's
 * counter that collides with an id the lexer assigned, merging two nodes. The quad reader names
 * the reifier after its token; these are checked against the expected N-Triples only.
 */
const COLLIDING_FIXTURES = new Set(['turtle12-eval-annotation-02.ttl']);

/**
 * Lists the fixture files of a directory relative to the fixtures root.
 */
function listFixtures(directory: string): string[] {
    const absolute = path.join(fixturesDirectory, directory);

    return fs.readdirSync(absolute)
        .filter(name => name.endsWith('.ttl'))
        .map(name => path.join(directory, name))
        .sort();
}

/**
 * Reads a fixture file.
 */
function readFixture(relativePath: string): string {
    return fs.readFileSync(path.join(fixturesDirectory, relativePath), 'utf-8');
}

/**
 * Renders a term so that equal terms, including blank node ids and triple terms, render equally.
 */
function termKey(term: Term): string {
    switch (term.termType) {
        case 'Literal':
            return `"${term.value}"@${term.language}^^${term.datatype.value}`;
        case 'Quad':
            return `<<${termKey(term.subject)} ${termKey(term.predicate)} ${termKey(term.object)}>>`;
        default:
            return `${term.termType}:${term.value}`;
    }
}

/**
 * Renders quads in order, one line each, for exact comparison.
 */
function quadKeys(quads: Quad[]): string[] {
    return quads.map(quad => `${termKey(quad.subject)} ${termKey(quad.predicate)} ${termKey(quad.object)} ${termKey(quad.graph)}`);
}

/**
 * Renders quads in order with blank nodes numbered by first occurrence, so that two readers
 * agree when they emit the same statements in the same order with consistently mapped ids.
 */
function relabeledQuadKeys(quads: Quad[]): string[] {
    const labels = new Map<string, string>();

    return quadKeys(quads).map(key => key.replace(/BlankNode:([^ >]+)/g, (_, id) => {
        let label = labels.get(id);

        if (label === undefined) {
            label = `BlankNode:#${labels.size}`;
            labels.set(id, label);
        }

        return label;
    }));
}

/**
 * Tokenizes text with the default blank node id generator.
 */
function tokenize(text: string) {
    return new TurtleLexer().tokenize(text);
}

/**
 * Parses text with the syntax tree parser and reports whether it was accepted.
 */
function parseWithSyntaxTree(text: string) {
    const tokens = tokenize(text).tokens;
    const parser = new TurtleParser();
    const cst = parser.parse(tokens, false);
    const accepted = parser.errors.length === 0 && parser.semanticErrors.length === 0;

    return { tokens, cst, accepted };
}

/**
 * Reads quads with the quad reader, returning the error instead of throwing.
 */
function readQuads(tokens: ReturnType<typeof tokenize>['tokens']): { quads?: Quad[]; error?: QuadReaderError } {
    try {
        return { quads: new TurtleQuadReader().read(tokens) };
    } catch (error) {
        return { error: error as QuadReaderError };
    }
}

describe('TurtleQuadReader', () => {
    describe('against the syntax tree reader on the W3C fixtures', () => {
        const fixtures = [...listFixtures('.'), ...listFixtures('rdf12/eval'), ...listFixtures('rdf12/syntax')];

        it('covers the fixture corpus', () => {
            expect(fixtures.length).toBeGreaterThan(300);
        });

        for (const fixture of fixtures) {
            it(fixture, async () => {
                const text = readFixture(fixture);

                if (tokenize(text).errors.length > 0) {
                    return;
                }

                const { tokens, cst, accepted } = parseWithSyntaxTree(text);
                const { quads, error } = readQuads(tokens);

                if (!accepted) {
                    expect(error).toBeInstanceOf(QuadReaderError);

                    return;
                }

                expect(error).toBeUndefined();

                const expectedPath = path.join(fixturesDirectory, fixture.replace(/\.ttl$/, '.nt'));

                if (fs.existsSync(expectedPath)) {
                    expect(quadsMatch(quads!, parseNTriples12(fs.readFileSync(expectedPath, 'utf-8')))).toBe(true);
                }

                if (REDECLARING_FIXTURES.has(path.basename(fixture))) {
                    expect(quadsMatch(quads!, await parseQuads(text))).toBe(true);
                } else if (!COLLIDING_FIXTURES.has(path.basename(fixture))) {
                    expect(relabeledQuadKeys(quads!)).toEqual(relabeledQuadKeys(new TurtleReader().visit(cst) as Quad[]));
                }
            });
        }
    });

    describe('directives', () => {
        it('applies a redeclared prefix from the point where it is written', () => {
            const text = readFixture('prefix_reassigned_and_used.ttl');
            const quads = new TurtleQuadReader().read(tokenize(text).tokens);

            expect(quads).toHaveLength(1);
            expect(quads[0].subject.value).toBe('http://b.example/s');
        });

        it('resolves relative IRIs against the base declared so far', () => {
            const text = '@base <http://example.org/a/> . <x> <p> <y> . BASE <http://example.org/b/> <x> <p> <> .';
            const quads = new TurtleQuadReader().read(tokenize(text).tokens);

            expect(quads.map(quad => quad.subject.value)).toEqual(['http://example.org/a/x', 'http://example.org/b/x']);
            expect(quads[1].object.value).toBe('http://example.org/b/');
        });

        it('exposes the declared namespaces and base', () => {
            const reader = new TurtleQuadReader();

            reader.read(tokenize('PREFIX ex: <http://example.org/> BASE <http://base.org/> ex:s ex:p ex:o .').tokens);

            expect(reader.namespaces).toEqual({ ex: 'http://example.org/' });
            expect(reader.baseIri).toBe('http://base.org/');
        });

        it('accepts version directives', () => {
            const quads = new TurtleQuadReader().read(tokenize("@version '1.2' . VERSION \"1.2\" <s> <p> <o> .").tokens);

            expect(quads).toHaveLength(1);
        });
    });

    describe('blank node ids', () => {
        it('takes the ids the lexer assigned to the tokens', () => {
            const text = '@prefix ex: <http://example.org/> . [] ex:p [ ex:q ( ex:a ex:b ) ] ; ex:r _:label .';
            const tokens = new TurtleLexer(createFileBlankNodeIdGenerator('file:///doc.ttl')).tokenize(text).tokens;
            const quads = new TurtleQuadReader().read(tokens);
            const cst = new TurtleParser().parse(tokens);

            expect(quadKeys(quads)).toEqual(quadKeys(new TurtleReader().visit(cst) as Quad[]));
            expect(quads.every(quad => quad.subject.termType !== 'BlankNode' || quad.subject.value.includes('_'))).toBe(true);
        });

        it('names the anonymous reifiers of reified triples and annotation blocks after their tokens', () => {
            const text = '@prefix ex: <http://example.org/> . << ex:s ex:p ex:o >> ex:q ex:r . ex:s ex:p ex:o {| ex:a ex:b |} .';
            const tokens = new TurtleLexer(createFileBlankNodeIdGenerator('file:///doc.ttl')).tokenize(text).tokens;
            const quads = new TurtleQuadReader().read(tokens);
            const reifiers = quads.filter(quad => quad.predicate.value.endsWith('#reifies')).map(quad => quad.subject.value);

            expect(reifiers).toHaveLength(2);
            expect(new Set(reifiers).size).toBe(2);
            expect(reifiers.every(id => id.includes('_b'))).toBe(true);
        });
    });

    describe('errors', () => {
        it('reports an undefined prefix with its token', () => {
            expect.assertions(3);

            try {
                new TurtleQuadReader().read(tokenize('<s> <p> ex:o .').tokens);
            } catch (error) {
                expect(error).toBeInstanceOf(QuadReaderError);
                expect((error as QuadReaderError).message).toBe('Undefined prefix: ex');
                expect((error as QuadReaderError).token?.image).toBe('ex:o');
            }
        });

        it('reports a missing period with the token found instead', () => {
            expect.assertions(2);

            try {
                new TurtleQuadReader().read(tokenize('<s> <p> <o> <s2> <p> <o> .').tokens);
            } catch (error) {
                expect((error as QuadReaderError).message).toBe("Expected 'PERIOD' but found '<s2>'");
                expect((error as QuadReaderError).token?.startOffset).toBe(12);
            }
        });

        it('reports an unexpected end of input without a token', () => {
            expect.assertions(2);

            try {
                new TurtleQuadReader().read(tokenize('<s> <p>').tokens);
            } catch (error) {
                expect((error as QuadReaderError).message).toMatch(/^Unexpected end of input/);
                expect((error as QuadReaderError).token).toBeUndefined();
            }
        });

        it('leaves no partial state behind for the next read', () => {
            const reader = new TurtleQuadReader();

            expect(() => reader.read(tokenize('<s> <p>').tokens)).toThrow(QuadReaderError);
            expect(reader.read(tokenize('<s> <p> <o> .').tokens)).toHaveLength(1);
        });
    });

    describe('comments', () => {
        it('skips comment tokens anywhere in the stream', () => {
            const text = '# head\n<s> # after subject\n<p> <o> # trailing\n. # end';
            const quads = new TurtleQuadReader().read(tokenize(text).tokens);

            expect(quads).toHaveLength(1);
        });

        it('sees through a comment between the brackets of an anonymous node', () => {
            const quads = new TurtleQuadReader().read(tokenize('<s> <p> [ # empty\n ] .').tokens);

            expect(quads).toHaveLength(1);
            expect(quads[0].object.termType).toBe('BlankNode');
        });
    });
});
