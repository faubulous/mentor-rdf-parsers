import * as fs from 'fs';
import { TurtleLexer, TurtleParser } from './parser.js';

/**
 * Turtle Parser Tests
 *
 * Test datasets:
 *
 * The .ttl fixture files in the `tests/` directory are derived from the
 * official W3C RDF Test Suite for Turtle, distributed under the W3C Test
 * Suite License and the W3C 3-clause BSD License.
 *
 * Source manifest: tests/manifest.ttl
 * Upstream: https://w3c.github.io/rdf-tests/
 *
 * The fixture files were generated from the manifest using:
 *   node src/util/generate-tests.js \
 *     --manifest src/tree-sitter-turtle/tests/manifest.ttl \
 *     -p TestTurtlePositiveSyntax \
 *     -n TestTurtleNegativeSyntax \
 *     -e .ttl
 *
 * See src/util/README.md for details on the test generation process.
 */
describe("TurtleDocument", () => {
    const getTestData = (fileUrl: string) => {
        const relativePath = fileUrl.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const parse = (fileIri: string, text?: string) => {
        const data = fileIri ? getTestData(fileIri) : text;

        const lexResult = new TurtleLexer().tokenize(data);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const parser = new TurtleParser();
        parser.input = lexResult.tokens;

        const cst = parser.turtleDoc();

        if (parser.errors.length > 0) {
            throw new Error('Parsing errors detected:\n' + JSON.stringify(parser.errors));
        }

        return {
            cst: cst,
            lexResult: lexResult
        };
    }

    it('- {} fomulae not in Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-01.ttl')).toThrowError();
    });

    it('- @base in wrong case (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-base-02.ttl')).toThrowError();
    });

    it('- @base without URI (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-base-01.ttl')).toThrowError();
    });

    it('- @forAll is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-12.ttl')).toThrowError();
    });

    it('- @forSome is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-11.ttl')).toThrowError();
    });

    it('- @keywords is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-07.ttl')).toThrowError();
    });

    it('- @keywords is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-08.ttl')).toThrowError();
    });

    it('- @keywords is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-13.ttl')).toThrowError();
    });

    it('- @prefix without \':\' (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-prefix-05.ttl')).toThrowError();
    });

    it('- @prefix without prefix name (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-prefix-04.ttl')).toThrowError();
    });

    it('- @prefix without URI (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-prefix-03.ttl')).toThrowError();
    });

    it('- \'~\' must be escaped in pname (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-pname-01.ttl')).toThrowError();
    });

    it('- \'a\' cannot be used as object (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-kw-03.ttl')).toThrowError();
    });

    it('- \'a\' cannot be used as subject (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-kw-02.ttl')).toThrowError();
    });

    it('- \'A\' is not a keyword (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-kw-01.ttl')).toThrowError();
    });

    it('- \'true\' cannot be used as object (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-kw-05.ttl')).toThrowError();
    });

    it('- \'true\' cannot be used as subject (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-kw-04.ttl')).toThrowError();
    });

    it('- <= is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-10.ttl')).toThrowError();
    });

    it('- = is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-02.ttl')).toThrowError();
    });

    it('- => is not Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-09.ttl')).toThrowError();
    });

    it('- Bad %-sequence in pname (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-pname-02.ttl')).toThrowError();
    });

    it('- Bad hex escape at start of local name', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-ln-escape-start.ttl')).toThrowError();

    });

    it('- Bad hex escape in local name', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-ln-escape.ttl')).toThrowError();
    });

    it('- Bad IRI : bad escape (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-uri-02.ttl')).toThrowError();
    });

    it('- Bad IRI : bad long escape (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-uri-03.ttl')).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (2) (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-uri-05.ttl')).toThrowError();
    });

    it('- Bad IRI : character escapes not allowed (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-uri-04.ttl')).toThrowError();
    });

    it('- Bad IRI : space (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-uri-01.ttl')).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-num-05.ttl')).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-num-01.ttl')).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-num-02.ttl')).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-num-03.ttl')).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-num-04.ttl')).toThrowError();
    });

    it('- Bad number format (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-num-05.ttl')).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-esc-01.ttl')).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-esc-02.ttl')).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-esc-03.ttl')).toThrowError();
    });

    it('- Bad string escape (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-esc-04.ttl')).toThrowError();
    });

    it('- Bad unicode escape in pname (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-pname-03.ttl')).toThrowError();
    });

    it('- BASE without URI (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-base-03.ttl')).toThrowError();
    });

    it('- Blank node label must not end in dot', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-blank-label-dot-end.ttl')).toThrowError();
    });

    it('- bnode as predicate (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-16.ttl')).toThrowError();
    });

    it('- Dot delimeter may not appear in anonymous nodes', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-number-dot-in-anon.ttl')).toThrowError();
    });

    it('- extra \'.\' (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-09.ttl')).toThrowError();
    });

    it('- extra \'.\' (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-10.ttl')).toThrowError();
    });

    it('- labeled bnode as predicate (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-17.ttl')).toThrowError();
    });

    it('- langString with bad lang (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-lang-01.ttl')).toThrowError();
    });

    it('- literal as predicate (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-15.ttl')).toThrowError();
    });

    it('- literal as subject (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-14.ttl')).toThrowError();
    });

    it('- Local name must not begin with dash', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-ln-dash-start.ttl')).toThrowError();
    });

    it('- Long literal with extra quote (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-string-06.ttl')).toThrowError();
    });

    it('- Long literal with extra squote (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-string-07.ttl')).toThrowError();
    });

    it('- Long literal with missing end (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-string-05.ttl')).toThrowError();
    });

    it('- mismatching long string literal open/close (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-string-04.ttl')).toThrowError();
    });

    it('- mismatching string literal long/short (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-string-03.ttl')).toThrowError();
    });

    it('- mismatching string literal open/close (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-string-01.ttl')).toThrowError();
    });

    it('- mismatching string literal open/close (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-string-02.ttl')).toThrowError();
    });

    it('- missing \'.\' (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-08.ttl')).toThrowError();
    });

    it('- N3 is...of not in Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-05.ttl')).toThrowError();
    });

    it('- N3 paths not in Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-03.ttl')).toThrowError();
    });

    it('- N3 paths not in Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-04.ttl')).toThrowError();
    });

    it('- N3 paths not in Turtle (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-n3-extras-06.ttl')).toThrowError();
    });

    it('- No prefix (2) (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-prefix-02.ttl')).toThrowError();
    });

    it('- No prefix (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-prefix-01.ttl')).toThrowError();
    });

    it('- Prefix must not end in dot', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-ns-dot-end.ttl')).toThrowError();
    });

    it('- Prefix must not end in dot (error in triple, not prefix directive like turtle-syntax-bad-ns-dot-end)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-missing-ns-dot-end.ttl')).toThrowError();
    });

    it('- Prefix must not start with dot', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-ns-dot-start.ttl')).toThrowError();
    });

    it('- Prefix must not start with dot (error in triple, not prefix directive like turtle-syntax-bad-ns-dot-end)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-missing-ns-dot-start.ttl')).toThrowError();
    });

    it('- subject, predicate, no object (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-12.ttl')).toThrowError();
    });

    it('- subject, predicate, no object (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-13.ttl')).toThrowError();
    });

    it('- trailing \';\' no \'.\' (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-11.ttl')).toThrowError();
    });

    it('- Turtle does not allow bnodes-as-predicates (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-06.ttl')).toThrowError();
    });

    it('- Turtle does not allow labeled bnodes-as-predicates (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-07.ttl')).toThrowError();
    });

    it('- Turtle does not allow literals-as-predicates (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-05.ttl')).toThrowError();
    });

    it('- Turtle does not allow literals-as-subjects (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-04.ttl')).toThrowError();
    });

    it('- Turtle is not N3 (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-02.ttl')).toThrowError();
    });

    it('- Turtle is not NQuads (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-03.ttl')).toThrowError();
    });

    it('- Turtle is not TriG (negative test)', () => {
        expect(() => parse('file://./tests/turtle-syntax-bad-struct-01.ttl')).toThrowError();
    });

    it('+ @base', () => {
        const result = parse('file://./tests/turtle-syntax-base-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ @base with relative IRIs', () => {
        const result = parse('file://./tests/turtle-syntax-base-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ @prefix', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ @prefix with no suffix', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ \'a\' as keyword', () => {
        const result = parse('file://./tests/turtle-syntax-kw-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bare bnode property list', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-08.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ BASE', () => {
        const result = parse('file://./tests/turtle-syntax-base-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ base with relative IRIs', () => {
        const result = parse('file://./tests/turtle-syntax-base-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode object', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-09.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list object', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list object (2)', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode property list subject', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ bnode subject', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ boolean literal (false)', () => {
        const result = parse('file://./tests/turtle-syntax-kw-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ boolean literal (true)', () => {
        const result = parse('file://./tests/turtle-syntax-kw-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Characters allowed in blank node labels', () => {
        const result = parse('file://./tests/turtle-syntax-blank-label.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ colon is a legal pname character', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-06.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Colons in pname local names', () => {
        const result = parse('file://./tests/turtle-syntax-ln-colons.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ dash is a legal pname character', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-07.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ decimal literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ decimal literal (no leading digits)', () => {
        const result = parse('file://./tests/turtle-syntax-number-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Dots in namespace names', () => {
        const result = parse('file://./tests/turtle-syntax-ns-dots.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Dots in pname local names', () => {
        const result = parse('file://./tests/turtle-syntax-ln-dots.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ double literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-09.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ double literal no fraction', () => {
        const result = parse('file://./tests/turtle-syntax-number-11.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty @prefix with % escape', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty file', () => {
        const result = parse('file://./tests/turtle-syntax-file-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ empty list', () => {
        const result = parse('file://./tests/turtle-syntax-lists-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Empty PREFIX', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer as xsd:string', () => {
        const result = parse('file://./tests/turtle-syntax-datatypes-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ integer literal with decimal lexical confusion', () => {
        const result = parse('file://./tests/turtle-syntax-number-08.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with long Unicode escape', () => {
        const result = parse('file://./tests/turtle-syntax-uri-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ IRIs with Unicode escape', () => {
        const result = parse('file://./tests/turtle-syntax-uri-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ isomorphic list as subject and object', () => {
        const result = parse('file://./tests/turtle-syntax-lists-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ labeled bnode subject', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-06.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ labeled bnode subject and object', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-07.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal', () => {
        const result = parse('file://./tests/turtle-syntax-string-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ langString literal with region', () => {
        const result = parse('file://./tests/turtle-syntax-string-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Legal IRIs', () => {
        const result = parse('file://./tests/turtle-syntax-uri-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ lists of lists', () => {
        const result = parse('file://./tests/turtle-syntax-lists-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ long langString literal with embedded newline', () => {
        const result = parse('file://./tests/turtle-syntax-string-10.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ long string literal with embedded newline', () => {
        const result = parse('file://./tests/turtle-syntax-string-08.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ long string literal with embedded single- and double-quotes', () => {
        const result = parse('file://./tests/turtle-syntax-string-07.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ mixed bnode property list and triple', () => {
        const result = parse('file://./tests/turtle-syntax-bnode-10.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ mixed list', () => {
        const result = parse('file://./tests/turtle-syntax-lists-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ mixed lists with embedded lists', () => {
        const result = parse('file://./tests/turtle-syntax-lists-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ negative decimal literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-06.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ negative double literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-10.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ negative integer literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ object list', () => {
        const result = parse('file://./tests/turtle-syntax-struct-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ One comment, one empty line', () => {
        const result = parse('file://./tests/turtle-syntax-file-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only comment', () => {
        const result = parse('file://./tests/turtle-syntax-file-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ Only IRIs', () => {
        const result = parse('file://./tests/turtle-syntax-uri-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ percents in pnames', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-09.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ pname with back-slash escapes', () => {
        const result = parse('file://./tests/turtle-syntax-pname-esc-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ pname with back-slash escapes (2)', () => {
        const result = parse('file://./tests/turtle-syntax-pname-esc-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });


    it('+ pname with back-slash escapes (3)', () => {
        const result = parse('file://./tests/turtle-syntax-pname-esc-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ positive decimal literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-07.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ positive integer literal', () => {
        const result = parse('file://./tests/turtle-syntax-number-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with multiple ;;', () => {
        const result = parse('file://./tests/turtle-syntax-struct-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with multiple ;;', () => {
        const result = parse('file://./tests/turtle-syntax-struct-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with object list', () => {
        const result = parse('file://./tests/turtle-syntax-struct-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ predicate list with object list and dangling \';\'', () => {
        const result = parse('file://./tests/turtle-syntax-struct-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ PreFIX', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote langString literal', () => {
        const result = parse('file://./tests/turtle-syntax-string-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote langString literal with region', () => {
        const result = parse('file://./tests/turtle-syntax-string-06.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote long langString literal with embedded newline', () => {
        const result = parse('file://./tests/turtle-syntax-string-11.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote long string literal with embedded single- and double-quotes', () => {
        const result = parse('file://./tests/turtle-syntax-string-09.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ squote string literal', () => {
        const result = parse('file://./tests/turtle-syntax-string-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal', () => {
        const result = parse('file://./tests/turtle-syntax-string-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with escaped newline', () => {
        const result = parse('file://./tests/turtle-syntax-str-esc-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with long Unicode escape', () => {
        const result = parse('file://./tests/turtle-syntax-str-esc-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ string literal with Unicode escape', () => {
        const result = parse('file://./tests/turtle-syntax-str-esc-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ underscore is a legal pname character', () => {
        const result = parse('file://./tests/turtle-syntax-prefix-08.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ xsd:byte literal', () => {
        const result = parse('file://./tests/turtle-syntax-datatypes-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // RDF 1.2 Syntax Tests: Reified Triples
    it('+ RDF 1.2: subject reified triple', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: object reified triple', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: object triple term', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple outside triple', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple with literal object', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple with keyword object', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-06.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: triple term with literal object', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-07.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: triple term with keyword object', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-basic-08.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // RDF 1.2: Reified triples inside other constructs
    it('+ RDF 1.2: reified triple inside blankNodePropertyList', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-inside-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple inside collection', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-inside-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple with IRI reifier', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-inside-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reified triple with blank node reifier', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-inside-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // RDF 1.2: Nested reified triples
    it('+ RDF 1.2: nested reified triple in subject', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-nested-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: nested reified triple in object', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-nested-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: compound reified triples', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-compound.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // RDF 1.2: Blank nodes in reified triples
    it('+ RDF 1.2: blank node subject in reified triple', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-bnode-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: blank node object in reified triple', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-bnode-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: ANON in reified triple', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-syntax-bnode-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // RDF 1.2: Bad syntax
    it('- RDF 1.2: reified triple as predicate (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-01.ttl')).toThrowError();
    });

    it('- RDF 1.2: literal in subject of reified triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-02.ttl')).toThrowError();
    });

    it('- RDF 1.2: ANON as predicate in reified triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-03.ttl')).toThrowError();
    });

    it('- RDF 1.2: incomplete reified triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-04.ttl')).toThrowError();
    });

    it('- RDF 1.2: over-long reified triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-05.ttl')).toThrowError();
    });

    it('- RDF 1.2: reified triple with list object (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-06.ttl')).toThrowError();
    });

    it('- RDF 1.2: compound blank node expression (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-07.ttl')).toThrowError();
    });

    // RDF 1.2: Annotation syntax
    it('+ RDF 1.2: annotation form', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-1.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: annotation example', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-2.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: annotation predicateObjectList', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-3.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: annotation followed by predicate', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-4.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reifier without annotation block', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-5.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: empty reifier without annotation block', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-6.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: reifier with annotation block', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-7.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: empty reifier with annotation block', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-annotation-8.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // RDF 1.2: Bad annotation syntax
    it('- RDF 1.2: empty annotation (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-ann-1.ttl')).toThrowError();
    });

    it('- RDF 1.2: triple as annotation (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-syntax-bad-ann-2.ttl')).toThrowError();
    });

    // RDF 1.2: N-Triples in Turtle syntax
    it('+ RDF 1.2: N-Triples triple term', () => {
        const result = parse('file://./tests/rdf12/syntax/nt-ttl12-syntax-1.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: N-Triples triple term (compact)', () => {
        const result = parse('file://./tests/rdf12/syntax/nt-ttl12-syntax-2.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: N-Triples nested triple term', () => {
        const result = parse('file://./tests/rdf12/syntax/nt-ttl12-syntax-3.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: N-Triples blank node in triple term', () => {
        const result = parse('file://./tests/rdf12/syntax/nt-ttl12-bnode-1.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: N-Triples nested triple term (expanded)', () => {
        const result = parse('file://./tests/rdf12/syntax/nt-ttl12-nested-1.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    // RDF 1.2: Language direction
    it('+ RDF 1.2: base direction ltr', () => {
        const result = parse('file://./tests/rdf12/syntax/nt-ttl12-langdir-1.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: base direction rtl', () => {
        const result = parse('file://./tests/rdf12/syntax/nt-ttl12-langdir-2.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('- RDF 1.2: undefined base direction (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-langdir-bad-1.ttl')).toThrowError();
    });

    it('- RDF 1.2: upper case LTR (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-langdir-bad-2.ttl')).toThrowError();
    });

    // RDF 1.2: N-Triples bad syntax
    it('- RDF 1.2: triple term as subject (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-10.ttl')).toThrowError();
    });

    it('- RDF 1.2: triple term as predicate (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-01.ttl')).toThrowError();
    });

    it('- RDF 1.2: literal as subject in triple term (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-02.ttl')).toThrowError();
    });

    it('- RDF 1.2: literal as predicate in triple term (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-03.ttl')).toThrowError();
    });

    it('- RDF 1.2: reified triple instead of triple term (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-04.ttl')).toThrowError();
    });

    it('- RDF 1.2: triple term as subject of triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-05.ttl')).toThrowError();
    });

    it('- RDF 1.2: triple term as predicate of triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-06.ttl')).toThrowError();
    });

    it('- RDF 1.2: reified triple as subject of N-Triples (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-07.ttl')).toThrowError();
    });

    it('- RDF 1.2: literal as predicate in reified triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-08.ttl')).toThrowError();
    });

    it('- RDF 1.2: blank node as predicate in reified triple (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/nt-ttl12-bad-syntax-09.ttl')).toThrowError();
    });

    // RDF 1.2: VERSION directive
    it('+ RDF 1.2: VERSION directive', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-01.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: @version directive', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-02.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: VERSION in middle of document', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-03.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: @version in middle of document', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-04.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: VERSION with variant string', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-05.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: @version with variant string', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-06.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: mixed version directives', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-07.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('+ RDF 1.2: multiple version directives', () => {
        const result = parse('file://./tests/rdf12/syntax/turtle12-version-08.ttl');
        expect(result.lexResult.errors.length).toEqual(0);
    });

    it('- RDF 1.2: VERSION not a string (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-version-bad-01.ttl')).toThrowError();
    });

    it('- RDF 1.2: VERSION triple-quoted string (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-version-bad-02.ttl')).toThrowError();
    });

    it('- RDF 1.2: VERSION triple-quoted single string (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-version-bad-03.ttl')).toThrowError();
    });

    it('- RDF 1.2: @version not a string (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-version-bad-04.ttl')).toThrowError();
    });

    it('- RDF 1.2: @version triple-quoted string (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-version-bad-05.ttl')).toThrowError();
    });

    it('- RDF 1.2: @version triple-quoted single string (negative test)', () => {
        expect(() => parse('file://./tests/rdf12/syntax/turtle12-version-bad-06.ttl')).toThrowError();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Undefined Prefix Error Tests
    // ─────────────────────────────────────────────────────────────────────────

    it('- undefined prefix in subject (negative test)', () => {
        expect(() => parse(null, 'undefined:subject <http://example.org/p> <http://example.org/o> .'))
            .toThrowError('Undefined prefix: undefined');
    });

    it('- undefined prefix in predicate (negative test)', () => {
        expect(() => parse(null, '<http://example.org/s> undefined:predicate <http://example.org/o> .'))
            .toThrowError('Undefined prefix: undefined');
    });

    it('- undefined prefix in object (negative test)', () => {
        expect(() => parse(null, '<http://example.org/s> <http://example.org/p> undefined:object .'))
            .toThrowError('Undefined prefix: undefined');
    });

    it('- undefined prefix error has correct properties', () => {
        try {
            parse(null, 'foo:bar <http://example.org/p> <http://example.org/o> .');
            throw new Error('Expected error to be thrown');
        } catch (e: any) {
            expect(e.name).toBe('UndefinedPrefixError');
            expect(e.message).toBe('Undefined prefix: foo');
            expect(e.token).toBeDefined();
            expect(e.token.image).toBe('foo:bar');
        }
    });

    it('+ defined prefix should not throw', () => {
        expect(() => parse(null, '@prefix ex: <http://example.org/> .\nex:subject ex:predicate ex:object .'))
            .not.toThrow();
    });
});