import type { Quad_Graph } from '@rdfjs/types';
import { RdfDataFactory } from '../data-factory.js';
import { RdfToken } from '../tokens.js';
import { NTriplesQuadReader } from '../ntriples/quad-reader.js';

/**
 * Reads RDF/JS quads straight from an N-Quads token stream, without building a syntax tree.
 *
 * It accepts the tokens of {@link NQuadsLexer} and emits the same quads as
 * `NQuadsReader.visit(NQuadsParser.parse(tokens))`: an N-Triples statement with an optional
 * graph label. {@link read} stops at the first error; {@link readStatements} skips the lines that
 * have errors and reads the others.
 */
export class NQuadsQuadReader extends NTriplesQuadReader {
    /**
     * Reads the graph label of a statement: an IRI or a blank node label, else the default graph.
     * @returns The graph.
     */
    protected override _readGraphLabel(): Quad_Graph {
        switch (this._peekType()) {
            case RdfToken.IRIREF_ABS:
                return this._readIri();
            case RdfToken.BLANK_NODE_LABEL:
                return this._readBlankNode();
            default:
                return RdfDataFactory.defaultGraph();
        }
    }
}
