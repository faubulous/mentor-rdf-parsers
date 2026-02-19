import * as n3 from 'n3';

export function parseQuads(input) {
    return new Promise((resolve, reject) => {
        let quads = [];

        new n3.Parser({}).parse(input, (error, quad, done) => {
            if (error) {
                reject(error);
            }

            if (quad) {
                quads.push(quad);
            }

            if (done) {
                resolve(quads);
            }
        });
    });
}
/**
 * Compare two lists of RDF quads, ignoring differences in blank node labels.
 * Returns true if they match as sets, otherwise false.
 */
export function quadsMatch(quadsA, quadsB) {
    const c1 = canonicalizeQuadSet(quadsA);
    const c2 = canonicalizeQuadSet(quadsB);

    if (c1.length !== c2.length) {
        return false;
    }

    for (let i = 0; i < c1.length; i++) {
        const a = c1[i];
        const b = c2[i];

        if (!nodesMatch(a.subject, b.subject) ||
            !nodesMatch(a.predicate, b.predicate) ||
            !nodesMatch(a.object, b.object) ||
            !nodesMatch(a.graph, b.graph)) {
            return false;
        }
    }

    return true;
}

function nodesMatch(nodeA, nodeB) {
    if (nodeA.termType !== nodeB.termType || nodeA.value !== nodeB.value) {
        return false;
    }

    if (nodeA.termType === 'Literal' && (nodeA.datatype !== nodeB.datatype || nodeA.language !== nodeB.language)) {
        return false;
    }

    return true;
}

/**
 * Convert every blank node in a set of quads to a deterministic local label
 * (_:b0, _:b1, etc.), then sort them so they can be compared as sets.
 */
function canonicalizeQuadSet(quads) {
    const bnodeMap = new Map();
    let nextId = 0;

    const canonicalized = quads.map(q => canonicalizeQuad(q, bnodeMap, () => nextId++));

    // Sort by stringified form so set comparison is consistent
    canonicalized.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    return canonicalized;
}

/**
 * Create a "canonical" version of a single quad (subject, predicate, object, graph).
 */
function canonicalizeQuad(quad, bnodeMap, getNextId) {
    return {
        subject: canonicalizeTerm(quad.subject, bnodeMap, getNextId),
        predicate: canonicalizeTerm(quad.predicate, bnodeMap, getNextId),
        object: canonicalizeTerm(quad.object, bnodeMap, getNextId),
        graph: quad.graph ? canonicalizeTerm(quad.graph, bnodeMap, getNextId) : null
    };
}

/**
 * Convert a single term's blank node labels into a stable local label.
 */
function canonicalizeTerm(term, bnodeMap, getNextId) {
    if (term.termType === 'BlankNode') {
        if (!bnodeMap.has(term.value)) {
            bnodeMap.set(term.value, `_b${getNextId()}`);
        }

        return { termType: 'BlankNode', value: bnodeMap.get(term.value) };
    } else {
        // Copy over relevant fields (e.g. datatype if it's a Literal)
        return {
            termType: term.termType,
            value: term.value,
            language: term.language,
            datatype: term.datatype?.value
        };
    }
}