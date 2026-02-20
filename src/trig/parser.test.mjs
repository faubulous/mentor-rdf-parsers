import * as fs from 'fs';
import { TrigLexer, TrigParser } from './parser.mjs';

/**
 * TriG Parser Tests
 *
 * Test datasets:
 *
 * The .trig fixture files in the `tests/` directory are derived from the
 * official W3C RDF Test Suite for TriG, distributed under the W3C Test
 * Suite License and the W3C 3-clause BSD License.
 *
 * Source manifest: tests/manifest.ttl
 * Upstream: https://w3c.github.io/rdf-tests/rdf/rdf11/rdf-trig/
 *
 * See src/util/README.md for details on the test generation process.
 */
describe("TrigDocument", () => {
    const getTestData = (fileUrl) => {
        const relativePath = fileUrl.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const parse = (text) => {
        const lexResult = new TrigLexer().tokenize(text);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const parser = new TrigParser();
        parser.input = lexResult.tokens;

        const cst = parser.trigDoc();

        if (parser.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(parser.errors));
        }

        return {
            cst: cst,
            lexResult: lexResult
        };
    }

    it('- {} fomulae not in TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-01.trig'))).toThrowError();
    });

    it('- @base in wrong case (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-base-02.trig'))).toThrowError();
    });

    it('- @base inside graph (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-base-04.trig'))).toThrowError();
    });

    it('- @base without URI (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-base-01.trig'))).toThrowError();
    });

    it('- @forAll is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-12.trig'))).toThrowError();
    });

    it('- @forSome is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-11.trig'))).toThrowError();
    });

    it('- @graph is not a keyword', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-08.trig'))).toThrowError();
    });

    it('- @keywords is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-07.trig'))).toThrowError();
    });

    it('- @keywords is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-08.trig'))).toThrowError();
    });

    it('- @keywords is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-13.trig'))).toThrowError();
    });

    it('- @prefix inside graph (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-prefix-06.trig'))).toThrowError();
    });

    it('- @prefix without \':\' (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-prefix-05.trig'))).toThrowError();
    });

    it('- @prefix without prefix name (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-prefix-04.trig'))).toThrowError();
    });

    it('- @prefix without URI (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-prefix-03.trig'))).toThrowError();
    });

    it('- \'~\' must be escaped in pname (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-pname-01.trig'))).toThrowError();
    });

    it('- \'a\' cannot be used as object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-kw-03.trig'))).toThrowError();
    });

    it('- \'a\' cannot be used as subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-kw-02.trig'))).toThrowError();
    });

    it('- \'A\' is not a keyword (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-kw-01.trig'))).toThrowError();
    });

    it('- \'true\' cannot be used as object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-kw-05.trig'))).toThrowError();
    });

    it('- \'true\' cannot be used as subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-kw-04.trig'))).toThrowError();
    });

    it('- <= is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-10.trig'))).toThrowError();
    });

    it('- = is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-02.trig'))).toThrowError();
    });

    it('- => is not TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-09.trig'))).toThrowError();
    });

    it('- A graph may not be named with a blankNodePropertyList', () => {
        expect(() => parse(getTestData('file://./tests/trig-bnodeplist-graph-bad-01.trig'))).toThrowError();
    });

    it('- A graph may not be named with a collection', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-11.trig'))).toThrowError();
    });

    it('- A graph may not be named with a collection', () => {
        expect(() => parse(getTestData('file://./tests/trig-collection-graph-bad-02.trig'))).toThrowError();
    });

    it('- A graph may not be named with an empty collection', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-10.trig'))).toThrowError();
    });

    it('- A graph may not be named with an empty collection', () => {
        expect(() => parse(getTestData('file://./tests/trig-collection-graph-bad-01.trig'))).toThrowError();
    });

    it('- Bad %-sequence in pname (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-pname-02.trig'))).toThrowError();
    });

    it('- Bad hex escape at start of local name', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-ln-escape-start.trig'))).toThrowError();
    });

    it('- Bad hex escape in local name', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-ln-escape.trig'))).toThrowError();
    });

    it('- Bad IRI : bad escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-uri-02.trig'))).toThrowError();
    });

    it('- Bad IRI : bad long escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-uri-03.trig'))).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (2) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-uri-05.trig'))).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-uri-04.trig'))).toThrowError();
    });

    it('- Bad IRI : space (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-uri-01.trig'))).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-num-05.trig'))).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-num-01.trig'))).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-num-02.trig'))).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-num-03.trig'))).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-num-04.trig'))).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-num-05.trig'))).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-esc-01.trig'))).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-esc-02.trig'))).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-esc-03.trig'))).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-esc-04.trig'))).toThrowError();
    });

    it('- Bad unicode escape in pname (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-pname-03.trig'))).toThrowError();
    });

    it('- BASE inside graph (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-base-05.trig'))).toThrowError();
    });

    it('- BASE without URI (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-base-03.trig'))).toThrowError();
    });

    it('- Blank node label must not end in dot', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-blank-label-dot-end.trig'))).toThrowError();
    });

    it('- bnode as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-16.trig'))).toThrowError();
    });

    it('- Directives not allowed inside GRAPH', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-09.trig'))).toThrowError();
    });

    it('- Dot delimeter may not appear in anonymous nodes', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-number-dot-in-anon.trig'))).toThrowError();
    });

    it('- extra \'.\' (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-09.trig'))).toThrowError();
    });

    it('- extra \'.\' (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-10.trig'))).toThrowError();
    });

    it('- Free-standing list inside {} : bad syntax', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-list-03.trig'))).toThrowError();
    });

    it('- Free-standing list of zero elements : bad syntax', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-list-04.trig'))).toThrowError();
    });

    it('- Free-standing list of zero-elements outside {} : bad syntax', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-list-02.trig'))).toThrowError();
    });

    it('- Free-standing list outside {} : bad syntax', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-list-01.trig'))).toThrowError();
    });

    it('- GRAPH - Must close {}', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-06.trig'))).toThrowError();
    });

    it('- GRAPH and a name, not several', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-05.trig'))).toThrowError();
    });

    it('- GRAPH but no name - GRAPH is not used with the default graph', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-01.trig'))).toThrowError();
    });

    it('- GRAPH may not include a GRAPH', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-07.trig'))).toThrowError();
    });

    it('- GRAPH needs {}', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-03.trig'))).toThrowError();
    });

    it('- GRAPH needs {}', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-04.trig'))).toThrowError();
    });

    it('- GRAPH not followed by DOT', () => {
        expect(() => parse(getTestData('file://./tests/trig-graph-bad-02.trig'))).toThrowError();
    });

    it('- labeled bnode as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-17.trig'))).toThrowError();
    });

    it('- langString with bad lang (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-lang-01.trig'))).toThrowError();
    });

    it('- literal as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-15.trig'))).toThrowError();
    });

    it('- literal as subject (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-14.trig'))).toThrowError();
    });

    it('- Local name must not begin with dash', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-ln-dash-start.trig'))).toThrowError();
    });

    it('- Long literal with extra quote (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-string-06.trig'))).toThrowError();
    });

    it('- Long literal with extra squote (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-string-07.trig'))).toThrowError();
    });

    it('- Long literal with missing end (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-string-05.trig'))).toThrowError();
    });

    it('- mismatching long string literal open/close (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-string-04.trig'))).toThrowError();
    });

    it('- mismatching string literal long/short (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-string-03.trig'))).toThrowError();
    });

    it('- mismatching string literal open/close (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-string-01.trig'))).toThrowError();
    });

    it('- mismatching string literal open/close (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-string-02.trig'))).toThrowError();
    });

    it('- N3 is...of not in TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-05.trig'))).toThrowError();
    });

    it('- N3 paths not in TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-03.trig'))).toThrowError();
    });

    it('- N3 paths not in TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-04.trig'))).toThrowError();
    });

    it('- N3 paths not in TriG (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-n3-extras-06.trig'))).toThrowError();
    });

    it('- No prefix (2) (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-prefix-02.trig'))).toThrowError();
    });

    it('- No prefix (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-prefix-01.trig'))).toThrowError();
    });

    it('- PREFIX inside graph (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-prefix-07.trig'))).toThrowError();
    });

    it('- Prefix must not end in dot', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-ns-dot-end.trig'))).toThrowError();
    });

    it('- Prefix must not end in dot (error in triple, not prefix directive like trig-syntax-bad-ns-dot-end)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-missing-ns-dot-end.trig'))).toThrowError();
    });

    it('- Prefix must not start with dot', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-ns-dot-start.trig'))).toThrowError();
    });

    it('- Prefix must not start with dot (error in triple, not prefix directive like trig-syntax-bad-ns-dot-end)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-missing-ns-dot-start.trig'))).toThrowError();
    });

    it('- subject, predicate, no object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-12.trig'))).toThrowError();
    });

    it('- subject, predicate, no object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-13.trig'))).toThrowError();
    });

    it('- Trailing dot required in Turtle block', () => {
        expect(() => parse(getTestData('file://./tests/trig-turtle-bad-01.trig'))).toThrowError();
    });

    it('- TriG is not N-Quads', () => {
        expect(() => parse(getTestData('file://./tests/trig-turtle-bad-02.trig'))).toThrowError();
    });

    it('- Turtle does not allow bnodes-as-predicates (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-06.trig'))).toThrowError();
    });

    it('- Turtle does not allow labeled bnodes-as-predicates (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-07.trig'))).toThrowError();
    });

    it('- Turtle does not allow literals-as-predicates (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-05.trig'))).toThrowError();
    });

    it('- Turtle does not allow literals-as-subjects (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-04.trig'))).toThrowError();
    });

    it('- Turtle is not N3 (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-02.trig'))).toThrowError();
    });

    it('- Turtle is not NQuads (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/trig-syntax-bad-struct-03.trig'))).toThrowError();
    });

    it('+ ', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ ', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-06.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ @base', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-base-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ @base with relative IRIs', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-base-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ @prefix', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ @prefix with no suffix', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ \'a\' as keyword', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-kw-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bare bnode property list', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-08.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BASE', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-base-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ base with relative IRIs', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-base-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode object', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-09.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list object', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list object (2)', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list subject', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode subject', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ boolean literal (false)', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-kw-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ boolean literal (true)', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-kw-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Characters allowed in blank node labels', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-blank-label.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ colon is a legal pname character', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-06.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Colons in pname local names', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-ln-colons.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ dash is a legal pname character', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-07.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ decimal literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ decimal literal (no leading digits)', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Dots in namespace names', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-ns-dots.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Dots in pname local names', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-ln-dots.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ double literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-09.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ double literal no fraction', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-11.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty @prefix with % escape', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty file', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-file-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ empty list', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-lists-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty PREFIX', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer as xsd:string', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-datatypes-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer literal with decimal lexical confusion', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-08.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with long Unicode escape', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-uri-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with Unicode escape', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-uri-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ isomorphic list as subject and object', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-lists-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ labeled bnode subject', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-06.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ labeled bnode subject and object', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-07.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal with region', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Legal IRIs', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-uri-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ lists of lists', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-lists-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ long langString literal with embedded newline', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-10.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ long string literal with embedded newline', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-08.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ long string literal with embedded single- and double-quotes', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-07.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ missing \'.\'', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-struct-06.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ mixed bnode property list and triple', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-bnode-10.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ mixed list', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-lists-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ mixed lists with embedded lists', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-lists-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Named graph may be empty', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Named graph may be named with BNode _:a', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-07.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Named graph may be named with BNode []', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-08.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Named graph may be named with PNAME', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-09.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Named graph with PNAME and empty graph', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-10.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Named graphs can be proceeded by GRAPH', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ negative decimal literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-06.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ negative double literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-10.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ negative integer literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ object list', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-struct-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ One comment, one empty line', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-file-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only comment', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-file-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only IRIs', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-uri-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ percents in pnames', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-09.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ pname with back-slash escapes', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-pname-esc-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ pname with back-slash escapes (2)', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-pname-esc-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ pname with back-slash escapes (3)', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-pname-esc-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ positive decimal literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-07.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ positive integer literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-number-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with multiple ;;', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-struct-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with multiple ;;', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-struct-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with object list', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-struct-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with object list and dangling \';\'', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-struct-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ PreFIX', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote langString literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote langString literal with region', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-06.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote long langString literal with embedded newline', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-11.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote long string literal with embedded single- and double-quotes', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-09.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote string literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-string-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with escaped newline', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-str-esc-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with long Unicode escape', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-str-esc-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with Unicode escape', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-str-esc-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ tests absense of whitespace in various positions', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-minimal-whitespace-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Trailing . not necessary inside {}', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ trailing \';\' no \'.\'', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-struct-07.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ TriG can parse Turtle', () => {
        const result = parse(getTestData('file://./tests/trig-turtle-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ TriG can parse Turtle (bare blankNodePropertyList)', () => {
        const result = parse(getTestData('file://./tests/trig-turtle-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ TriG can parse Turtle (blankNodePropertyList subject)', () => {
        const result = parse(getTestData('file://./tests/trig-turtle-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ TriG can parse Turtle (blankNodePropertyList subject)', () => {
        const result = parse(getTestData('file://./tests/trig-turtle-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ TriG can parse Turtle (collection subject and object)', () => {
        const result = parse(getTestData('file://./tests/trig-turtle-06.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ TriG can parse Turtle (repeated PREFIX)', () => {
        const result = parse(getTestData('file://./tests/trig-turtle-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ underscore is a legal pname character', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-prefix-08.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Use of empty prefix inside named graph', () => {
        const result = parse(getTestData('file://./tests/trig-kw-graph-05.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ xsd:byte literal', () => {
        const result = parse(getTestData('file://./tests/trig-syntax-datatypes-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // =====================================================
    // RDF 1.2 Tests
    // =====================================================

    // Positive syntax tests

    it('+ RDF 1.2: subject reified triple', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-basic-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: object reified triple', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-basic-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: triple term object', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-basic-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple outside triple', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-basic-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple inside blankNodePropertyList', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-inside-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple inside collection', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-inside-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple with IRI identifier', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-inside-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple with blank node identifier', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-inside-04.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: nested quoted triple, subject position', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-nested-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: nested quoted triple, object position', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-nested-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: compound forms', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-compound.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: blank node subject', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-bnode-01.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: blank node object', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-bnode-02.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: blank node', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-syntax-bnode-03.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: annotation form', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-1.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: annotation example', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-2.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: annotation predicateObjectList', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-3.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: annotation followed by predicate/object', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-4.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reifier without annotation block', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-5.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: empty reifier without annotation block', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-6.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reifier with annotation block', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-7.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: empty reifier with annotation block', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-annotation-8.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: base direction ltr', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-base-1.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: base direction rtl', () => {
        const result = parse(getTestData('file://./tests/rdf12/trig12-base-2.trig'));
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // Negative syntax tests

    it('- RDF 1.2: reified triple as predicate (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-01.trig'))).toThrowError();
    });

    it('- RDF 1.2: literal in subject position of reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-02.trig'))).toThrowError();
    });

    it('- RDF 1.2: blank node as predicate in reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-03.trig'))).toThrowError();
    });

    it('- RDF 1.2: incomplete reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-04.trig'))).toThrowError();
    });

    it('- RDF 1.2: over-long reified triple (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-05.trig'))).toThrowError();
    });

    it('- RDF 1.2: reified with list object (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-06.trig'))).toThrowError();
    });

    it('- RDF 1.2: compound blank node expression (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-07.trig'))).toThrowError();
    });

    it('- RDF 1.2: empty annotation (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-ann-1.trig'))).toThrowError();
    });

    it('- RDF 1.2: triple as annotation (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-syntax-bad-ann-2.trig'))).toThrowError();
    });

    it('- RDF 1.2: undefined base direction (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-base-bad-1.trig'))).toThrowError();
    });

    it('- RDF 1.2: upper case LTR (negative test)', () => {
        expect(() => parse(getTestData('file://./tests/rdf12/trig12-base-bad-2.trig'))).toThrowError();
    });
});