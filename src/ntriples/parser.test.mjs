import * as fs from 'fs';
import { NTriplesLexer, NTriplesParser } from './parser.mjs';

describe("NTriplesDocument", () => {
    const getTestData = (fileUrl) => {
        const relativePath = fileUrl.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const parse = (text) => {
        const lexResult = new NTriplesLexer().tokenize(text);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        return {
            lexResult,
            cst: new NTriplesParser().parse(lexResult.tokens)
        }
    }

    it('- @base not allowed in N-Triples (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-base-01.nt'))).toThrowError();
    });

    it('- @prefix not allowed in n-triples (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-prefix-01.nt'))).toThrowError();
    });

    it('- Bad IRI : bad escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-02.nt'))).toThrowError();
    });

    it('- Bad IRI : bad long escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-03.nt'))).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (2) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-05.nt'))).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-04.nt'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in datatype (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-09.nt'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-08.nt'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-07.nt'))).toThrowError();
    });

    it('- Bad IRI : relative IRI not allowed in subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-06.nt'))).toThrowError();
    });

    it('- Bad IRI : space (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-uri-01.nt'))).toThrowError();
    });

    it('- Bad string escape (negative test 1)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-esc-01.nt'))).toThrowError();
    });

    it('- Bad string escape (negative test 2)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-esc-02.nt'))).toThrowError();
    });

    it('- Bad string escape (negative test 3)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-esc-03.nt'))).toThrowError();
    });

    it('- langString with bad lang (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-lang-01.nt'))).toThrowError();
    });

    it('- long double string literal (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-05.nt'))).toThrowError();
    });

    it('- long single string literal (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-04.nt'))).toThrowError();
    });

    it('- mismatching string literal open/close (negative test 1)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-01.nt'))).toThrowError();
    });

    it('- mismatching string literal open/close (negative test 2)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-02.nt'))).toThrowError();
    });

    it('- N-Triples does not have objectList (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-struct-01.nt'))).toThrowError();
    });

    it('- N-Triples does not have predicateObjectList (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-struct-02.nt'))).toThrowError();
    });

    it('- no numbers in N-Triples (decimal) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-num-02.nt'))).toThrowError();
    });

    it('- no numbers in N-Triples (float) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-num-03.nt'))).toThrowError();
    });

    it('- no numbers in N-Triples (integer) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-num-01.nt'))).toThrowError();
    });

    it('- single quotes (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-03.nt'))).toThrowError();
    });

    it('- string literal with no end (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-06.nt'))).toThrowError();
    });

    it('- string literal with no start (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/nt-syntax-bad-string-07.nt'))).toThrowError();
    });

    it('+ Blank node labels may start with a digit', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-bnode-03.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode object', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-bnode-02.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode subject', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-bnode-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty file', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-file-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer as xsd:string', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-datatypes-02.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with long Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-03.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-02.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-string-02.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal with region', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-string-03.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langtagged string \"x\"@en', () => {
        const result = parse(getTestData('file://./tests/langtagged_string.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ lantag with subtag \"x\"@en-us', () => {
        const result = parse(getTestData('file://./tests/lantag_with_subtag.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Legal IRIs', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-04.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal \"\"\"x\"\"\"', () => {
        const result = parse(getTestData('file://./tests/literal.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with 2 squotes \"\"\"a\"\"b\"\"\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_2_dquotes.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with 2 squotes \"x\'\'y\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_2_squotes.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with BACKSPACE', () => {
        const result = parse(getTestData('file://./tests/literal_with_BACKSPACE.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with CARRIAGE RETURN', () => {
        const result = parse(getTestData('file://./tests/literal_with_CARRIAGE_RETURN.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with CHARACTER TABULATION', () => {
        const result = parse(getTestData('file://./tests/literal_with_CHARACTER_TABULATION.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with dquote \"x\"y\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_dquote.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with FORM FEED', () => {
        const result = parse(getTestData('file://./tests/literal_with_FORM_FEED.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with LINE FEED', () => {
        const result = parse(getTestData('file://./tests/literal_with_LINE_FEED.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with numeric escape4 \\u', () => {
        const result = parse(getTestData('file://./tests/literal_with_numeric_escape4.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with numeric escape8 \\U', () => {
        const result = parse(getTestData('file://./tests/literal_with_numeric_escape8.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with REVERSE SOLIDUS', () => {
        const result = parse(getTestData('file://./tests/literal_with_REVERSE_SOLIDUS.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal with squote \"x\'y\"', () => {
        const result = parse(getTestData('file://./tests/literal_with_squote.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal_all_controls \'\\x00\\x01\\x02\\x03\\x04...\'', () => {
        const result = parse(getTestData('file://./tests/literal_all_controls.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ literal_all_punctuation \'!\"#$%&()...\'', () => {
        const result = parse(getTestData('file://./tests/literal_all_punctuation.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // Note: Disabled because it is hard to add support for non-ascii characters in Tree-Sitter and the test is only a proposal.
    // it('+ literal_ascii_boundaries \'\\x00\\x26\\x28...\'', () => {
    //     const result = parse(getTestData('file://./tests/literal_ascii_boundaries.nt'));
    //     expect(result.lexResult.errors.length).toEqual(0);
    // });

    it('+ literal_with_UTF8_boundaries \'\\x80\\x7ff\\x800\\xfff...\'', () => {
        const result = parse(getTestData('file://./tests/literal_with_UTF8_boundaries.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ One comment, one empty line', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-file-03.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only comment', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-file-02.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only IRIs', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-uri-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ REVERSE SOLIDUS at end of literal', () => {
        const result = parse(getTestData('file://./tests/literal_with_REVERSE_SOLIDUS2.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-string-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with escaped newline', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-str-esc-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with long Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-str-esc-03.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with Unicode escape', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-str-esc-02.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Submission test from Original RDF Test Cases', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-subm-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ tests absense of whitespace between subject, predicate, object and end-of-statement', () => {
        const result = parse(getTestData('file://./tests/minimal_whitespace.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Tests comments after a triple', () => {
        const result = parse(getTestData('file://./tests/comment_following_triple.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ xsd:byte literal', () => {
        const result = parse(getTestData('file://./tests/nt-syntax-datatypes-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // =====================================================
    // RDF 1.2 Tests
    // =====================================================

    // Positive syntax tests

    it('+ RDF 1.2: object triple term', () => {
        const result = parse(getTestData('file://./tests/rdf12/ntriples12-syntax-01.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: object triple term, no whitespace', () => {
        const result = parse(getTestData('file://./tests/rdf12/ntriples12-syntax-02.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: nested, no whitespace', () => {
        const result = parse(getTestData('file://./tests/rdf12/ntriples12-syntax-03.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: blank node subject', () => {
        const result = parse(getTestData('file://./tests/rdf12/ntriples12-bnode-1.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: nested object term', () => {
        const result = parse(getTestData('file://./tests/rdf12/ntriples12-nested-1.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: literal with base direction ltr', () => {
        const result = parse(getTestData('file://./tests/rdf12/ntriples-langdir-1.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: literal with base direction rtl', () => {
        const result = parse(getTestData('file://./tests/rdf12/ntriples-langdir-2.nt'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // Negative syntax tests

    it('- RDF 1.2: reified triple as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-01.nt'))).toThrowError();
    });

    it('- RDF 1.2: reified triple, literal subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-02.nt'))).toThrowError();
    });

    it('- RDF 1.2: reified triple, literal predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-03.nt'))).toThrowError();
    });

    it('- RDF 1.2: reified triple, blank node predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-04.nt'))).toThrowError();
    });

    it('- RDF 1.2: triple term as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-05.nt'))).toThrowError();
    });

    it('- RDF 1.2: triple term, literal subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-06.nt'))).toThrowError();
    });

    it('- RDF 1.2: triple term, literal predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-07.nt'))).toThrowError();
    });

    it('- RDF 1.2: triple term, blank node predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-08.nt'))).toThrowError();
    });

    it('- RDF 1.2: reified triple object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-09.nt'))).toThrowError();
    });

    it('- RDF 1.2: triple term as subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-syntax-10.nt'))).toThrowError();
    });

    it('- RDF 1.2: bad IRI (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-iri-1.nt'))).toThrowError();
    });

    it('- RDF 1.2: subject reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-reified-syntax-1.nt'))).toThrowError();
    });

    it('- RDF 1.2: object reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-reified-syntax-2.nt'))).toThrowError();
    });

    it('- RDF 1.2: subject and object reified triples (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-reified-syntax-3.nt'))).toThrowError();
    });

    it('- RDF 1.2: predicate reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bad-reified-syntax-4.nt'))).toThrowError();
    });

    it('- RDF 1.2: annotated triple, blank node subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bnode-bad-annotated-syntax-1.nt'))).toThrowError();
    });

    it('- RDF 1.2: annotated triple, blank node object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples12-bnode-bad-annotated-syntax-2.nt'))).toThrowError();
    });

    it('- RDF 1.2: undefined base direction (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples-langdir-bad-1.nt'))).toThrowError();
    });

    it('- RDF 1.2: upper case LTR (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/ntriples-langdir-bad-2.nt'))).toThrowError();
    });

    // Note: langdir-bad-3 requires rejecting "..."^^rdf:langString (semantic validation).
    // Note: langdir-bad-4 requires enforcing BCP47 subtag length limits (semantic validation).
    // Note: langdir-bad-5 requires rejecting "..."^^rdf:dirLangString (semantic validation).
    // These are beyond pure syntactic parsing and are skipped.
});