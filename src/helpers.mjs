import * as n3 from 'n3';
import dataFactory from '@rdfjs/data-model';

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

    // Support triple terms (Quad used as a term)
    if (nodeA.termType === 'Quad') {
        return nodesMatch(nodeA.subject, nodeB.subject) &&
               nodesMatch(nodeA.predicate, nodeB.predicate) &&
               nodesMatch(nodeA.object, nodeB.object);
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

    // Deduplicate (RDF is a set of triples)
    const deduped = [];
    for (let i = 0; i < canonicalized.length; i++) {
        if (i === 0 || JSON.stringify(canonicalized[i]) !== JSON.stringify(canonicalized[i - 1])) {
            deduped.push(canonicalized[i]);
        }
    }

    return deduped;
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
    if (!term) {
        return null;
    }

    if (term.termType === 'BlankNode') {
        if (!bnodeMap.has(term.value)) {
            bnodeMap.set(term.value, `_b${getNextId()}`);
        }

        return { termType: 'BlankNode', value: bnodeMap.get(term.value) };
    } else if (term.termType === 'Quad') {
        // Triple term: recursively canonicalize its components
        return {
            termType: 'Quad',
            value: '',
            subject: canonicalizeTerm(term.subject, bnodeMap, getNextId),
            predicate: canonicalizeTerm(term.predicate, bnodeMap, getNextId),
            object: canonicalizeTerm(term.object, bnodeMap, getNextId),
            graph: term.graph ? canonicalizeTerm(term.graph, bnodeMap, getNextId) : null
        };
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

/**
 * Parse RDF 1.2 N-Triples content that may contain triple terms <<( s p o )>>.
 * Returns an array of RDF/JS quads.
 */
export function parseNTriples12(input) {
    const quads = [];
    const lines = input.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const parser = new NT12LineParser(trimmed);
        const subject = parser.parseTerm();
        parser.skipWS();
        const predicate = parser.parseTerm();
        parser.skipWS();
        const object = parser.parseTerm();
        parser.skipWS();

        // Consume trailing '.'
        if (parser.peek() === '.') {
            parser.advance();
        }

        quads.push(dataFactory.quad(subject, predicate, object));
    }

    return quads;
}

class NT12LineParser {
    constructor(input) {
        this.input = input;
        this.pos = 0;
    }

    peek() {
        return this.pos < this.input.length ? this.input[this.pos] : null;
    }

    advance() {
        return this.input[this.pos++];
    }

    skipWS() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.pos++;
        }
    }

    parseTerm() {
        this.skipWS();
        const ch = this.peek();

        if (ch === '<') {
            // Check for triple term <<( or reified triple <<
            if (this.input.substring(this.pos, this.pos + 3) === '<<(') {
                return this.parseTripleTerm();
            }
            return this.parseIRI();
        } else if (ch === '_') {
            return this.parseBlankNode();
        } else if (ch === '"') {
            return this.parseLiteral();
        }

        throw new Error(`Unexpected character '${ch}' at position ${this.pos} in: ${this.input}`);
    }

    parseIRI() {
        if (this.advance() !== '<') throw new Error('Expected <');

        let iri = '';
        while (this.peek() !== '>') {
            iri += this.advance();
        }
        this.advance(); // consume >

        return dataFactory.namedNode(iri);
    }

    parseBlankNode() {
        // _:label
        this.advance(); // _
        this.advance(); // :

        let label = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_.-]/.test(this.peek())) {
            label += this.advance();
        }

        return dataFactory.blankNode(label);
    }

    parseLiteral() {
        this.advance(); // opening "

        let value = '';
        while (this.peek() !== '"') {
            if (this.peek() === '\\') {
                this.advance(); // backslash
                const esc = this.advance();
                switch (esc) {
                    case 'n': value += '\n'; break;
                    case 'r': value += '\r'; break;
                    case 't': value += '\t'; break;
                    case '\\': value += '\\'; break;
                    case '"': value += '"'; break;
                    case 'u': {
                        const hex = this.input.substring(this.pos, this.pos + 4);
                        this.pos += 4;
                        value += String.fromCodePoint(parseInt(hex, 16));
                        break;
                    }
                    case 'U': {
                        const hex = this.input.substring(this.pos, this.pos + 8);
                        this.pos += 8;
                        value += String.fromCodePoint(parseInt(hex, 16));
                        break;
                    }
                    default: value += esc;
                }
            } else {
                value += this.advance();
            }
        }
        this.advance(); // closing "

        // Check for language tag or datatype
        if (this.peek() === '@') {
            this.advance(); // @
            let lang = '';
            while (this.pos < this.input.length && /[a-zA-Z0-9-]/.test(this.peek())) {
                lang += this.advance();
            }
            return dataFactory.literal(value, lang);
        } else if (this.input.substring(this.pos, this.pos + 2) === '^^') {
            this.pos += 2; // ^^
            const dt = this.parseIRI();
            return dataFactory.literal(value, dt);
        }

        return dataFactory.literal(value);
    }

    parseTripleTerm() {
        // <<( s p o )>>
        this.pos += 3; // consume <<(
        this.skipWS();

        const subject = this.parseTerm();
        this.skipWS();
        const predicate = this.parseTerm();
        this.skipWS();
        const object = this.parseTerm();
        this.skipWS();

        // consume )>>
        if (this.input.substring(this.pos, this.pos + 3) !== ')>>') {
            throw new Error(`Expected )>> at position ${this.pos} in: ${this.input}`);
        }
        this.pos += 3;

        return dataFactory.quad(subject, predicate, object);
    }
}