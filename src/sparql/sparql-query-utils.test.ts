import * as fs from 'fs';
import { extractFromClauseGraphUris } from './sparql-query-utils.js';

describe('extractFromClauseGraphUris', () => {
    const load = (file: string): string => {
        const resolved = new URL(`./tests/${file}`, import.meta.url).pathname;
        return fs.readFileSync(resolved, 'utf-8');
    };

    // Edge cases — empty / falsy input

    it('should return empty array for undefined input', () => {
        expect(extractFromClauseGraphUris(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
        expect(extractFromClauseGraphUris('')).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
        expect(extractFromClauseGraphUris('   \n\t  ')).toEqual([]);
    });

    // No FROM clauses

    it('should return empty array when query has no FROM clause', () => {
        expect(extractFromClauseGraphUris(load('select_star.rq'))).toEqual([]);
    });

    it('should return empty array for a CONSTRUCT query without FROM', () => {
        expect(extractFromClauseGraphUris(load('construct_basic.rq'))).toEqual([]);
    });

    it('should return empty array for an ASK query without FROM', () => {
        expect(extractFromClauseGraphUris(load('ask_basic.rq'))).toEqual([]);
    });

    // Single FROM clause

    it('should extract graph IRI from a single FROM clause', () => {
        expect(extractFromClauseGraphUris(load('from_clause.rq'))).toEqual([
            'http://example.org/graph1',
        ]);
    });

    it('should extract graph IRI from a CONSTRUCT query with a single FROM clause', () => {
        expect(extractFromClauseGraphUris(load('construct_from.rq'))).toEqual([
            'http://example.org/graph',
        ]);
    });

    // FROM NAMED clause

    it('should extract graph IRI from a FROM NAMED clause', () => {
        expect(extractFromClauseGraphUris(load('from_named.rq'))).toEqual([
            'http://example.org/graph1',
        ]);
    });

    // Multiple FROM / FROM NAMED clauses

    it('should extract all graph IRIs from multiple FROM clauses', () => {
        expect(extractFromClauseGraphUris(load('from_multiple.rq'))).toEqual([
            'http://example.org/graph-a',
            'http://example.org/graph-b',
        ]);
    });

    it('should extract graph IRIs from mixed FROM and FROM NAMED clauses', () => {
        expect(extractFromClauseGraphUris(load('from_mixed.rq'))).toEqual([
            'http://example.org/default',
            'http://example.org/named',
        ]);
    });

    // Deduplication

    it('should deduplicate repeated graph IRIs', () => {
        expect(extractFromClauseGraphUris(load('from_duplicate.rq'))).toEqual([
            'http://example.org/graph',
        ]);
    });

    it('should deduplicate identical IRIs across FROM and FROM NAMED', () => {
        const query = `
            SELECT ?s ?p ?o
            FROM <http://example.org/g>
            FROM NAMED <http://example.org/g>
            WHERE { ?s ?p ?o }
        `;
        expect(extractFromClauseGraphUris(query)).toEqual([
            'http://example.org/g',
        ]);
    });

    // Inline query variations

    it('should be case-insensitive for FROM keyword', () => {
        const query = `SELECT ?s FROM <http://example.org/g> WHERE { ?s ?p ?o }`;
        expect(extractFromClauseGraphUris(query)).toEqual(['http://example.org/g']);
    });

    it('should be case-insensitive for FROM NAMED keyword', () => {
        const query = `SELECT ?s from named <http://example.org/g> WHERE { GRAPH <http://example.org/g> { ?s ?p ?o } }`;
        expect(extractFromClauseGraphUris(query)).toEqual(['http://example.org/g']);
    });

    it('should preserve insertion order for multiple distinct FROM clauses', () => {
        const query = `
            SELECT *
            FROM <http://example.org/z>
            FROM <http://example.org/a>
            WHERE { ?s ?p ?o }
        `;
        expect(extractFromClauseGraphUris(query)).toEqual([
            'http://example.org/z',
            'http://example.org/a',
        ]);
    });

    it('should ignore FROM inside string literals', () => {
        const query = `SELECT ("FROM <http://not-a-clause>" AS ?x) WHERE { ?s ?p ?o }`;
        expect(extractFromClauseGraphUris(query)).toEqual([]);
    });
});
