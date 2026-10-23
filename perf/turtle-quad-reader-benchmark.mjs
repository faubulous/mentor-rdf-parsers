// Times the two ways from Turtle tokens to quads on a generated ontology.
// Run `npm run perf`; it builds the package first because it measures `dist/`.
import { performance } from 'node:perf_hooks';
import { TurtleLexer, TurtleParser, TurtleReader, TurtleQuadReader, createFileBlankNodeIdGenerator } from '../dist/index.js';

const CLASS_COUNT = Number.parseInt(process.env.PERF_CLASSES ?? '', 10) || 50000;
const RUNS = 3;

/**
 * Generates a Turtle ontology and times reading its quads from the token stream,
 * with the syntax tree reader and with the quad reader.
 */
class TurtleQuadReaderBenchmark {
    /**
     * @param classCount The number of classes to generate; each contributes four statements.
     */
    constructor(classCount) {
        this.text = this._generateOntology(classCount);
        this.quadCount = classCount * 4;
    }

    /**
     * Runs the benchmark and prints one line per measured step.
     */
    run() {
        const lexer = new TurtleLexer(createFileBlankNodeIdGenerator('file:///perf.ttl'));
        const tokens = lexer.tokenize(this.text).tokens;
        const parser = new TurtleParser();

        console.log(`${this.quadCount} quads, ${(this.text.length / 1e6).toFixed(1)} MB, best of ${RUNS} runs`);

        this._time('tokenize', () => lexer.tokenize(this.text));
        this._time('TurtleParser + TurtleReader', () => new TurtleReader().visit(parser.parse(tokens, false)));
        this._time('TurtleQuadReader', () => new TurtleQuadReader().read(tokens));
    }

    /**
     * Prints the best wall-clock time of a step over the configured runs.
     * @param label The name of the step.
     * @param step The step to time.
     */
    _time(label, step) {
        let best = Infinity;

        for (let run = 0; run < RUNS; run++) {
            global.gc?.();

            const start = performance.now();

            step();

            best = Math.min(best, performance.now() - start);
        }

        console.log(`${label.padEnd(30)} ${best.toFixed(0).padStart(6)} ms`);
    }

    /**
     * Generates an ontology in which each class contributes a type assertion,
     * a subclass axiom, a language-tagged label and a comment.
     * @param classCount The number of classes.
     */
    _generateOntology(classCount) {
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
}

new TurtleQuadReaderBenchmark(CLASS_COUNT).run();
