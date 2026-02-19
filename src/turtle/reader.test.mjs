import * as fs from 'fs';
import { parseQuads, quadsMatch } from '../helpers.mjs';
import { TurtleLexer, TurtleParser } from './parser.mjs';
import { TurtleReader } from './reader.mjs';

describe("TurtleReader", () => {
    const getTestData = (fileIri) => {
        const relativePath = fileIri.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const matchQuads = async (fileIri, text) => {
        const baseIri = fileIri;
        const data = fileIri ? getTestData(fileIri) : text;

        const lexResult = new TurtleLexer().tokenize(data);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const expected = await parseQuads(data);

        const cst = new TurtleParser().parse(baseIri, lexResult.tokens);
        const actual = new TurtleReader().visit(cst);

        return quadsMatch(actual, expected);
    }

    it('+ @base', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-base-01.ttl')).toBe(true);
    });

    it('+ @base with relative IRIs', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-base-03.ttl')).toBe(true);
    });

    it('+ @prefix', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-01.ttl')).toBe(true);
    });

    it('+ @prefix with no suffix', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-05.ttl')).toBe(true);
    });

    it('+ \'a\' as keyword', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-kw-03.ttl')).toBe(true);
    });

    it('+ bare bnode property list', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-08.ttl')).toBe(true);
    });

    it('+ BASE', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-base-02.ttl')).toBe(true);
    });

    it('+ base with relative IRIs', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-base-04.ttl')).toBe(true);
    });

    it('+ bnode object', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-02.ttl')).toBe(true);
    });

    it('+ bnode property list', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-09.ttl')).toBe(true);
    });

    it('+ bnode property list object', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-03.ttl')).toBe(true);
    });

    it('+ bnode property list object (2)', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-04.ttl')).toBe(true);
    });

    it('+ bnode property list subject', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-05.ttl')).toBe(true);
    });

    it('+ bnode subject', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-01.ttl')).toBe(true);
    });

    it('+ boolean literal (false)', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-kw-02.ttl')).toBe(true);
    });

    it('+ boolean literal (true)', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-kw-01.ttl')).toBe(true);
    });

    it('+ Characters allowed in blank node labels', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-blank-label.ttl')).toBe(true);
    });

    it('+ colon is a legal pname character', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-06.ttl')).toBe(true);
    });

    it('+ Colons in pname local names', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-ln-colons.ttl')).toBe(true);
    });

    it('+ dash is a legal pname character', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-07.ttl')).toBe(true);
    });

    it('+ decimal literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-04.ttl')).toBe(true);
    });

    it('+ decimal literal (no leading digits)', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-05.ttl')).toBe(true);
    });

    it('+ Dots in namespace names', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-ns-dots.ttl')).toBe(true);
    });

    it('+ Dots in pname local names', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-ln-dots.ttl')).toBe(true);
    });

    it('+ double literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-09.ttl')).toBe(true);
    });

    it('+ double literal no fraction', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-11.ttl')).toBe(true);
    });

    it('+ Empty @prefix with % escape', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-04.ttl')).toBe(true);
    });

    it('+ Empty file', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-file-01.ttl')).toBe(true);
    });

    it('+ empty list', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-lists-01.ttl')).toBe(true);
    });

    it('+ Empty PREFIX', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-03.ttl')).toBe(true);
    });

    it('+ integer as xsd:string', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-datatypes-02.ttl')).toBe(true);
    });

    it('+ integer literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-01.ttl')).toBe(true);
    });

    it('+ integer literal with decimal lexical confusion', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-08.ttl')).toBe(true);
    });

    it('+ IRIs with long Unicode escape', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-uri-03.ttl')).toBe(true);
    });

    it('+ IRIs with Unicode escape', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-uri-02.ttl')).toBe(true);
    });

    it('+ isomorphic list as subject and object', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-lists-03.ttl')).toBe(true);
    });

    it('+ labeled bnode subject', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-06.ttl')).toBe(true);
    });

    it('+ labeled bnode subject and object', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-07.ttl')).toBe(true);
    });

    it('+ langString literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-02.ttl')).toBe(true);
    });

    it('+ langString literal with region', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-03.ttl')).toBe(true);
    });

    it('+ Legal IRIs', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-uri-04.ttl')).toBe(true);
    });

    it('+ lists of lists', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-lists-04.ttl')).toBe(true);
    });

    it('+ long langString literal with embedded newline', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-10.ttl')).toBe(true);
    });

    it('+ long string literal with embedded newline', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-08.ttl')).toBe(true);
    });

    it('+ long string literal with embedded single- and double-quotes', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-07.ttl')).toBe(true);
    });

    it('+ mixed bnode property list and triple', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-bnode-10.ttl')).toBe(true);
    });

    it('+ mixed list', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-lists-02.ttl')).toBe(true);
    });

    it('+ mixed lists with embedded lists', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-lists-05.ttl')).toBe(true);
    });

    it('+ negative decimal literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-06.ttl')).toBe(true);
    });

    it('+ negative double literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-10.ttl')).toBe(true);
    });

    it('+ negative integer literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-02.ttl')).toBe(true);
    });

    it('+ object list', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-struct-01.ttl')).toBe(true);
    });

    it('+ One comment, one empty line', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-file-03.ttl')).toBe(true);
    });

    it('+ Only comment', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-file-02.ttl')).toBe(true);
    });

    it('+ Only IRIs', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-uri-01.ttl')).toBe(true);
    });

    it('+ percents in pnames', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-09.ttl')).toBe(true);
    });

    it('+ pname with back-slash escapes', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-pname-esc-01.ttl')).toBe(true);
    });

    it('+ pname with back-slash escapes (2)', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-pname-esc-02.ttl')).toBe(true);
    });


    it('+ pname with back-slash escapes (3)', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-pname-esc-03.ttl')).toBe(true);
    });

    it('+ positive decimal literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-07.ttl')).toBe(true);
    });

    it('+ positive integer literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-number-03.ttl')).toBe(true);
    });

    it('+ predicate list with multiple ;;', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-struct-04.ttl')).toBe(true);
    });

    it('+ predicate list with multiple ;;', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-struct-05.ttl')).toBe(true);
    });

    it('+ predicate list with object list', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-struct-02.ttl')).toBe(true);
    });

    it('+ predicate list with object list and dangling \';\'', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-struct-03.ttl')).toBe(true);
    });

    it('+ PreFIX', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-02.ttl')).toBe(true);
    });

    it('+ squote langString literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-05.ttl')).toBe(true);
    });

    it('+ squote langString literal with region', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-06.ttl')).toBe(true);
    });

    it('+ squote long langString literal with embedded newline', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-11.ttl')).toBe(true);
    });

    it('+ squote long string literal with embedded single- and double-quotes', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-09.ttl')).toBe(true);
    });

    it('+ squote string literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-04.ttl')).toBe(true);
    });

    it('+ string literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-string-01.ttl')).toBe(true);
    });

    it('+ string literal with escaped newline', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-str-esc-01.ttl')).toBe(true);
    });

    it('+ string literal with long Unicode escape', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-str-esc-03.ttl')).toBe(true);
    });

    it('+ string literal with Unicode escape', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-str-esc-02.ttl')).toBe(true);
    });

    it('+ underscore is a legal pname character', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-prefix-08.ttl')).toBe(true);
    });

    it('+ xsd:byte literal', async () => {
        expect(await matchQuads('file://./tests/turtle-syntax-datatypes-01.ttl')).toBe(true);
    });
});