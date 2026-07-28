import * as fs from 'fs';
import * as path from 'path';
import dataFactory from '@rdfjs/data-model';
import type { Quad, Term } from '@rdfjs/types';
import { parseQuads, quadsMatch } from '../helpers.js';
import { SparqlLexer, SparqlParser } from './parser.js';
import { SparqlReader } from './reader.js';
import { sparql } from './vocabulary.js';

/**
 * SPARQL 1.2 Reader Conformance Tests
 *
 * The reader converts the CST produced by the SPARQL parser into an RDF
 * representation of the query using the SPARQL syntax vocabulary
 * (https://w3id.org/sparql-syntax#).
 *
 * Test layers:
 * 1. Expected-RDF conformance: each .rq fixture is read and compared against
 *    a hand-reviewed companion Turtle document in tests/rdf/ using blank node
 *    isomorphism (quadsMatch).
 * 2. Structural assertions on complex_query.rq that are independent of the
 *    fixture files, guarding against fixture/reader co-evolution.
 * 3. Smoke tests: every hand-crafted fixture and every parseable query of the
 *    W3C SPARQL 1.2 syntax test suites must produce a non-empty, typed result.
 * 4. A vocabulary self-test keeping vocabulary.ts and vocab/sparql-syntax.ttl
 *    in sync.
 */

describe('SparqlReader', () => {
    const getTestData = (fileUrl: string) => {
        const relativePath = fileUrl.substring(7);
        const resolvedPath = new URL(relativePath, import.meta.url).pathname;

        return fs.readFileSync(resolvedPath, 'utf-8');
    }

    const resolvePath = (relativePath: string) => new URL(relativePath, import.meta.url).pathname;

    // Reuse lexer and parser instances to avoid expensive performSelfAnalysis() on each test.
    const lexer = new SparqlLexer();
    const parser = new SparqlParser();

    const read = (text: string) => {
        const lexResult = lexer.tokenize(text);

        if (lexResult.errors.length > 0) {
            throw new Error('Lexing errors detected:\n' + JSON.stringify(lexResult.errors));
        }

        const cst = parser.parse(lexResult.tokens);
        const reader = new SparqlReader();
        const quads = reader.visit(cst) as Quad[];

        return { quads, reader };
    }

    const matchQuads = async (name: string) => {
        const query = getTestData(`file://./tests/${name}.rq`);
        const expectedTtl = getTestData(`file://./tests/rdf/${name}.ttl`);

        const { quads: actual } = read(query);
        const expected = await parseQuads(expectedTtl);

        return quadsMatch(actual, expected);
    }

    describe('Query forms and prologue', () => {
        it('+ SELECT *', async () => {
            expect(await matchQuads('select_star')).toBe(true);
        });

        it('+ SELECT with variables', async () => {
            expect(await matchQuads('select_vars')).toBe(true);
        });

        it('+ SELECT DISTINCT', async () => {
            expect(await matchQuads('select_distinct')).toBe(true);
        });

        it('+ SELECT REDUCED', async () => {
            expect(await matchQuads('select_reduced')).toBe(true);
        });

        it('+ SELECT with PREFIX', async () => {
            expect(await matchQuads('select_with_prefix')).toBe(true);
        });

        it('+ SELECT with BASE and PREFIX', async () => {
            expect(await matchQuads('select_with_base_and_prefix')).toBe(true);
        });

        it('+ ASK', async () => {
            expect(await matchQuads('ask_basic')).toBe(true);
        });

        it('+ CONSTRUCT', async () => {
            expect(await matchQuads('construct_basic')).toBe(true);
        });

        it('+ CONSTRUCT WHERE shorthand', async () => {
            expect(await matchQuads('construct_where')).toBe(true);
        });

        it('+ DESCRIBE with IRI', async () => {
            expect(await matchQuads('describe_iri')).toBe(true);
        });

        it('+ DESCRIBE *', async () => {
            expect(await matchQuads('describe_star')).toBe(true);
        });
    });

    describe('Dataset clauses and VERSION', () => {
        it('+ FROM', async () => {
            expect(await matchQuads('from_clause')).toBe(true);
        });

        it('+ FROM NAMED', async () => {
            expect(await matchQuads('from_named')).toBe(true);
        });

        it('+ FROM mixed', async () => {
            expect(await matchQuads('from_mixed')).toBe(true);
        });

        it('+ VERSION declaration', async () => {
            expect(await matchQuads('rdf12_version')).toBe(true);
        });
    });

    describe('Graph patterns', () => {
        it('+ multiple triples', async () => {
            expect(await matchQuads('multiple_triples')).toBe(true);
        });

        it('+ predicate list with semicolon', async () => {
            expect(await matchQuads('semicolon_predicate_list')).toBe(true);
        });

        it('+ object list with comma', async () => {
            expect(await matchQuads('comma_object_list')).toBe(true);
        });

        it('+ OPTIONAL', async () => {
            expect(await matchQuads('optional_pattern')).toBe(true);
        });

        it('+ UNION', async () => {
            expect(await matchQuads('union_pattern')).toBe(true);
        });

        it('+ MINUS', async () => {
            expect(await matchQuads('minus_pattern')).toBe(true);
        });

        it('+ GRAPH', async () => {
            expect(await matchQuads('graph_pattern')).toBe(true);
        });

        it('+ SERVICE', async () => {
            expect(await matchQuads('service_pattern')).toBe(true);
        });

        it('+ SERVICE SILENT', async () => {
            expect(await matchQuads('service_silent')).toBe(true);
        });

        it('+ BIND', async () => {
            expect(await matchQuads('bind_expression')).toBe(true);
        });

        it('+ trailing VALUES clause', async () => {
            expect(await matchQuads('values_clause')).toBe(true);
        });

        it('+ inline VALUES with multiple variables', async () => {
            expect(await matchQuads('inline_data_full')).toBe(true);
        });

        it('+ sub-select', async () => {
            expect(await matchQuads('subselect')).toBe(true);
        });
    });

    describe('Blank nodes and collections', () => {
        it('+ blank node property list', async () => {
            expect(await matchQuads('blank_node_property_list')).toBe(true);
        });

        it('+ collection', async () => {
            expect(await matchQuads('collection')).toBe(true);
        });
    });

    describe('Expressions and built-in functions', () => {
        it('+ arithmetic expressions', async () => {
            expect(await matchQuads('arithmetic_expressions')).toBe(true);
        });

        it('+ logical expressions', async () => {
            expect(await matchQuads('logical_expressions')).toBe(true);
        });

        it('+ FILTER with comparison', async () => {
            expect(await matchQuads('filter_expression')).toBe(true);
        });

        it('+ FILTER IN', async () => {
            expect(await matchQuads('filter_in')).toBe(true);
        });

        it('+ FILTER NOT IN', async () => {
            expect(await matchQuads('filter_not_in')).toBe(true);
        });

        it('+ FILTER EXISTS', async () => {
            expect(await matchQuads('filter_exists')).toBe(true);
        });

        it('+ FILTER NOT EXISTS', async () => {
            expect(await matchQuads('filter_not_exists')).toBe(true);
        });

        it('+ FILTER REGEX', async () => {
            expect(await matchQuads('filter_regex')).toBe(true);
        });

        it('+ IF expression', async () => {
            expect(await matchQuads('if_expression')).toBe(true);
        });

        it('+ COALESCE', async () => {
            expect(await matchQuads('coalesce')).toBe(true);
        });

        it('+ custom function call', async () => {
            expect(await matchQuads('custom_function_call')).toBe(true);
        });

        it('+ STRLANG and STRDT', async () => {
            expect(await matchQuads('strlang_strdt')).toBe(true);
        });
    });

    describe('Aggregates and solution modifiers', () => {
        it('+ aggregates', async () => {
            expect(await matchQuads('aggregates')).toBe(true);
        });

        it('+ aggregate with DISTINCT', async () => {
            expect(await matchQuads('aggregate_distinct')).toBe(true);
        });

        it('+ GROUP_CONCAT with separator', async () => {
            expect(await matchQuads('group_concat')).toBe(true);
        });

        it('+ GROUP BY', async () => {
            expect(await matchQuads('group_by')).toBe(true);
        });

        it('+ GROUP BY with HAVING', async () => {
            expect(await matchQuads('group_by_having')).toBe(true);
        });

        it('+ ORDER BY', async () => {
            expect(await matchQuads('order_by')).toBe(true);
        });

        it('+ ORDER BY ASC', async () => {
            expect(await matchQuads('order_by_asc')).toBe(true);
        });

        it('+ ORDER BY DESC', async () => {
            expect(await matchQuads('order_by_desc')).toBe(true);
        });

        it('+ LIMIT and OFFSET', async () => {
            expect(await matchQuads('limit_offset')).toBe(true);
        });

        it('+ LIMIT', async () => {
            expect(await matchQuads('limit')).toBe(true);
        });

        it('+ OFFSET', async () => {
            expect(await matchQuads('offset')).toBe(true);
        });
    });

    describe('Property paths', () => {
        it('+ sequence path', async () => {
            expect(await matchQuads('property_path_sequence')).toBe(true);
        });

        it('+ alternative path', async () => {
            expect(await matchQuads('property_path_alternative')).toBe(true);
        });

        it('+ inverse path', async () => {
            expect(await matchQuads('property_path_inverse')).toBe(true);
        });

        it('+ zero-or-more path', async () => {
            expect(await matchQuads('property_path_star')).toBe(true);
        });

        it('+ one-or-more path', async () => {
            expect(await matchQuads('property_path_plus')).toBe(true);
        });

        it('+ zero-or-one path', async () => {
            expect(await matchQuads('property_path_optional')).toBe(true);
        });

        it('+ negated property set', async () => {
            expect(await matchQuads('property_path_negated')).toBe(true);
        });

        it('+ combined path operators', async () => {
            expect(await matchQuads('property_path_combined')).toBe(true);
        });
    });

    describe('RDF 1.2 features', () => {
        it('+ triple term in expression', async () => {
            expect(await matchQuads('rdf12_triple_term')).toBe(true);
        });

        it('+ reified triple', async () => {
            expect(await matchQuads('rdf12_reified_triple')).toBe(true);
        });

        it('+ named reifier', async () => {
            expect(await matchQuads('rdf12_reifier')).toBe(true);
        });

        it('+ annotation block', async () => {
            expect(await matchQuads('rdf12_annotation')).toBe(true);
        });

        it('+ RDF 1.2 built-in functions', async () => {
            expect(await matchQuads('rdf12_builtin_functions')).toBe(true);
        });

        it('+ LANGDIR built-ins', async () => {
            expect(await matchQuads('rdf12_langdir')).toBe(true);
        });
    });

    describe('Updates', () => {
        it('+ ADD', async () => {
            expect(await matchQuads('update_add')).toBe(true);
        });

        it('+ CLEAR', async () => {
            expect(await matchQuads('update_clear')).toBe(true);
        });

        it('+ COPY', async () => {
            expect(await matchQuads('update_copy')).toBe(true);
        });

        it('+ CREATE', async () => {
            expect(await matchQuads('update_create')).toBe(true);
        });

        it('+ DELETE DATA', async () => {
            expect(await matchQuads('update_delete_data')).toBe(true);
        });

        it('+ DELETE WHERE', async () => {
            expect(await matchQuads('update_delete_where')).toBe(true);
        });

        it('+ DROP', async () => {
            expect(await matchQuads('update_drop')).toBe(true);
        });

        it('+ INSERT DATA', async () => {
            expect(await matchQuads('update_insert_data')).toBe(true);
        });

        it('+ INSERT DATA with GRAPH', async () => {
            expect(await matchQuads('update_insert_graph')).toBe(true);
        });

        it('+ LOAD', async () => {
            expect(await matchQuads('update_load')).toBe(true);
        });

        it('+ LOAD INTO', async () => {
            expect(await matchQuads('update_load_into')).toBe(true);
        });

        it('+ DELETE/INSERT', async () => {
            expect(await matchQuads('update_modify')).toBe(true);
        });

        it('+ DELETE/INSERT with WITH', async () => {
            expect(await matchQuads('update_modify_with')).toBe(true);
        });

        it('+ MOVE', async () => {
            expect(await matchQuads('update_move')).toBe(true);
        });

        it('+ update sequence', async () => {
            expect(await matchQuads('update_sequence')).toBe(true);
        });

        it('+ USING clauses', async () => {
            expect(await matchQuads('update_using')).toBe(true);
        });
    });

    describe('End-to-end', () => {
        it('+ complex query', async () => {
            expect(await matchQuads('complex_query')).toBe(true);
        });
    });

    describe('Structural assertions (independent of expected-RDF fixtures)', () => {
        const xsdInteger = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer');
        const rdfType = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

        const subjectsOf = (quads: Quad[], predicate: Term, object: Term) =>
            quads.filter(q => q.predicate.equals(predicate) && q.object.equals(object)).map(q => q.subject);

        it('complex_query has the expected structure', () => {
            const { quads, reader } = read(getTestData('file://./tests/complex_query.rq'));

            // The root is a typed SELECT query with LIMIT 100 and OFFSET 10.
            expect(reader.rootNode).not.toBeNull();
            expect(quads.some(q => q.subject.equals(reader.rootNode) && q.predicate.equals(rdfType) && q.object.equals(sparql.SelectQuery))).toBe(true);
            expect(quads.some(q => q.subject.equals(reader.rootNode) && q.predicate.equals(sparql.limit) && q.object.equals(dataFactory.literal('100', xsdInteger)))).toBe(true);
            expect(quads.some(q => q.subject.equals(reader.rootNode) && q.predicate.equals(sparql.offset) && q.object.equals(dataFactory.literal('10', xsdInteger)))).toBe(true);

            // The query uses exactly the variables x, y, age and email, each shared.
            const variableNodes = subjectsOf(quads, rdfType, sparql.Variable);
            const variableNames = quads.filter(q => q.predicate.equals(sparql.varName)).map(q => q.object.value).sort();
            expect(variableNodes.length).toBe(4);
            expect(variableNames).toEqual(['age', 'email', 'x', 'y']);

            // FILTER (?age >= 18 && ?age <= 65) produces And(Geq(age, 18), Leq(age, 65)).
            const geq = subjectsOf(quads, rdfType, sparql.Geq);
            expect(geq.length).toBe(1);
            expect(quads.some(q => q.subject.equals(geq[0]) && q.predicate.equals(sparql.arg2) && q.object.equals(dataFactory.literal('18', xsdInteger)))).toBe(true);
            expect(subjectsOf(quads, rdfType, sparql.And).length).toBe(1);
            expect(subjectsOf(quads, rdfType, sparql.Leq).length).toBe(1);
            expect(subjectsOf(quads, rdfType, sparql.Neq).length).toBe(1);

            // One OPTIONAL group containing a STRSTARTS filter.
            expect(subjectsOf(quads, rdfType, sparql.Optional).length).toBe(1);
            expect(quads.some(q => q.predicate.equals(sparql.function) && q.object.equals(sparql.STRSTARTS))).toBe(true);

            // ORDER BY DESC(?age) ?x: one Desc node over the age variable.
            const desc = subjectsOf(quads, rdfType, sparql.Desc);
            expect(desc.length).toBe(1);

            const age = quads.find(q => q.predicate.equals(sparql.varName) && q.object.value === 'age')!.subject;
            expect(quads.some(q => q.subject.equals(desc[0]) && q.predicate.equals(sparql.expression) && q.object.equals(age))).toBe(true);
        });

        it('variables are shared across query parts', () => {
            const { quads } = read('SELECT ?s WHERE { ?s ?p ?o . ?s ?q ?o }');

            const rdfTypeQuads = quads.filter(q => q.predicate.value.endsWith('#type') && q.object.equals(sparql.Variable));
            expect(rdfTypeQuads.length).toBe(4);

            const patternSubjects = quads.filter(q => q.predicate.equals(sparql.subject)).map(q => q.object.value);
            expect(new Set(patternSubjects).size).toBe(1);
        });

        it('labeled blank nodes are shared and labeled', () => {
            const { quads } = read('SELECT ?p WHERE { _:a ?p _:a }');

            const blankNodes = quads.filter(q => q.predicate.value.endsWith('#type') && q.object.equals(sparql.BlankNode));
            expect(blankNodes.length).toBe(1);
            expect(quads.some(q => q.predicate.equals(sparql.label) && q.object.value === 'a')).toBe(true);
        });
    });

    describe('Smoke tests: hand-crafted fixtures', () => {
        const testsDir = resolvePath('./tests');
        const fixtures = fs.readdirSync(testsDir).filter(file => file.endsWith('.rq')).sort();

        const rootTypes = [
            sparql.SelectQuery, sparql.ConstructQuery, sparql.DescribeQuery, sparql.AskQuery, sparql.Update
        ];

        const readsWithTypedRoot = (text: string) => {
            const { quads, reader } = read(text);

            expect(quads.length).toBeGreaterThan(0);
            expect(reader.rootNode).not.toBeNull();

            const typeQuads = quads.filter(q =>
                q.subject.equals(reader.rootNode) &&
                q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
            );

            expect(typeQuads.length).toBe(1);
            expect(rootTypes.some(type => typeQuads[0].object.equals(type))).toBe(true);
        };

        for (const fixture of fixtures) {
            it(`+ ${fixture}`, () => {
                readsWithTypedRoot(fs.readFileSync(path.join(testsDir, fixture), 'utf-8'));
            });
        }
    });

    describe('Smoke tests: W3C syntax test suites', () => {
        // Positive syntax test directories of the W3C SPARQL 1.2 test suite.
        // Queries that do not pass the parser (negative tests) are skipped;
        // every query the parser accepts must be readable.
        const suites = ['syntax', 'codepoint-escapes', 'syntax-triple-terms-positive', 'version'];

        for (const suite of suites) {
            const suiteDir = resolvePath(`./tests/w3c/${suite}`);

            if (!fs.existsSync(suiteDir)) {
                continue;
            }

            const files = fs.readdirSync(suiteDir).filter(file => file.endsWith('.rq')).sort();

            describe(suite, () => {
                for (const file of files) {
                    it(`+ ${file}`, () => {
                        const text = fs.readFileSync(path.join(suiteDir, file), 'utf-8');

                        let cst;

                        try {
                            const lexResult = lexer.tokenize(text);

                            if (lexResult.errors.length > 0) {
                                return;
                            }

                            cst = parser.parse(lexResult.tokens);
                        } catch {
                            // Not accepted by the parser (negative syntax test).
                            return;
                        }

                        const reader = new SparqlReader();
                        const quads = reader.visit(cst) as Quad[];

                        expect(quads.length).toBeGreaterThan(0);
                        expect(reader.rootNode).not.toBeNull();
                    });
                }
            });
        }
    });

    describe('Root IRI', () => {
        const readWithRootIri = (text: string, rootIri: string) => {
            const lexResult = lexer.tokenize(text);
            const cst = parser.parse(lexResult.tokens);

            const reader = new SparqlReader();
            reader.rootIri = dataFactory.namedNode(rootIri);

            const quads = reader.visit(cst) as Quad[];

            return { quads, reader };
        }

        it('emits the root query node as the configured named node', () => {
            const rootIri = 'workspace:///queries/select.rq';
            const { quads, reader } = readWithRootIri('SELECT * WHERE { ?s ?p ?o }', rootIri);

            expect(reader.rootNode?.termType).toEqual('NamedNode');
            expect(reader.rootNode?.value).toEqual(rootIri);

            const typeQuad = quads.find(q => q.predicate.equals(sparql.where));

            expect(typeQuad?.subject.termType).toEqual('NamedNode');
            expect(typeQuad?.subject.value).toEqual(rootIri);
            expect(quads.some(q => q.subject.equals(reader.rootNode!) && q.object.equals(sparql.SelectQuery))).toBe(true);
        });

        it('emits the root update node as the configured named node', () => {
            const rootIri = 'workspace:///queries/update.rq';
            const { quads, reader } = readWithRootIri('INSERT DATA { <urn:s> <urn:p> "o" } ; CLEAR ALL', rootIri);

            expect(reader.rootNode?.termType).toEqual('NamedNode');
            expect(reader.rootNode?.value).toEqual(rootIri);
            expect(quads.some(q => q.subject.equals(reader.rootNode!) && q.object.equals(sparql.Update))).toBe(true);
        });

        it('keeps a blank root node when no root IRI is configured', () => {
            const { reader } = read('SELECT * WHERE { ?s ?p ?o }');

            expect(reader.rootNode?.termType).toEqual('BlankNode');
        });
    });

    describe('Vocabulary', () => {
        it('every term of the vocabulary module is defined in the ontology', async () => {
            const ontology = fs.readFileSync(resolvePath('../../vocab/sparql-syntax.ttl'), 'utf-8');
            const quads = await parseQuads(ontology);
            const subjects = new Set(quads.map(q => q.subject.value));

            for (const [name, term] of Object.entries(sparql)) {
                expect(subjects.has(term.value), `Missing ontology definition for sparql:${name}`).toBe(true);
            }
        });
    });
});
