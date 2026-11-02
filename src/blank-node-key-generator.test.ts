import { describe, it, expect } from 'vitest';
import type { IToken } from 'chevrotain';
import type { Quad, Term } from '@rdfjs/types';
import { TurtleLexer, TurtleParser } from './turtle/parser.js';
import { TurtleReader } from './turtle/reader.js';
import { TurtleQuadReader } from './turtle/quad-reader.js';
import { TrigLexer, TrigParser } from './trig/parser.js';
import { TrigReader } from './trig/reader.js';
import { N3Lexer } from './n3/parser.js';
import { assignBlankNodeIds, BLANK_NODE_TOKEN_NAMES, createFileBlankNodeIdGenerator, getBlankNodeIdFromToken } from './utils.js';

const PREAMBLE = '@prefix ex: <http://example.org/> .\n';

const generator = () => createFileBlankNodeIdGenerator('file:///doc.ttl');

/**
 * The blank node ids of the tokens of a text, in token order.
 */
function idsOf(tokens: IToken[]): string[] {
    return tokens.filter(token => BLANK_NODE_TOKEN_NAMES.has(token.tokenType.name)).map(token => getBlankNodeIdFromToken(token)!);
}

/**
 * The blank node ids of a Turtle text.
 */
function turtleIds(text: string): string[] {
    return idsOf(new TurtleLexer(generator()).tokenize(PREAMBLE + text).tokens);
}

/**
 * The values of the blank nodes among the terms of quads, each once, in order.
 */
function blankNodesOf(quads: Quad[]): string[] {
    const terms: Term[] = quads.flatMap(quad => [quad.subject, quad.object, quad.graph]);

    return Array.from(new Set(terms.filter(term => term.termType === 'BlankNode').map(term => term.value))).sort();
}

describe('structural blank node ids', () => {
    const body = 'ex:s ex:p [ ex:q 1 ], [ ex:q 2 ] ; ex:r ( ex:a [ ex:q 3 ] ) .\n[ ex:q 4 ] ex:p ex:o .\n';

    it('keep the ids of the nodes after an anonymous node that is added before them', () => {
        const before = turtleIds(body);
        const after = turtleIds('ex:t ex:p [ ex:q 0 ] .\n' + body);

        expect(after.slice(1)).toEqual(before);
    });

    it('keep the ids of the nodes after an anonymous node that is removed before them', () => {
        const before = turtleIds('ex:t ex:p [ ex:q 0 ], [ ex:q 0 ] .\n' + body);
        const after = turtleIds('ex:t ex:p [ ex:q 0 ] .\n' + body);

        expect(after.slice(1)).toEqual(before.slice(2));
    });

    it('keep the ids of nested nodes when a statement is added to their parent', () => {
        const before = turtleIds('ex:s ex:p [ ex:q [ ex:r 1 ] ] .\n');
        const after = turtleIds('ex:s ex:x [ ex:y 0 ] ; ex:p [ ex:z [ ex:w 0 ] ; ex:q [ ex:r 1 ] ] .\n');

        expect(after[1]).toBe(before[0]);
        expect(after.slice(3)).toEqual([before[1]]);
    });

    it('keep the ids of annotations and reifiers when statements are added before them', () => {
        const body12 = 'ex:s ex:p ex:o ~ {| ex:a ex:b |} .\n<< ex:s ex:p ex:o >> ex:q ex:r .\n';
        const before = turtleIds(body12);
        const after = turtleIds('ex:t ex:p ex:o {| ex:a [ ex:b 0 ] |} .\n' + body12);

        expect(after.slice(2)).toEqual(before);
    });

    it('are unique within a document', () => {
        const ids = turtleIds(body + body + 'ex:s ex:p [ ] , ( ) , [ ex:p [ ] ] .\n');

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('keep the ids in a graph of TriG when a graph is added before it', () => {
        const graph = 'ex:g { ex:s ex:p [ ex:q 1 ] . [ ex:q 2 ] ex:p ex:o }\n{ ex:s ex:p [ ex:q 3 ] }\n';
        const lex = (text: string) => idsOf(new TrigLexer(generator()).tokenize(PREAMBLE + text).tokens);
        const before = lex(graph);
        const after = lex('ex:h { ex:s ex:p [ ex:q 0 ] }\n' + graph);

        expect(after.slice(2)).toEqual(before);
    });

    it('keep the ids in an N3 formula when a statement is added before it', () => {
        const formula = '{ ?x ex:p [ ex:q 1 ] } => { ?x ex:r [ ex:q 2 ] } .\n';
        const lex = (text: string) => idsOf(new N3Lexer(generator()).tokenize(PREAMBLE + text).tokens);
        const before = lex(formula);
        const after = lex('ex:s ex:p [ ex:q 0 ] .\n' + formula);

        expect(after.slice(1)).toEqual(before);
    });

    it('are given a suffix when the hashes of two keys collide', () => {
        const tokens = new TurtleLexer(null).tokenize('ex:s ex:p [ ], [ ], [ ] .').tokens;

        assignBlankNodeIds(tokens, () => 'same', 'turtle');

        expect(idsOf(tokens)).toEqual(['same', 'same_1', 'same_2']);
    });

    it('are the ids all readers give the blank nodes of Turtle', () => {
        const tokens = new TurtleLexer(generator()).tokenize(PREAMBLE + body + 'ex:s ex:p [], [ ex:q [] ] .\n').tokens;
        const cst = new TurtleParser().parse(tokens);
        const read = blankNodesOf(new TurtleQuadReader().read(tokens));

        expect(blankNodesOf(new TurtleReader().visit(cst))).toEqual(read);
        expect(blankNodesOf(new TurtleReader().readQuadContexts(cst, tokens) as Quad[])).toEqual(read);
        expect(idsOf(tokens)).toEqual(expect.arrayContaining(read.filter(id => !id.includes('-rest-'))));
    });

    it('are the ids all readers give the blank nodes of TriG, labelled ones included', () => {
        const tokens = new TrigLexer(generator()).tokenize(PREAMBLE + 'ex:g { ex:s ex:p [ ex:q 1 ], _:x . _:x ex:p [] }\n').tokens;
        const cst = new TrigParser().parse(tokens);
        const read = blankNodesOf(new TrigReader().visit(cst));

        expect(blankNodesOf(new TrigReader().readQuadContexts(cst) as Quad[])).toEqual(read);
        expect(idsOf(tokens)).toEqual(expect.arrayContaining(read));
    });
});
