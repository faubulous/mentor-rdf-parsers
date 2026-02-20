import * as fs from 'fs';
import { NQuadsLexer, NQuadsParser } from './parser.mjs';

/**
 * N-Quads Parser Tests
 *
 * Test datasets:
 *
 * The .nq fixture files in the `tests/` directory are derived from the
 * official W3C RDF Test Suite for N-Quads, distributed under the W3C
 * Test Suite License and the W3C 3-clause BSD License.
 *
 * Source manifest: tests/manifest.ttl
 * Upstream: https://w3c.github.io/rdf-tests/
 *
 * The fixture files were generated from the manifest using:
 *   node src/util/generate-tests.js \
 *     --manifest src/tree-sitter-nquads/tests/manifest.ttl \
 *     -p TestNQuadsPositiveSyntax \
 *     -n TestNQuadsNegativeSyntax \
 *     -e .nq
 *
 * See src/util/README.md for details on the test generation process.
 */
describe("NQuadsDocument", () => {
    const getTestData = (fileUrl) => {
        const relativePath = fileUrl.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const parse = (text) => {
        const lexResult = new NQuadsLexer().tokenize(text);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        return {
            lexResult,
            cst: new NQuadsParser().parse(lexResult.tokens)
        }
    }

    it('- @base not allowed in N-Triples (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-base-01.nq'))).toThrowError();
    });

    it('- @prefix not allowed in n-triples (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-prefix-01.nq'))).toThrowError();
    });

    it('- Bad IRI : bad escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-02.nq'))).toThrowError();
    });

    it('- Bad IRI : bad long escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-03.nq'))).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (2) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-05.nq'))).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-04.nq'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in datatype (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-09.nq'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-08.nq'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-07.nq'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-06.nq'))).toThrowError();
    });

    it('- Bad IRI : space (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-01.nq'))).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-esc-01.nq'))).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-esc-02.nq'))).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-esc-03.nq'))).toThrowError();
    });

    it('- Graph name may not be a datatyped literal (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nq-syntax-bad-literal-03.nq'))).toThrowError();
    });

    it('- Graph name may not be a language tagged literal (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nq-syntax-bad-literal-02.nq'))).toThrowError();
    });

    it('- Graph name may not be a simple literal (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nq-syntax-bad-literal-01.nq'))).toThrowError();
    });

    it('- Graph name URI must be absolute (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nq-syntax-bad-uri-01.nq'))).toThrowError();
    });

    it('- langString with bad lang (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-lang-01.nq'))).toThrowError();
    });

    it('- long double string literal (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-05.nq'))).toThrowError();
    });

    it('- long single string literal (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-04.nq'))).toThrowError();
    });

    it('- mismatching string literal open/close (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-01.nq'))).toThrowError();
    });

    it('- mismatching string literal open/close (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-02.nq'))).toThrowError();
    });

    it('- N-Quads does not have a fifth element (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nq-syntax-bad-quint-01.nq'))).toThrowError();
    });

    it('- N-Triples does not have objectList (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-struct-01.nq'))).toThrowError();
    });

    it('- N-Triples does not have predicateObjectList (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-struct-02.nq'))).toThrowError();
    });

    it('- no numbers in N-Triples (decimal) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-num-02.nq'))).toThrowError();
    });

    it('- no numbers in N-Triples (float) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-num-03.nq'))).toThrowError();
    });

    it('- no numbers in N-Triples (integer) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-num-01.nq'))).toThrowError();
    });

    it('- single quotes (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-03.nq'))).toThrowError();
    });

    it('- string literal with no end (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-06.nq'))).toThrowError();

    });

    it('- string literal with no start (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-07.nq'))).toThrowError();
    });

    it('+ Blank node labels may start with a digit', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-bnode-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BNode graph with BNode object', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-bnode-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BNode graph with BNode subject', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-bnode-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BNode graph with datatyped literal', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-bnode-06.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BNode graph with language tagged literal', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-bnode-05.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BNode graph with simple literal', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-bnode-04.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BNode graph with URI triple', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-bnode-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode object', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-bnode-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode subject', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-bnode-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty file', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-file-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer as xsd:string', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-datatypes-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with long Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-string-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal with region', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-string-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langtagged string \"x\"@en', () => {
        const result = parse(getTestData('file://./tests/langtagged_string.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ lantag with subtag \"x\"@en-us', () => {
        const result = parse(getTestData('file://./tests/lantag_with_subtag.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Legal IRIs', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-04.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal \"\"\"x\"\"\"', () => {
        const result = parse(getTestData('file://./tests/literal.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with 2 squotes \"\"\"a\"\"b\"\"\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_2_dquotes.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with 2 squotes \"x\'\'y\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_2_squotes.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with BACKSPACE', () => {
        const result = parse(getTestData('file://./tests/literal_with_BACKSPACE.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with CARRIAGE RETURN', () => {
        const result = parse(getTestData('file://./tests/literal_with_CARRIAGE_RETURN.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with CHARACTER TABULATION', () => {
        const result = parse(getTestData('file://./tests/literal_with_CHARACTER_TABULATION.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with dquote \"x\"y\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_dquote.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with FORM FEED', () => {
        const result = parse(getTestData('file://./tests/literal_with_FORM_FEED.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with LINE FEED', () => {
        const result = parse(getTestData('file://./tests/literal_with_LINE_FEED.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with numeric escape4 \\u', () => {
        const result = parse(getTestData('file://./tests/literal_with_numeric_escape4.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with numeric escape8 \\U', () => {
        const result = parse(getTestData('file://./tests/literal_with_numeric_escape8.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with REVERSE SOLIDUS', () => {
        const result = parse(getTestData('file://./tests/literal_with_REVERSE_SOLIDUS.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with squote \"x\'y\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_squote.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal_all_controls \'\\x00\\x01\\x02\\x03\\x04...\'', () => {
        const result = parse(getTestData('file://./tests/literal_all_controls.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal_all_punctuation \'!\"#$%&()...\'', () => {
        const result = parse(getTestData('file://./tests/literal_all_punctuation.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // Note: Disabled because it is hard to add support for non-ascii characters in Tree-Sitter and the test is only a proposal.
    // it('+ literal_ascii_boundaries \'\\x00\\x26\\x28...\'', () => {
    //     const result = parse(getTestData('file://./tests/literal_ascii_boundaries.nq'));
    //     expect(result.lexResult.errors.length).toEqual(0);
    // });

    it('+ literal_with_UTF8_boundaries \'\\x80\\x7ff\\x800\\xfff...\'', () => {
        const result = parse(getTestData('file://./tests/literal_with_UTF8_boundaries.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ One comment, one empty line', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-file-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only comment', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-file-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only IRIs', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ REVERSE SOLIDUS at end of literal', () => {
        const result = parse(getTestData('file://./tests/literal_with_REVERSE_SOLIDUS2.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-string-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with escaped newline', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-str-esc-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with long Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-str-esc-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-str-esc-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Submission test from Original RDF Test Cases', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-subm-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ tests absense of whitespace between subject, predicate, object and end-of-statement', () => {
        const result = parse(getTestData('file://./tests/minimal_whitespace.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Tests comments after a triple', () => {
        const result = parse(getTestData('file://./tests/comment_following_triple.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ URI graph with BNode object', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-uri-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ URI graph with BNode subject', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-uri-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ URI graph with datatyped literal', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-uri-06.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ URI graph with language tagged literal', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-uri-05.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ URI graph with simple literal', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-uri-04.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ URI graph with URI triple', () => {
        const result = parse(getTestData('file://./tests/nq-syntax-uri-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ xsd:byte literal', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-datatypes-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // =====================================================
    // RDF 1.2 Tests
    // =====================================================

    // Positive syntax tests

    it('+ RDF 1.2: object triple term', () => {
        const result = parse(getTestData('file://./tests/rdf12/nquads12-syntax-01.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: object triple term, no whitespace', () => {
        const result = parse(getTestData('file://./tests/rdf12/nquads12-syntax-02.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: nested, no whitespace', () => {
        const result = parse(getTestData('file://./tests/rdf12/nquads12-syntax-03.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: blank node subject', () => {
        const result = parse(getTestData('file://./tests/rdf12/nquads12-bnode-1.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: nested object term', () => {
        const result = parse(getTestData('file://./tests/rdf12/nquads12-nested-1.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: literal with base direction ltr', () => {
        const result = parse(getTestData('file://./tests/rdf12/nquads-langdir-1.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: literal with base direction rtl', () => {
        const result = parse(getTestData('file://./tests/rdf12/nquads-langdir-2.nq'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // Negative syntax tests

    it('- RDF 1.2: reified triple as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-01.nq'))).toThrowError();
    });

    it('- RDF 1.2: reified triple, literal subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-02.nq'))).toThrowError();
    });

    it('- RDF 1.2: reified triple, literal predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-03.nq'))).toThrowError();
    });

    it('- RDF 1.2: reified triple, blank node predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-04.nq'))).toThrowError();
    });

    it('- RDF 1.2: triple term as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-05.nq'))).toThrowError();
    });

    it('- RDF 1.2: triple term, literal subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-06.nq'))).toThrowError();
    });

    it('- RDF 1.2: triple term, literal predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-07.nq'))).toThrowError();
    });

    it('- RDF 1.2: triple term, blank node predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-08.nq'))).toThrowError();
    });

    it('- RDF 1.2: reified triple object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-09.nq'))).toThrowError();
    });

    it('- RDF 1.2: triple term as subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-syntax-10.nq'))).toThrowError();
    });

    it('- RDF 1.2: subject reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-reified-syntax-1.nq'))).toThrowError();
    });

    it('- RDF 1.2: object reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-reified-syntax-2.nq'))).toThrowError();
    });

    it('- RDF 1.2: subject and object reified triples (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-reified-syntax-3.nq'))).toThrowError();
    });

    it('- RDF 1.2: predicate reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bad-reified-syntax-4.nq'))).toThrowError();
    });

    it('- RDF 1.2: annotated triple, blank node subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bnode-bad-annotated-syntax-1.nq'))).toThrowError();
    });

    it('- RDF 1.2: annotated triple, blank node object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-bnode-bad-annotated-syntax-2.nq'))).toThrowError();
    });

    it('- RDF 1.2: annotated triple, nested subject term (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-nested-bad-annotated-syntax-1.nq'))).toThrowError();
    });

    it('- RDF 1.2: annotated triple, nested object term (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads12-nested-bad-annotated-syntax-2.nq'))).toThrowError();
    });

    it('- RDF 1.2: undefined base direction (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads-langdir-bad-1.nq'))).toThrowError();
    });

    it('- RDF 1.2: upper case LTR (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/nquads-langdir-bad-2.nq'))).toThrowError();
    });
});