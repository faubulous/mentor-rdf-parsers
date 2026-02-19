import * as fs from 'fs';
import { parseQuads, quadsMatch } from '../helpers.mjs';
import { NTriplesLexer, NTriplesParser } from './parser.mjs';
import { NTriplesReader } from './reader.mjs';

describe("NTriplesReader", () => {
    const getTestData = (fileUrl) => {
        const relativePath = fileUrl.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const matchQuads = async (text) => {
        const lexResult = new NTriplesLexer().tokenize(text);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const cst = new NTriplesParser().parse(lexResult.tokens);

        const actual = new NTriplesReader().visit(cst);
        const expected = await parseQuads(text);

        return quadsMatch(actual, expected);
    }

    it('+ Blank node labels may start with a digit', async () => {
        const data = getTestData('file://./tests/nt-syntax-bnode-03.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ bnode object', async () => {
        const data = getTestData('file://./tests/nt-syntax-bnode-02.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ bnode subject', async () => {
        const data = getTestData('file://./tests/nt-syntax-bnode-01.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ Empty file', async () => {
        const data = getTestData('file://./tests/nt-syntax-file-01.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ integer as xsd:string', async () => {
        const data = getTestData('file://./tests/nt-syntax-datatypes-02.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ IRIs with long Unicode escape', async () => {
        const data = getTestData('file://./tests/nt-syntax-uri-03.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ IRIs with Unicode escape', async () => {
        const data = getTestData('file://./tests/nt-syntax-uri-02.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ langString literal', async () => {
        const data = getTestData('file://./tests/nt-syntax-string-02.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ langString literal with region', async () => {
        const data = getTestData('file://./tests/nt-syntax-string-03.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ langtagged string \"x\"@en', async () => {
        const data = getTestData('file://./tests/langtagged_string.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ lantag with subtag \"x\"@en-us', async () => {
        const data = getTestData('file://./tests/lantag_with_subtag.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ Legal IRIs', async () => {
        const data = getTestData('file://./tests/nt-syntax-uri-04.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal \"\"\"x\"\"\"', async () => {
        const data = getTestData('file://./tests/literal.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with 2 squotes \"\"\"a\"\"b\"\"\"', async () => {
        const data = getTestData('file://./tests/literal_with_2_dquotes.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with 2 squotes \"x\'\'y\"', async () => {
        const data = getTestData('file://./tests/literal_with_2_squotes.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with BACKSPACE', async () => {
        const data = getTestData('file://./tests/literal_with_BACKSPACE.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with CARRIAGE RETURN', async () => {
        const data = getTestData('file://./tests/literal_with_CARRIAGE_RETURN.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with CHARACTER TABULATION', async () => {
        const data = getTestData('file://./tests/literal_with_CHARACTER_TABULATION.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with dquote \"x\"y\"', async () => {
        const data = getTestData('file://./tests/literal_with_dquote.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with FORM FEED', async () => {
        const data = getTestData('file://./tests/literal_with_FORM_FEED.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with LINE FEED', async () => {
        const data = getTestData('file://./tests/literal_with_LINE_FEED.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with numeric escape4 \\u', async () => {
        const data = getTestData('file://./tests/literal_with_numeric_escape4.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with numeric escape8 \\U', async () => {
        const data = getTestData('file://./tests/literal_with_numeric_escape8.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with REVERSE SOLIDUS', async () => {
        const data = getTestData('file://./tests/literal_with_REVERSE_SOLIDUS.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal with squote \"x\'y\"', async () => {
        const data = getTestData('file://./tests/literal_with_squote.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal_all_controls \'\\x00\\x01\\x02\\x03\\x04...\'', async () => {
        const data = getTestData('file://./tests/literal_all_controls.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ literal_all_punctuation \'!\"#$%&()...\'', async () => {
        const data = getTestData('file://./tests/literal_all_punctuation.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    // Note: Disabled because it is hard to add support for non-ascii characters in Tree-Sitter and the test is only a proposal.
    // it('+ literal_ascii_boundaries \'\\x00\\x26\\x28...\'', async () => {
    //     const data = getTestData('file://./tests/literal_ascii_boundaries.nt');
    //     expect(await matchQuads(data)).toBe(true);
    // });

    it('+ literal_with_UTF8_boundaries \'\\x80\\x7ff\\x800\\xfff...\'', async () => {
        const data = getTestData('file://./tests/literal_with_UTF8_boundaries.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ One comment, one empty line', async () => {
        const data = getTestData('file://./tests/nt-syntax-file-03.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ Only comment', async () => {
        const data = getTestData('file://./tests/nt-syntax-file-02.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ Only IRIs', async () => {
        const data = getTestData('file://./tests/nt-syntax-uri-01.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ REVERSE SOLIDUS at end of literal', async () => {
        const data = getTestData('file://./tests/literal_with_REVERSE_SOLIDUS2.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ string literal', async () => {
        const data = getTestData('file://./tests/nt-syntax-string-01.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ string literal with escaped newline', async () => {
        const data = getTestData('file://./tests/nt-syntax-str-esc-01.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ string literal with long Unicode escape', async () => {
        const data = getTestData('file://./tests/nt-syntax-str-esc-03.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ string literal with Unicode escape', async () => {
        const data = getTestData('file://./tests/nt-syntax-str-esc-02.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ Submission test from Original RDF Test Cases', async () => {
        const data = getTestData('file://./tests/nt-syntax-subm-01.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ tests absense of whitespace between subject, predicate, object and end-of-statement', async () => {
        const data = getTestData('file://./tests/minimal_whitespace.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ Tests comments after a triple', async () => {
        const data = getTestData('file://./tests/comment_following_triple.nt');
        expect(await matchQuads(data)).toBe(true);
    });

    it('+ xsd:byte literal', async () => {
        const data = getTestData('file://./tests/nt-syntax-datatypes-01.nt');
        expect(await matchQuads(data)).toBe(true);
    });
});