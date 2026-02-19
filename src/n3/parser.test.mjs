import * as fs from 'fs';
import { N3Lexer, N3Parser } from './parser.mjs';

describe("N3Document", () => {
    const getTestData = (fileUrl) => {
        const relativePath = fileUrl.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const parse = (fileIri, text) => {
        const data = fileIri ? getTestData(fileIri) : text;

        const lexResult = new N3Lexer().tokenize(data);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const parser = new N3Parser();
        parser.input = lexResult.tokens;

        const cst = parser.n3Doc();

        if (parser.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(parser.errors));
        }

        return {
            cst: cst,
            lexResult: lexResult
        };
    }

    // ── Basic Triples ──────────────────────────────────────────────────────

    it('+ basic triples with comma and semicolon', () => {
        expect(() => parse('file://./tests/basic-triples.n3')).not.toThrow();
    });

    it('+ simple triple with IRIs', () => {
        expect(() => parse('file://./tests/no-last-nl.n3')).not.toThrow();
    });

    it('+ one blank node', () => {
        expect(() => parse('file://./tests/one-bnode.n3')).not.toThrow();
    });

    it('+ dot-dash in URIs', () => {
        expect(() => parse('file://./tests/dot-dash.n3')).not.toThrow();
    });

    it('+ zero-length local name', () => {
        expect(() => parse('file://./tests/zero-length-lname.n3')).not.toThrow();
    });

    // ── Directives ─────────────────────────────────────────────────────────

    it('+ @base directive', () => {
        expect(() => parse('file://./tests/base.n3')).not.toThrow();
    });

    it('+ @prefix and simple triples', () => {
        expect(() => parse('file://./tests/sib.n3')).not.toThrow();
    });

    it('+ @forAll and @forSome directives', () => {
        expect(() => parse('file://./tests/qvars3.n3')).not.toThrow();
    });

    // ── Literals ───────────────────────────────────────────────────────────

    it('+ boolean literals', () => {
        expect(() => parse('file://./tests/boolean.n3')).not.toThrow();
    });

    it('+ decimal and numeric literals', () => {
        expect(() => parse('file://./tests/decimal.n3')).not.toThrow();
    });

    // ── N3 Equality ────────────────────────────────────────────────────────

    it('+ equals with IRIs', () => {
        expect(() => parse('file://./tests/equals1.n3')).not.toThrow();
    });

    it('+ equals with literal', () => {
        expect(() => parse('file://./tests/equals2.n3')).not.toThrow();
    });

    // ── Formulas ───────────────────────────────────────────────────────────

    it('+ simple formula as object', () => {
        expect(() => parse('file://./tests/formula-simple-1.n3')).not.toThrow();
    });

    it('+ formula as subject', () => {
        expect(() => parse('file://./tests/formula-subject.n3')).not.toThrow();
    });

    it('+ graph as object', () => {
        expect(() => parse('file://./tests/graph-as-object.n3')).not.toThrow();
    });

    it('+ formula with blank node', () => {
        expect(() => parse('file://./tests/formula_bnode.n3')).not.toThrow();
    });

    it('+ nested formulas', () => {
        expect(() => parse('file://./tests/nested.n3')).not.toThrow();
    });

    it('+ blank node across formulae', () => {
        expect(() => parse('file://./tests/BnodeAcrossFormulae.n3')).not.toThrow();
    });

    it('+ separator terms with formulas', () => {
        expect(() => parse('file://./tests/sep-term.n3')).not.toThrow();
    });

    // ── Quick Variables ────────────────────────────────────────────────────

    it('+ quick variables with implies', () => {
        expect(() => parse('file://./tests/qvars1.n3')).not.toThrow();
    });

    it('+ quick variables with implied-by', () => {
        expect(() => parse('file://./tests/qvars2.n3')).not.toThrow();
    });

    // ── Paths ──────────────────────────────────────────────────────────────

    it('+ forward and reverse paths', () => {
        expect(() => parse('file://./tests/path1.n3')).not.toThrow();
    });

    // ── Has / Is..Of / Inverted Properties ─────────────────────────────────

    it('+ has, is..of keywords', () => {
        expect(() => parse('file://./tests/has-is-of.n3')).not.toThrow();
    });

    it('+ inverted property with <- operator', () => {
        expect(() => parse('file://./tests/inverted-property.n3')).not.toThrow();
    });

    // ── N3-specific complex tests ──────────────────────────────────────────

    it('+ bad-preds (log:implies with formulas and variables)', () => {
        expect(() => parse('file://./tests/bad-preds.n3')).not.toThrow();
    });

    it('+ zero predicates (subject only)', () => {
        expect(() => parse('file://./tests/zero-predicates.n3')).not.toThrow();
    });

    it('+ collections', () => {
        expect(() => parse('file://./tests/collections.n3')).not.toThrow();
    });

    // ── Inline text parsing ────────────────────────────────────────────────

    it('+ empty document', () => {
        expect(() => parse(null, '')).not.toThrow();
    });

    it('+ comment only', () => {
        expect(() => parse(null, '# just a comment\n')).not.toThrow();
    });

    it('+ simple triple inline', () => {
        expect(() => parse(null, '<http://example.org/s> <http://example.org/p> <http://example.org/o> .')).not.toThrow();
    });

    it('+ formula inline', () => {
        expect(() => parse(null, '{ <http://example.org/a> <http://example.org/b> <http://example.org/c> } <http://example.org/p> <http://example.org/o> .')).not.toThrow();
    });

    it('+ implies inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . { :a :b :c } => { :d :e :f } .')).not.toThrow();
    });

    it('+ implied-by inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . { :a :b :c } <= { :d :e :f } .')).not.toThrow();
    });

    it('+ equals inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . :a = :b .')).not.toThrow();
    });

    it('+ quick variable inline', () => {
        expect(() => parse(null, '{ ?x <http://example.org/p> ?y } => { ?y <http://example.org/q> ?x } .')).not.toThrow();
    });

    it('+ has keyword inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . :a has :b :c .')).not.toThrow();
    });

    it('+ is..of keyword inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . :a is :b of :c .')).not.toThrow();
    });

    it('+ forward path inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . :a!:b :c :d .')).not.toThrow();
    });

    it('+ reverse path inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . :a^:b :c :d .')).not.toThrow();
    });

    it('+ inverted predicate inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . :a <- :b :c .')).not.toThrow();
    });

    it('+ @forAll inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . @forAll :x, :y . { :x :p :y } => { :y :q :x } .')).not.toThrow();
    });

    it('+ @forSome inline', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . @forSome :x . :x :p :o .')).not.toThrow();
    });

    it('+ empty formula', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . {} :p :o .')).not.toThrow();
    });

    it('+ nested formula', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . { { :a :b :c } :d :e } :f :g .')).not.toThrow();
    });

    it('+ SPARQL-style PREFIX', () => {
        expect(() => parse(null, 'PREFIX : <http://example.org/>\n:a :b :c .')).not.toThrow();
    });

    it('+ collection in formula', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . { ( :a :b ) :p :o } :q :r .')).not.toThrow();
    });

    it('+ blank node property list in formula', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . { [ :a :b ] :p :o } :q :r .')).not.toThrow();
    });

    it('+ multiple statements in formula', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . { :a :b :c . :d :e :f } :p :o .')).not.toThrow();
    });

    it('+ trailing semicolon', () => {
        expect(() => parse(null, '@prefix : <http://example.org/> . :a :b :c ; :d :e ; .')).not.toThrow();
    });
});
