import * as n3 from 'n3';
import dataFactory from '@rdfjs/data-model';
import type { Quad, Term, NamedNode, BlankNode, Literal, Quad_Object } from '@rdfjs/types';

export function parseQuads(input: string): Promise<Quad[]> {
    return new Promise((resolve, reject) => {
        const quads: Quad[] = [];

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

interface CanonicalTerm {
    termType: string;
    value: string;
    language?: string;
    datatype?: string;
    subject?: CanonicalTerm | null;
    predicate?: CanonicalTerm | null;
    object?: CanonicalTerm | null;
    graph?: CanonicalTerm | null;
}

interface CanonicalQuad {
    subject: CanonicalTerm | null;
    predicate: CanonicalTerm | null;
    object: CanonicalTerm | null;
    graph: CanonicalTerm | null;
}

/**
 * Compare two lists of RDF quads, ignoring differences in blank node labels.
 * Returns true if they match as sets, otherwise false.
 */
export function quadsMatch(quadsA: Quad[], quadsB: Quad[]): boolean {
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

function nodesMatch(nodeA: CanonicalTerm | null, nodeB: CanonicalTerm | null): boolean {
    if (nodeA === null && nodeB === null) return true;
    if (nodeA === null || nodeB === null) return false;

    if (nodeA.termType !== nodeB.termType || nodeA.value !== nodeB.value) {
        return false;
    }

    if (nodeA.termType === 'Literal' && (nodeA.datatype !== nodeB.datatype || nodeA.language !== nodeB.language)) {
        return false;
    }

    // Support triple terms (Quad used as a term)
    if (nodeA.termType === 'Quad') {
        return nodesMatch(nodeA.subject ?? null, nodeB.subject ?? null) &&
               nodesMatch(nodeA.predicate ?? null, nodeB.predicate ?? null) &&
               nodesMatch(nodeA.object ?? null, nodeB.object ?? null);
    }

    return true;
}

/**
 * Convert every blank node in a set of quads to a deterministic local label
 * (_:b0, _:b1, etc.), then sort them so they can be compared as sets.
 */
function canonicalizeQuadSet(quads: Quad[]): CanonicalQuad[] {
    const bnodeMap = new Map<string, string>();
    let nextId = 0;

    const canonicalized = quads.map(q => canonicalizeQuad(q, bnodeMap, () => nextId++));

    // Sort by stringified form so set comparison is consistent
    canonicalized.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    // Deduplicate (RDF is a set of triples)
    const deduped: CanonicalQuad[] = [];
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
function canonicalizeQuad(quad: Quad, bnodeMap: Map<string, string>, getNextId: () => number): CanonicalQuad {
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
function canonicalizeTerm(term: Term | null | undefined, bnodeMap: Map<string, string>, getNextId: () => number): CanonicalTerm | null {
    if (!term) {
        return null;
    }

    if (term.termType === 'BlankNode') {
        if (!bnodeMap.has(term.value)) {
            bnodeMap.set(term.value, `_b${getNextId()}`);
        }

        return { termType: 'BlankNode', value: bnodeMap.get(term.value)! };
    } else if (term.termType === 'Quad') {
        // Triple term: recursively canonicalize its components
        const quadTerm = term as Quad;
        return {
            termType: 'Quad',
            value: '',
            subject: canonicalizeTerm(quadTerm.subject, bnodeMap, getNextId),
            predicate: canonicalizeTerm(quadTerm.predicate, bnodeMap, getNextId),
            object: canonicalizeTerm(quadTerm.object, bnodeMap, getNextId),
            graph: quadTerm.graph ? canonicalizeTerm(quadTerm.graph, bnodeMap, getNextId) : null
        };
    } else {
        // Copy over relevant fields (e.g. datatype if it's a Literal)
        const literal = term as Literal;
        return {
            termType: term.termType,
            value: term.value,
            language: literal.language,
            datatype: literal.datatype?.value
        };
    }
}

/**
 * Parse RDF 1.2 N-Triples/N-Quads content that may contain triple terms <<( s p o )>>.
 * Returns an array of RDF/JS quads.
 */
export function parseNTriples12(input: string): Quad[] {
    const quads: Quad[] = [];
    const lines = input.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        // Skip VERSION directives
        if (/^VERSION\s+/i.test(trimmed)) continue;

        const parser = new NT12LineParser(trimmed);
        const subject = parser.parseTerm() as NamedNode | BlankNode;
        parser.skipWS();
        const predicate = parser.parseTerm() as NamedNode;
        parser.skipWS();
        const object = parser.parseTerm() as Quad_Object;
        parser.skipWS();

        // Check for optional graph label (N-Quads)
        let graph: NamedNode | BlankNode | undefined = undefined;
        if (parser.peek() && parser.peek() !== '.') {
            graph = parser.parseTerm() as NamedNode | BlankNode;
            parser.skipWS();
        }

        // Consume trailing '.'
        if (parser.peek() === '.') {
            parser.advance();
        }

        quads.push(dataFactory.quad(subject, predicate, object, graph));
    }

    return quads;
}

class NT12LineParser {
    private input: string;
    private pos: number;

    constructor(input: string) {
        this.input = input;
        this.pos = 0;
    }

    peek(): string | null {
        return this.pos < this.input.length ? this.input[this.pos] : null;
    }

    advance(): string {
        return this.input[this.pos++];
    }

    skipWS(): void {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.pos++;
        }
    }

    parseTerm(): Term {
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

    parseIRI(): NamedNode {
        if (this.advance() !== '<') throw new Error('Expected <');

        let iri = '';
        while (this.peek() !== '>') {
            iri += this.advance();
        }
        this.advance(); // consume >

        return dataFactory.namedNode(iri);
    }

    parseBlankNode(): BlankNode {
        // _:label
        this.advance(); // _
        this.advance(); // :

        let label = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_.-]/.test(this.peek()!)) {
            label += this.advance();
        }

        return dataFactory.blankNode(label);
    }

    parseLiteral(): Literal {
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
            while (this.pos < this.input.length && /[a-zA-Z0-9-]/.test(this.peek()!)) {
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

    parseTripleTerm(): Quad {
        // <<( s p o )>>
        this.pos += 3; // consume <<(
        this.skipWS();

        const subject = this.parseTerm() as NamedNode | BlankNode;
        this.skipWS();
        const predicate = this.parseTerm() as NamedNode;
        this.skipWS();
        const object = this.parseTerm() as Quad_Object;
        this.skipWS();

        // consume )>>
        if (this.input.substring(this.pos, this.pos + 3) !== ')>>') {
            throw new Error(`Expected )>> at position ${this.pos} in: ${this.input}`);
        }
        this.pos += 3;

        return dataFactory.quad(subject, predicate, object);
    }
}
