import { sparqlVariableSymbols } from './sparql-variable-scope.js';

/**
 * Returns the co-referencing variable occurrences at the `nth` occurrence of
 * `marker` in `query`, by grouping the flat symbol list by `binding`. The offset
 * lands on the marker's first character, which is inside the variable token.
 */
function resolveAt(query: string, marker: string, nth = 1): { name: string; start: number; end: number }[] | null {
    let offset = -1;

    for (let i = 0; i < nth; i++) {
        offset = query.indexOf(marker, offset + 1);
    }

    const symbols = sparqlVariableSymbols(query);
    const hit = symbols.find(s => offset >= s.start && offset <= s.end);

    if (!hit) {
        return null;
    }

    return symbols.filter(s => s.binding === hit.binding);
}

describe('sparqlVariableSymbols', () => {
    it('renames every occurrence of a variable within one scope', () => {
        const query = 'SELECT ?x WHERE { ?x <urn:p> ?y . ?y <urn:q> ?x }';
        const result = resolveAt(query, '?x');

        // SELECT ?x + two body uses = three sites; ?y is untouched.
        expect(result?.length).toBe(3);
        expect(result?.every(o => o.name === 'x')).toBe(true);
    });

    it('treats OPTIONAL / UNION as the same scope (variables join)', () => {
        const query = 'SELECT ?x WHERE { { ?x <urn:p> ?y } UNION { ?x <urn:q> ?z } OPTIONAL { ?x <urn:r> ?w } }';
        const result = resolveAt(query, '?x');

        // SELECT + each branch = four sites.
        expect(result?.length).toBe(4);
    });

    it('isolates a non-projected sub-SELECT variable from a same-named outer one', () => {
        const query = 'SELECT ?x ?z WHERE { ?x <urn:p> ?z . { SELECT ?a WHERE { ?a <urn:q> ?z } } }';

        // Outer ?z: projection + body = two sites, not the inner ?z.
        expect(resolveAt(query, '?z', 1)?.length).toBe(2);

        // Inner ?z (3rd ?z occurrence): only itself.
        expect(resolveAt(query, '?z', 3)?.length).toBe(1);
    });

    it('bridges a projected sub-SELECT variable to its parent', () => {
        const query = 'SELECT ?x WHERE { ?x <urn:p> ?y . { SELECT ?x ?w WHERE { ?x <urn:q> ?w } } }';

        // Outer ?x (proj + body) + inner ?x (proj + body) = four sites.
        expect(resolveAt(query, '?x', 1)?.length).toBe(4);

        // Inner ?w (proj + body) stays isolated = two sites.
        expect(resolveAt(query, '?w', 1)?.length).toBe(2);
    });

    it('bridges all variables under SELECT *', () => {
        const query = 'SELECT ?x WHERE { ?x <urn:p> ?y . { SELECT * WHERE { ?x <urn:q> ?z } } }';
        const result = resolveAt(query, '?x', 1);

        // Outer ?x (proj + body) + inner ?x body = three sites.
        expect(result?.length).toBe(3);
    });

    it('treats ?x and $x as the same variable', () => {
        const query = 'SELECT ?x WHERE { ?x <urn:p> ?y . $x <urn:q> ?y }';
        const result = resolveAt(query, '?x');

        // SELECT ?x + body ?x + body $x all name the same variable.
        expect(result?.length).toBe(3);
        expect(result?.some(o => o.start === query.indexOf('$x'))).toBe(true);
    });

    it('keeps an AS alias separate from its expression variables', () => {
        const query = 'SELECT (COUNT(?w) AS ?c) WHERE { ?x <urn:p> ?w }';

        // The alias ?c is projected on its own.
        expect(resolveAt(query, '?c')?.length).toBe(1);

        // ?w: COUNT argument + body use = two sites.
        expect(resolveAt(query, '?w', 1)?.length).toBe(2);
    });

    it('returns null when the offset is not on a variable', () => {
        const query = 'SELECT ?x WHERE { ?x <urn:p> ?y }';
        const result = resolveAt(query, 'WHERE');

        expect(result).toBeNull();
    });
});
