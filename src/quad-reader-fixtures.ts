import * as fs from 'fs';
import * as path from 'path';
import type { Quad, Term } from '@rdfjs/types';
import type { CstNode, IToken } from 'chevrotain';
import { QuadReaderError } from './quad-reader-error.js';
import type { StatementQuadReader } from './statement-quad-reader.js';

/**
 * Test helpers of the quad readers: the W3C fixture files of a syntax, and renderings of quads
 * that compare two readers exactly.
 */

/**
 * Lists the fixture files with an extension in one directory below a fixtures root.
 * @param root The absolute path of the fixtures root.
 * @param directory The directory relative to the root.
 * @param extension The file extension, with its dot.
 * @returns The paths of the files relative to the root, sorted.
 */
export function listFixtures(root: string, directory: string, extension: string): string[] {
    return fs.readdirSync(path.join(root, directory))
        .filter(name => name.endsWith(extension))
        .map(name => path.join(directory, name))
        .sort();
}

/**
 * Reads a fixture file.
 * @param root The absolute path of the fixtures root.
 * @param relativePath The path of the file relative to the root.
 * @returns The text of the file.
 */
export function readFixture(root: string, relativePath: string): string {
    return fs.readFileSync(path.join(root, relativePath), 'utf-8');
}

/**
 * Renders a term so that equal terms, including blank node ids and triple terms, render equally.
 * @param term The term.
 * @returns The rendering.
 */
export function termKey(term: Term): string {
    switch (term.termType) {
        case 'Literal':
            return `"${term.value}"@${term.language}^^${term.datatype.value}`;
        case 'Quad':
            return `<<${termKey(term.subject)} ${termKey(term.predicate)} ${termKey(term.object)}>>`;
        default:
            return `${term.termType}:${term.value}`;
    }
}

/**
 * Renders quads in order, one line each, for exact comparison.
 * @param quads The quads.
 * @returns One rendering per quad, including its graph.
 */
export function quadKeys(quads: Quad[]): string[] {
    return quads.map(quad => `${termKey(quad.subject)} ${termKey(quad.predicate)} ${termKey(quad.object)} ${termKey(quad.graph)}`);
}

/**
 * Renders quads in order with blank nodes numbered by first occurrence, so that two readers
 * agree when they emit the same statements in the same order with consistently mapped ids.
 * @param quads The quads.
 * @returns One rendering per quad.
 */
export function relabeledQuadKeys(quads: Quad[]): string[] {
    const labels = new Map<string, string>();

    return quadKeys(quads).map(key => key.replace(/BlankNode:([^ >]+)/g, (_, id) => {
        let label = labels.get(id);

        if (label === undefined) {
            label = `BlankNode:#${labels.size}`;
            labels.set(id, label);
        }

        return label;
    }));
}

/**
 * A syntax whose quad reader is checked against its syntax tree reader.
 */
export interface SyntaxUnderTest {
    /**
     * Tokenizes a text with the lexer of the syntax.
     */
    tokenize(text: string): { tokens: IToken[]; errors: unknown[] };

    /**
     * Parses tokens into a syntax tree without throwing, and tells whether the parser accepted them.
     */
    parse(tokens: IToken[]): { cst: CstNode; accepted: boolean };

    /**
     * Reads the quads of a syntax tree with the syntax tree reader.
     */
    visit(cst: CstNode): Quad[];

    /**
     * Creates the quad reader of the syntax.
     */
    createQuadReader(): StatementQuadReader;
}

/**
 * Expects the quad reader of a syntax to read a text as the syntax tree reader does: the same
 * quads in the same order with the same blank node ids, and an error wherever the parser rejects
 * the text. A text the lexer cannot tokenize is not checked.
 * @param syntax The syntax.
 * @param text The text.
 */
export function expectSameQuadsAsSyntaxTreeReader(syntax: SyntaxUnderTest, text: string): void {
    const lexed = syntax.tokenize(text);

    if (lexed.errors.length > 0) {
        return;
    }

    const { cst, accepted } = syntax.parse(lexed.tokens);

    let quads: Quad[] | undefined;
    let error: unknown;

    try {
        quads = syntax.createQuadReader().read(lexed.tokens);
    } catch (thrown) {
        error = thrown;
    }

    if (!accepted) {
        expect(error).toBeInstanceOf(QuadReaderError);

        return;
    }

    expect(error).toBeUndefined();
    expect(quadKeys(quads!)).toEqual(quadKeys(syntax.visit(cst)));
}
