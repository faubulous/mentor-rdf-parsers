import * as fs from 'fs';
import { parseQuads, quadsMatch, parseNTriples12 } from '../helpers.js';
import { TurtleLexer, TurtleParser } from './parser.js';
import { TurtleReader } from './reader.js';

/**
 * Turtle Reader Tests
 *
 * Test datasets:
 *
 * The .ttl fixture files in the `tests/` directory are derived from the
 * official W3C RDF Test Suite for Turtle. See parser.test.mjs for full
 * provenance details.
 */
describe("TurtleReader", () => {
    const getTestData = (fileIri) => {
        const relativePath = fileIri.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const matchQuads = async (fileIri: string, text?: string) => {
        const baseIri = fileIri;
        const data = fileIri ? getTestData(fileIri) : text;

        const lexResult = new TurtleLexer().tokenize(data);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const expected = await parseQuads(data);

        const cst = new TurtleParser().parse(lexResult.tokens);
        const actual = new TurtleReader().visit(cst);

        return quadsMatch(actual, expected);
    }

    /**
     * Match quads for RDF 1.2 tests by comparing against expected N-Triples output.
     */
    const matchQuads12 = (ttlFileIri, ntFileIri) => {
        const ttlData = getTestData(ttlFileIri);
        const ntData = getTestData(ntFileIri);

        const lexResult = new TurtleLexer().tokenize(ttlData);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const cst = new TurtleParser().parse(lexResult.tokens);
        const actual = new TurtleReader().visit(cst);
        const expected = parseNTriples12(ntData);

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

    // RDF 1.2 Evaluation Tests: Reified Triples
    it('+ RDF 1.2: eval reified triple (rt-01)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-01.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-01.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple (rt-02)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-02.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-02.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple with reifier (rt-03)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-03.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-03.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple emits asserted triple (rt-04)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-04.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-04.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple with reifier emits asserted triple (rt-05)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-05.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-05.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple with literal object (rt-06)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-06.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-06.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple with boolean keyword object (rt-07)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-07.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-07.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple with integer object (rt-08)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-rt-08.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-rt-08.nt'
        )).toBe(true);
    });

    // RDF 1.2 Syntax Tests: Basic
    it('+ RDF 1.2: syntax basic with asserted and reified triple (syntax-basic-01)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/syntax/turtle12-syntax-basic-01.ttl',
            'file://./tests/rdf12/syntax/turtle12-syntax-basic-01.nt'
        )).toBe(true);
    });

    // RDF 1.2 Evaluation Tests: Blank Nodes
    it('+ RDF 1.2: eval blank node subject in reified triple (bnode-01)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-bnode-01.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-bnode-01.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval blank node object in reified triple (bnode-02)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-bnode-02.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-bnode-02.nt'
        )).toBe(true);
    });

    // RDF 1.2 Evaluation Tests: Triple Terms
    it('+ RDF 1.2: eval triple term (tt-01)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-tt-01.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-tt-01.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval triple term with literal (tt-02)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-tt-02.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-tt-02.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval triple term with boolean keyword (tt-03)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-tt-03.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-tt-03.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval nested triple term (tt-04)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-tt-04.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-tt-04.nt'
        )).toBe(true);
    });

    // RDF 1.2 Evaluation Tests: Annotations
    it('+ RDF 1.2: eval annotation (annotation-01)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-01.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-01.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation (annotation-02)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-02.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-02.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation multi predicate-object (annotation-03)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-03.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-03.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval nested annotation (annotation-04)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-04.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-04.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation on second object (annotation-05)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-05.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-05.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation with named reifier (annotation-06)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-06.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-06.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation with two reifiers (annotation-07)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-07.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-07.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation with named reifier and block (annotation-08)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-08.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-08.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation with multiple named reifiers (annotation-09)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-09.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-09.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation with multiple blocks (annotation-10)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-10.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-10.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation mixed reifier and block (annotation-11)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-11.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-11.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval annotation multiple named reifiers with blocks (annotation-12)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-annotation-12.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-annotation-12.nt'
        )).toBe(true);
    });

    // RDF 1.2 Evaluation Tests: Reified Triples with Annotations
    it('+ RDF 1.2: eval reified triple with annotation (rta-01)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-reified-triples-annotation-01.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-reified-triples-annotation-01.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple with annotation (rta-02)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-reified-triples-annotation-02.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-reified-triples-annotation-02.nt'
        )).toBe(true);
    });

    it('+ RDF 1.2: eval reified triple with annotation (rta-03)', () => {
        expect(matchQuads12(
            'file://./tests/rdf12/eval/turtle12-eval-reified-triples-annotation-03.ttl',
            'file://./tests/rdf12/eval/turtle12-eval-reified-triples-annotation-03.nt'
        )).toBe(true);
    });
});

describe("TurtleReader.turtleDocInfo", () => {
    it('returns QuadInfo with correct tokens for simple triple', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:subject ex:predicate ex:object .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(1);
        expect(infos[0].subject.term.value).toBe('http://example.org/subject');
        expect(infos[0].predicate.term.value).toBe('http://example.org/predicate');
        expect(infos[0].object.term.value).toBe('http://example.org/object');
        
        // Verify tokens have position info
        expect(infos[0].subject.token.startOffset).toBeDefined();
        expect(infos[0].predicate.token.startOffset).toBeDefined();
        expect(infos[0].object.token.startOffset).toBeDefined();
    });

    it('returns correct token for rdf:type shorthand (a)', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:subject a ex:Class .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(1);
        expect(infos[0].predicate.term.value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
        expect(infos[0].predicate.token.image).toBe('a');
    });

    it('returns correct token for blank node with identifier', () => {
        const input = `@prefix ex: <http://example.org/> .
_:b1 ex:predicate "value" .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(1);
        expect(infos[0].subject.term.termType).toBe('BlankNode');
        expect(infos[0].subject.token.image).toBe('_:b1');
    });

    it('returns LBRACKET token for anonymous blank node property list', () => {
        const input = `@prefix ex: <http://example.org/> .
[ ex:prop "value" ] ex:other "x" .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        // Should have 2 quads: internal blank node property and outer triple
        expect(infos.length).toBeGreaterThanOrEqual(2);
        
        // The blank node subject should have '[' as token
        const blankNodeInfo = infos.find(i => i.subject.term.termType === 'BlankNode');
        expect(blankNodeInfo).toBeDefined();
        expect(blankNodeInfo!.subject.token.image).toBe('[');
    });

    it('returns correct token for string literal', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:s ex:p "hello world" .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(1);
        expect(infos[0].object.term.termType).toBe('Literal');
        expect(infos[0].object.term.value).toBe('hello world');
        expect(infos[0].object.token.image).toBe('"hello world"');
    });

    it('returns correct token for numeric literal', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:s ex:p 42 .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(1);
        expect(infos[0].object.term.value).toBe('42');
        expect(infos[0].object.token.image).toBe('42');
    });

    it('handles multiple triples', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:s1 ex:p1 ex:o1 .
ex:s2 ex:p2 ex:o2 .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(2);
        expect(infos[0].subject.term.value).toBe('http://example.org/s1');
        expect(infos[1].subject.term.value).toBe('http://example.org/s2');
    });

    it('handles predicate-object list', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:s ex:p1 ex:o1 ; ex:p2 ex:o2 .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(2);
        // Both quads share the same subject
        expect(infos[0].subject.term.value).toBe(infos[1].subject.term.value);
        expect(infos[0].predicate.term.value).toBe('http://example.org/p1');
        expect(infos[1].predicate.term.value).toBe('http://example.org/p2');
    });

    it('handles object list', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:s ex:p ex:o1, ex:o2 .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(2);
        // Both quads share same subject and predicate
        expect(infos[0].subject.term.value).toBe(infos[1].subject.term.value);
        expect(infos[0].predicate.term.value).toBe(infos[1].predicate.term.value);
        expect(infos[0].object.term.value).toBe('http://example.org/o1');
        expect(infos[1].object.term.value).toBe('http://example.org/o2');
    });

    it('returns IRIREF token for full IRI', () => {
        const input = `<http://example.org/s> <http://example.org/p> <http://example.org/o> .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        expect(infos).toHaveLength(1);
        expect(infos[0].subject.token.image).toBe('<http://example.org/s>');
        expect(infos[0].predicate.token.image).toBe('<http://example.org/p>');
        expect(infos[0].object.token.image).toBe('<http://example.org/o>');
    });
});
describe("TurtleReader - Blank Node ID Pre-assignment", () => {
    it('anonymous blank nodes use pre-assigned IDs from token payload', () => {
        const input = `@prefix ex: <http://example.org/> .
[ ex:prop "value" ] .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        // Find the blank node subject
        const blankNodeInfo = infos.find(i => i.subject.term.termType === 'BlankNode');
        expect(blankNodeInfo).toBeDefined();
        
        // The blank node ID should match the pre-assigned ID from the LBRACKET token
        const lbracketToken = lexResult.tokens.find(t => t.tokenType.name === 'LBRACKET');
        expect(lbracketToken).toBeDefined();
        expect(lbracketToken!.payload?.blankNodeId).toBeDefined();
        expect(blankNodeInfo!.subject.term.value).toBe(lbracketToken!.payload.blankNodeId);
    });

    it('collection blank node IDs are derived from LPARENT token payload', () => {
        const input = `@prefix ex: <http://example.org/> .
ex:s ex:p (1 2) .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const quads = reader.visit(cst);
        
        // Find the LPARENT token
        const lparentToken = lexResult.tokens.find(t => t.tokenType.name === 'LPARENT');
        expect(lparentToken).toBeDefined();
        expect(lparentToken!.payload?.blankNodeId).toBeDefined();
        
        // The first blank node in the collection should use the pre-assigned ID
        const collectionHead = quads.find(q =>
            q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first'
        )?.subject;
        expect(collectionHead).toBeDefined();
        expect(collectionHead!.termType).toBe('BlankNode');
        expect(collectionHead!.value).toBe(lparentToken!.payload.blankNodeId);
    });

    it('multiple anonymous blank nodes get distinct IDs from tokens', () => {
        const input = `@prefix ex: <http://example.org/> .
[ ex:p1 "a" ] . [ ex:p2 "b" ] .`;
        
        const lexResult = new TurtleLexer().tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        // Get all the LBRACKET tokens
        const lbracketTokens = lexResult.tokens.filter(t => t.tokenType.name === 'LBRACKET');
        expect(lbracketTokens).toHaveLength(2);
        
        // Find the blank node subjects
        const blankNodeInfos = infos.filter(i => i.subject.term.termType === 'BlankNode');
        const blankNodeValues = new Set(blankNodeInfos.map(i => i.subject.term.value));
        
        // Should have 2 distinct blank node IDs
        expect(blankNodeValues.size).toBe(2);
        
        // All blank node IDs should match their corresponding token payloads
        for (const lbracket of lbracketTokens) {
            expect(lbracket.payload?.blankNodeId).toBeDefined();
            expect(blankNodeValues.has(lbracket.payload.blankNodeId)).toBe(true);
        }
    });

    it('custom ID generator affects blank node values', () => {
        const input = `@prefix ex: <http://example.org/> .
[ ex:prop "value" ] .`;
        
        // Use custom ID generator
        const lexer = new TurtleLexer((counter) => `my-custom-${counter}`);
        const lexResult = lexer.tokenize(input);
        const cst = new TurtleParser().parse(lexResult.tokens);
        const reader = new TurtleReader();
        const infos = reader.turtleDocInfo(cst);
        
        // Find the blank node subject
        const blankNodeInfo = infos.find(i => i.subject.term.termType === 'BlankNode');
        expect(blankNodeInfo).toBeDefined();
        
        // The blank node ID should use the custom format
        expect(blankNodeInfo!.subject.term.value).toBe('my-custom-0');
    });
});
