import { bench, describe } from 'vitest';
import { createFileBlankNodeIdGenerator } from '../utils.js';
import { TurtleLexer, TurtleParser } from './parser.js';
import { TurtleReader } from './reader.js';
import { TurtleQuadReader } from './quad-reader.js';

/**
 * Generates a Turtle ontology in which each class contributes four statements:
 * a type assertion, a subclass axiom, a language-tagged label and a comment.
 * @param classCount The number of classes.
 */
function generateOntology(classCount: number): string {
    const lines = [
        '@prefix ex: <http://example.org/perf/> .',
        '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
        '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
        ''
    ];

    for (let index = 0; index < classCount; index++) {
        lines.push(`ex:Class${index} a owl:Class ;`);
        lines.push(`\trdfs:subClassOf ex:Class${Math.floor(index / 2)} ;`);
        lines.push(`\trdfs:label "Class ${index}"@en ;`);
        lines.push(`\trdfs:comment "A generated class with a comment of ordinary length." .`);
        lines.push('');
    }

    return lines.join('\n');
}

const text = generateOntology(10000);
const lexer = new TurtleLexer(createFileBlankNodeIdGenerator('file:///perf.ttl'));
const tokens = lexer.tokenize(text).tokens;
const parser = new TurtleParser();

describe('Turtle tokens to quads, 40k statements', () => {
    bench('TurtleParser + TurtleReader (syntax tree)', () => {
        new TurtleReader().visit(parser.parse(tokens, false));
    });

    bench('TurtleQuadReader (no syntax tree)', () => {
        new TurtleQuadReader().read(tokens);
    });
});
