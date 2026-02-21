import * as fs from 'fs';
import { parseQuads, quadsMatch } from '../helpers.js';
import { TrigLexer, TrigParser } from './parser.js';
import { TrigReader } from './reader.js';

/**
 * TriG Reader Tests
 *
 * Test datasets:
 *
 * The .trig fixture files in the `tests/` directory are derived from the
 * official W3C RDF Test Suite for TriG.
 */
describe("TrigReader", () => {
    const getTestData = (fileIri: string) => {
        const relativePath = fileIri.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const parse = (fileIri: string) => {
        const data = getTestData(fileIri);
        const lexResult = new TrigLexer().tokenize(data);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const parser = new TrigParser();
        parser.input = lexResult.tokens;

        return parser.trigDoc();
    }

    const matchQuads = async (fileIri: string) => {
        const data = getTestData(fileIri);

        const lexResult = new TrigLexer().tokenize(data);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const expected = await parseQuads(data);

        const parser = new TrigParser();
        parser.input = lexResult.tokens;
        const cst = parser.trigDoc();

        const reader = new TrigReader();
        const actual = reader.visit(cst);

        return quadsMatch(actual, expected);
    }

    // === Basic TriG structure tests ===

    it('+ Default graph (empty braces)', async () => {
        expect(await matchQuads('file://./tests/trig-subm-01.trig')).toBe(true);
    });

    it('+ Named graph with IRI', async () => {
        expect(await matchQuads('file://./tests/alternating_iri_graphs.trig')).toBe(true);
    });

    it('+ Named graph with blank node label', async () => {
        expect(await matchQuads('file://./tests/labeled_blank_node_graph.trig')).toBe(true);
    });

    it('+ Anonymous blank node graph', async () => {
        expect(await matchQuads('file://./tests/anonymous_blank_node_graph.trig')).toBe(true);
    });

    it('+ GRAPH keyword with IRI', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-01.trig')).toBe(true);
    });

    it('+ GRAPH keyword with blank node', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-02.trig')).toBe(true);
    });

    // === W3C Test Suite: trig-subm tests ===

    it('+ W3C: trig-subm-01', async () => {
        expect(await matchQuads('file://./tests/trig-subm-01.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-02', async () => {
        expect(await matchQuads('file://./tests/trig-subm-02.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-03', async () => {
        expect(await matchQuads('file://./tests/trig-subm-03.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-04', async () => {
        expect(await matchQuads('file://./tests/trig-subm-04.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-05', async () => {
        expect(await matchQuads('file://./tests/trig-subm-05.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-06', async () => {
        expect(await matchQuads('file://./tests/trig-subm-06.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-07', async () => {
        expect(await matchQuads('file://./tests/trig-subm-07.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-08', async () => {
        expect(await matchQuads('file://./tests/trig-subm-08.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-09', async () => {
        expect(await matchQuads('file://./tests/trig-subm-09.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-10', async () => {
        expect(await matchQuads('file://./tests/trig-subm-10.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-11', async () => {
        expect(await matchQuads('file://./tests/trig-subm-11.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-12', async () => {
        expect(await matchQuads('file://./tests/trig-subm-12.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-13', async () => {
        expect(await matchQuads('file://./tests/trig-subm-13.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-14', async () => {
        expect(await matchQuads('file://./tests/trig-subm-14.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-15', async () => {
        expect(await matchQuads('file://./tests/trig-subm-15.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-16', async () => {
        expect(await matchQuads('file://./tests/trig-subm-16.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-17', async () => {
        expect(await matchQuads('file://./tests/trig-subm-17.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-18', async () => {
        expect(await matchQuads('file://./tests/trig-subm-18.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-19', async () => {
        expect(await matchQuads('file://./tests/trig-subm-19.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-20', async () => {
        expect(await matchQuads('file://./tests/trig-subm-20.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-21', async () => {
        expect(await matchQuads('file://./tests/trig-subm-21.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-22', async () => {
        expect(await matchQuads('file://./tests/trig-subm-22.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-23', async () => {
        expect(await matchQuads('file://./tests/trig-subm-23.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-24', async () => {
        expect(await matchQuads('file://./tests/trig-subm-24.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-25', async () => {
        expect(await matchQuads('file://./tests/trig-subm-25.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-26', async () => {
        expect(await matchQuads('file://./tests/trig-subm-26.trig')).toBe(true);
    });

    it('+ W3C: trig-subm-27', async () => {
        expect(await matchQuads('file://./tests/trig-subm-27.trig')).toBe(true);
    });

    // === GRAPH keyword tests ===

    it('+ W3C: trig-kw-graph-03', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-03.trig')).toBe(true);
    });

    it('+ W3C: trig-kw-graph-04', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-04.trig')).toBe(true);
    });

    it('+ W3C: trig-kw-graph-05', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-05.trig')).toBe(true);
    });

    it('+ W3C: trig-kw-graph-06', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-06.trig')).toBe(true);
    });

    it('+ W3C: trig-kw-graph-07', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-07.trig')).toBe(true);
    });

    it('+ W3C: trig-kw-graph-08', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-08.trig')).toBe(true);
    });

    it('+ W3C: trig-kw-graph-09', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-09.trig')).toBe(true);
    });

    it('+ W3C: trig-kw-graph-10', async () => {
        expect(await matchQuads('file://./tests/trig-kw-graph-10.trig')).toBe(true);
    });

    // === Turtle-compatible tests in TriG ===

    it('+ W3C: trig-turtle-01', async () => {
        expect(await matchQuads('file://./tests/trig-turtle-01.trig')).toBe(true);
    });

    it('+ W3C: trig-turtle-02', async () => {
        expect(await matchQuads('file://./tests/trig-turtle-02.trig')).toBe(true);
    });

    it('+ W3C: trig-turtle-03', async () => {
        expect(await matchQuads('file://./tests/trig-turtle-03.trig')).toBe(true);
    });

    it('+ W3C: trig-turtle-04', async () => {
        expect(await matchQuads('file://./tests/trig-turtle-04.trig')).toBe(true);
    });

    it('+ W3C: trig-turtle-05', async () => {
        expect(await matchQuads('file://./tests/trig-turtle-05.trig')).toBe(true);
    });

    it('+ W3C: trig-turtle-06', async () => {
        expect(await matchQuads('file://./tests/trig-turtle-06.trig')).toBe(true);
    });

    // === Structural tests ===

    it('+ eval-struct-01', async () => {
        expect(await matchQuads('file://./tests/trig-eval-struct-01.trig')).toBe(true);
    });

    it('+ eval-struct-02', async () => {
        expect(await matchQuads('file://./tests/trig-eval-struct-02.trig')).toBe(true);
    });

    // === Literals ===

    it('+ literal_false', async () => {
        expect(await matchQuads('file://./tests/literal_false.trig')).toBe(true);
    });

    it('+ literal_true', async () => {
        expect(await matchQuads('file://./tests/literal_true.trig')).toBe(true);
    });

    it('+ langtagged_non_LONG', async () => {
        expect(await matchQuads('file://./tests/langtagged_non_LONG.trig')).toBe(true);
    });

    it('+ langtagged_LONG', async () => {
        expect(await matchQuads('file://./tests/langtagged_LONG.trig')).toBe(true);
    });

    it('+ LITERAL1', async () => {
        expect(await matchQuads('file://./tests/LITERAL1.trig')).toBe(true);
    });

    it('+ LITERAL2', async () => {
        expect(await matchQuads('file://./tests/LITERAL2.trig')).toBe(true);
    });

    it('+ LITERAL_LONG1', async () => {
        expect(await matchQuads('file://./tests/LITERAL_LONG1.trig')).toBe(true);
    });

    it('+ LITERAL_LONG2', async () => {
        expect(await matchQuads('file://./tests/LITERAL_LONG2.trig')).toBe(true);
    });

    // === IRIs ===

    it('+ IRI_subject', async () => {
        expect(await matchQuads('file://./tests/IRI_subject.trig')).toBe(true);
    });

    it('+ prefixed_IRI_object', async () => {
        expect(await matchQuads('file://./tests/prefixed_IRI_object.trig')).toBe(true);
    });

    it('+ prefixed_IRI_predicate', async () => {
        expect(await matchQuads('file://./tests/prefixed_IRI_predicate.trig')).toBe(true);
    });

    // === Blank nodes ===

    it('+ anonymous_blank_node_object', async () => {
        expect(await matchQuads('file://./tests/anonymous_blank_node_object.trig')).toBe(true);
    });

    it('+ anonymous_blank_node_subject', async () => {
        expect(await matchQuads('file://./tests/anonymous_blank_node_subject.trig')).toBe(true);
    });

    it('+ labeled_blank_node_object', async () => {
        expect(await matchQuads('file://./tests/labeled_blank_node_object.trig')).toBe(true);
    });

    it('+ labeled_blank_node_subject', async () => {
        expect(await matchQuads('file://./tests/labeled_blank_node_subject.trig')).toBe(true);
    });

    it('+ blankNodePropertyList_as_object', async () => {
        expect(await matchQuads('file://./tests/blankNodePropertyList_as_object.trig')).toBe(true);
    });

    it('+ blankNodePropertyList_as_subject', async () => {
        expect(await matchQuads('file://./tests/blankNodePropertyList_as_subject.trig')).toBe(true);
    });

    it('+ blankNodePropertyList_containing_collection', async () => {
        expect(await matchQuads('file://./tests/blankNodePropertyList_containing_collection.trig')).toBe(true);
    });

    it('+ blankNodePropertyList_with_multiple_triples', async () => {
        expect(await matchQuads('file://./tests/blankNodePropertyList_with_multiple_triples.trig')).toBe(true);
    });

    it('+ nested_blankNodePropertyLists', async () => {
        expect(await matchQuads('file://./tests/nested_blankNodePropertyLists.trig')).toBe(true);
    });

    // === Collections ===

    it('+ collection_object', async () => {
        expect(await matchQuads('file://./tests/collection_object.trig')).toBe(true);
    });

    it('+ collection_subject', async () => {
        expect(await matchQuads('file://./tests/collection_subject.trig')).toBe(true);
    });

    it('+ empty_collection', async () => {
        expect(await matchQuads('file://./tests/empty_collection.trig')).toBe(true);
    });

    it('+ nested_collection', async () => {
        expect(await matchQuads('file://./tests/nested_collection.trig')).toBe(true);
    });

    it('+ first', async () => {
        expect(await matchQuads('file://./tests/first.trig')).toBe(true);
    });

    it('+ last', async () => {
        expect(await matchQuads('file://./tests/last.trig')).toBe(true);
    });

    // === Prefixes and base ===

    it('+ old_style_prefix', async () => {
        expect(await matchQuads('file://./tests/old_style_prefix.trig')).toBe(true);
    });

    it('+ old_style_base', async () => {
        expect(await matchQuads('file://./tests/old_style_base.trig')).toBe(true);
    });

    it('+ SPARQL_style_prefix', async () => {
        expect(await matchQuads('file://./tests/SPARQL_style_prefix.trig')).toBe(true);
    });

    it('+ SPARQL_style_base', async () => {
        expect(await matchQuads('file://./tests/SPARQL_style_base.trig')).toBe(true);
    });

    it('+ prefix_reassigned_and_used', async () => {
        expect(await matchQuads('file://./tests/prefix_reassigned_and_used.trig')).toBe(true);
    });

    // === Numeric literals ===

    it('+ bareword_integer', async () => {
        expect(await matchQuads('file://./tests/bareword_integer.trig')).toBe(true);
    });

    it('+ bareword_decimal', async () => {
        expect(await matchQuads('file://./tests/bareword_decimal.trig')).toBe(true);
    });

    it('+ bareword_double', async () => {
        expect(await matchQuads('file://./tests/bareword_double.trig')).toBe(true);
    });

    it('+ negative_numeric', async () => {
        expect(await matchQuads('file://./tests/negative_numeric.trig')).toBe(true);
    });

    it('+ positive_numeric', async () => {
        expect(await matchQuads('file://./tests/positive_numeric.trig')).toBe(true);
    });

    // === Other tests ===

    it('+ bareword_a_predicate', async () => {
        expect(await matchQuads('file://./tests/bareword_a_predicate.trig')).toBe(true);
    });

    it('+ objectList_with_two_objects', async () => {
        expect(await matchQuads('file://./tests/objectList_with_two_objects.trig')).toBe(true);
    });

    it('+ predicateObjectList_with_two_objectLists', async () => {
        expect(await matchQuads('file://./tests/predicateObjectList_with_two_objectLists.trig')).toBe(true);
    });

    it('+ repeated_semis_at_end', async () => {
        expect(await matchQuads('file://./tests/repeated_semis_at_end.trig')).toBe(true);
    });

    it('+ repeated_semis_not_at_end', async () => {
        expect(await matchQuads('file://./tests/repeated_semis_not_at_end.trig')).toBe(true);
    });

    it('+ sole_blankNodePropertyList', async () => {
        expect(await matchQuads('file://./tests/sole_blankNodePropertyList.trig')).toBe(true);
    });
});
