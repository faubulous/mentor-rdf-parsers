import * as fs from 'fs';
import { N3Lexer, N3Parser } from './parser.js';
import { N3Reader } from './reader.js';
import dataFactory from '@rdfjs/data-model';

/**
 * Notation3 (N3) Reader Tests
 *
 * Test datasets:
 *
 * The .n3 fixture files in the `tests/` directory are hand-crafted.
 * See parser.test.mjs for full provenance details.
 */
describe("N3Reader", () => {
    const getTestData = (fileIri) => {
        const relativePath = fileIri.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const readQuads = (fileIri, text) => {
        const data = fileIri ? getTestData(fileIri) : text;

        const lexResult = new N3Lexer().tokenize(data);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const cst = new N3Parser().parse(fileIri || 'file://test', lexResult.tokens);
        const reader = new N3Reader();
        return reader.visit(cst);
    }

    // ── Basic Triples ──────────────────────────────────────────────────────

    it('+ reads simple triple', () => {
        const quads = readQuads(null, '<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.value).toBe('http://example.org/s');
        expect(quads[0].predicate.value).toBe('http://example.org/p');
        expect(quads[0].object.value).toBe('http://example.org/o');
    });

    it('+ reads prefixed triples', () => {
        const quads = readQuads('file://./tests/basic-triples.n3');
        expect(quads.length).toBe(4);
    });

    it('+ reads triple with comma-separated objects', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b :c, :d .');
        expect(quads.length).toBe(2);
    });

    it('+ reads triple with semicolon-separated predicates', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b :c ; :d :e .');
        expect(quads.length).toBe(2);
    });

    // ── Directives ─────────────────────────────────────────────────────────

    it('+ reads @prefix directive', () => {
        const quads = readQuads(null, '@prefix ex: <http://example.org/> . ex:a ex:b ex:c .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.value).toBe('http://example.org/a');
    });

    it('+ reads SPARQL PREFIX directive', () => {
        const quads = readQuads(null, 'PREFIX ex: <http://example.org/>\nex:a ex:b ex:c .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.value).toBe('http://example.org/a');
    });

    it('+ reads @base directive', () => {
        const quads = readQuads(null, '@base <http://example.org/> . <a> <b> <c> .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.value).toBe('http://example.org/a');
    });

    it('+ handles @forAll without error', () => {
        const quads = readQuads('file://./tests/qvars3.n3');
        expect(quads).toBeDefined();
    });

    // ── Literals ───────────────────────────────────────────────────────────

    it('+ reads string literal', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b "hello" .');
        expect(quads.length).toBe(1);
        expect(quads[0].object.value).toBe('hello');
    });

    it('+ reads language-tagged literal', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b "hello"@en .');
        expect(quads.length).toBe(1);
        expect(quads[0].object.language).toBe('en');
    });

    it('+ reads typed literal', () => {
        const quads = readQuads(null, '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> . @prefix : <http://example.org/> . :a :b "42"^^xsd:integer .');
        expect(quads.length).toBe(1);
        expect(quads[0].object.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#integer');
    });

    it('+ reads integer literal', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b 42 .');
        expect(quads.length).toBe(1);
        expect(quads[0].object.value).toBe('42');
        expect(quads[0].object.datatype.value).toBe('http://www.w3.org/2001/XMLSchema#integer');
    });

    it('+ reads boolean literals', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b true . :c :d false .');
        expect(quads.length).toBe(2);
        expect(quads[0].object.value).toBe('true');
        expect(quads[1].object.value).toBe('false');
    });

    // ── rdf:type (a) ──────────────────────────────────────────────────────

    it('+ reads \'a\' as rdf:type', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :x a :Thing .');
        expect(quads.length).toBe(1);
        expect(quads[0].predicate.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    });

    // ── Blank Nodes ────────────────────────────────────────────────────────

    it('+ reads blank node label', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . _:b0 :p :o .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.termType).toBe('BlankNode');
    });

    it('+ reads blank node property list', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b [ :c :d ] .');
        expect(quads.length).toBe(2);
    });

    it('+ reads anonymous blank node', () => {
        const quads = readQuads('file://./tests/one-bnode.n3');
        expect(quads.length).toBe(2);
    });

    // ── Collections ────────────────────────────────────────────────────────

    it('+ reads empty collection', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . () a :EmptyList .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');
    });

    it('+ reads non-empty collection', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . ( :a :b :c ) a :List .');
        // 3 rdf:first + 3 rdf:rest + 1 a :List = 7
        expect(quads.length).toBe(7);
    });

    // ── N3 Equality (=) ───────────────────────────────────────────────────

    it('+ reads = as owl:sameAs', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a = :b .');
        expect(quads.length).toBe(1);
        expect(quads[0].predicate.value).toBe('http://www.w3.org/2002/07/owl#sameAs');
    });

    it('+ reads = with literal', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a = "hello" .');
        expect(quads.length).toBe(1);
        expect(quads[0].predicate.value).toBe('http://www.w3.org/2002/07/owl#sameAs');
        expect(quads[0].object.value).toBe('hello');
    });

    // ── Implies (=>) ──────────────────────────────────────────────────────

    it('+ reads => as log:implies', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . { :a :b :c } => { :d :e :f } .');
        // 2 formula quads (in named graphs) + 1 implies quad = 3
        expect(quads.length).toBe(3);

        // Find the implies quad (it's in the default graph)
        const impliesQuad = quads.find(q => q.predicate.value === 'http://www.w3.org/2000/10/swap/log#implies');
        expect(impliesQuad).toBeDefined();
    });

    // ── Implied-by (<=) ───────────────────────────────────────────────────

    it('+ reads <= as reversed log:implies', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . { :a :b :c } <= { :d :e :f } .');
        // 2 formula quads (in named graphs) + 1 implies quad = 3
        expect(quads.length).toBe(3);

        // With <=, the right-hand formula implies the left-hand formula
        const impliesQuad = quads.find(q => q.predicate.value === 'http://www.w3.org/2000/10/swap/log#implies');
        expect(impliesQuad).toBeDefined();
        // The subject of the implies quad should be the right-hand formula (the antecedent)
        expect(impliesQuad.subject.termType).toBe('BlankNode');
        expect(impliesQuad.object.termType).toBe('BlankNode');
    });

    // ── Quick Variables ────────────────────────────────────────────────────

    it('+ reads quick variables', () => {
        const quads = readQuads(null, '{ ?x <http://example.org/p> ?y } => { ?y <http://example.org/q> ?x } .');
        expect(quads.length).toBe(3); // 2 formula + 1 implies

        // Check that variables are created
        const formulaQuads = quads.filter(q => q.graph.termType === 'BlankNode');
        expect(formulaQuads.length).toBe(2);

        const varQuad = formulaQuads[0];
        expect(varQuad.subject.termType).toBe('Variable');
        expect(varQuad.subject.value).toBe('x');
    });

    // ── Formulas ───────────────────────────────────────────────────────────

    it('+ reads simple formula as object', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a :b { :c :d :e } .');
        // 1 formula quad (in named graph) + 1 main quad = 2
        expect(quads.length).toBe(2);
    });

    it('+ reads formula as subject', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . { :c :d :e } :source :doc .');
        expect(quads.length).toBe(2);
    });

    it('+ reads empty formula', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . {} :p :o .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.termType).toBe('BlankNode');
    });

    it('+ reads nested formulas', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . { { :a :b :c } :d :e } :f :g .');
        // Inner formula: 1 quad in inner graph
        // Outer formula: inner formula as subject + :d :e = 1 quad with graph
        // Main: 1 quad
        expect(quads.length).toBe(3);
    });

    it('+ reads multiple statements in formula', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . { :a :b :c . :d :e :f } :p :o .');
        expect(quads.length).toBe(3); // 2 formula quads + 1 main quad
    });

    // ── Has / Is..Of ──────────────────────────────────────────────────────

    it('+ reads has keyword', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a has :b :c .');
        expect(quads.length).toBe(1);
        expect(quads[0].subject.value).toBe('http://example.org/a');
        expect(quads[0].predicate.value).toBe('http://example.org/b');
        expect(quads[0].object.value).toBe('http://example.org/c');
    });

    it('+ reads is..of keyword (reversed predicate)', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a is :b of :c .');
        expect(quads.length).toBe(1);
        // is :b of reverses: :c :b :a
        expect(quads[0].subject.value).toBe('http://example.org/c');
        expect(quads[0].predicate.value).toBe('http://example.org/b');
        expect(quads[0].object.value).toBe('http://example.org/a');
    });

    // ── Inverted Properties (<-) ──────────────────────────────────────────

    it('+ reads <- inverted predicate', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :s <- :p :o .');
        expect(quads.length).toBe(1);
        // <- reverses: :o :p :s
        expect(quads[0].subject.value).toBe('http://example.org/o');
        expect(quads[0].predicate.value).toBe('http://example.org/p');
        expect(quads[0].object.value).toBe('http://example.org/s');
    });

    // ── Paths ──────────────────────────────────────────────────────────────

    it('+ reads forward path (a!b)', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :albert!:mother :sister :auntie .');
        // :albert!:mother creates: :albert :mother _:bN => _:bN used as subject
        // Then _:bN :sister :auntie
        expect(quads.length).toBe(2);
        expect(quads[0].subject.value).toBe('http://example.org/albert');
        expect(quads[0].predicate.value).toBe('http://example.org/mother');
        expect(quads[1].predicate.value).toBe('http://example.org/sister');
        expect(quads[1].object.value).toBe('http://example.org/auntie');
    });

    it('+ reads reverse path (a^b)', () => {
        const quads = readQuads(null, '@prefix : <http://example.org/> . :albert^:father :sister :niece .');
        // :albert^:father creates: _:bN :father :albert => _:bN used as subject
        // Then _:bN :sister :niece
        expect(quads.length).toBe(2);
        expect(quads[0].object.value).toBe('http://example.org/albert');
        expect(quads[0].predicate.value).toBe('http://example.org/father');
        expect(quads[1].predicate.value).toBe('http://example.org/sister');
        expect(quads[1].object.value).toBe('http://example.org/niece');
    });

    // ── Zero Predicates ────────────────────────────────────────────────────

    it('+ reads subject with zero predicates', () => {
        // In N3, `:a .` is valid (subject without predicates)
        const quads = readQuads(null, '@prefix : <http://example.org/> . :a .');
        expect(quads.length).toBe(0);
    });

    // ── Complex File Tests ─────────────────────────────────────────────────

    it('+ reads nested.n3 file', () => {
        const quads = readQuads('file://./tests/nested.n3');
        expect(quads.length).toBeGreaterThan(0);
    });

    it('+ reads formula_bnode.n3 file', () => {
        const quads = readQuads('file://./tests/formula_bnode.n3');
        expect(quads.length).toBeGreaterThan(0);
    });

    it('+ reads sep-term.n3 file', () => {
        const quads = readQuads('file://./tests/sep-term.n3');
        expect(quads.length).toBeGreaterThan(0);
    });

    it('+ reads bad-preds.n3 file', () => {
        const quads = readQuads('file://./tests/bad-preds.n3');
        expect(quads.length).toBeGreaterThan(0);
    });

    it('+ reads BnodeAcrossFormulae.n3 file', () => {
        const quads = readQuads('file://./tests/BnodeAcrossFormulae.n3');
        expect(quads.length).toBeGreaterThan(0);
    });

    it('+ reads path1.n3 file', () => {
        const quads = readQuads('file://./tests/path1.n3');
        expect(quads.length).toBeGreaterThan(0);
    });

    it('+ reads qvars1.n3 file', () => {
        const quads = readQuads('file://./tests/qvars1.n3');
        expect(quads.length).toBeGreaterThan(0);
    });

    it('+ reads qvars2.n3 file', () => {
        const quads = readQuads('file://./tests/qvars2.n3');
        expect(quads.length).toBeGreaterThan(0);
    });
});
