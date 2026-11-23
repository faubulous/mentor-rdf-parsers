import type { BlankNode, NamedNode, Quad_Graph } from '@rdfjs/types';
import type { TokenType } from 'chevrotain';
import { RdfDataFactory } from '../data-factory.js';
import { RdfToken } from '../tokens.js';
import { TurtleQuadReader } from '../turtle/quad-reader.js';

/**
 * Reads RDF/JS quads straight from a TriG token stream, without building a syntax tree.
 *
 * It accepts the tokens of {@link TrigLexer} and emits the same quads as
 * `TrigReader.visit(TrigParser.parse(tokens))`: the statements of the default graph and of the
 * graph blocks, with the blank node ids the lexer assigned to the tokens. {@link read} stops at
 * the first error; {@link readStatements} skips the statements that have errors. A broken
 * statement inside a graph block is skipped up to its period or the end of the block, and the
 * block goes on in its graph; a block that is not closed is dropped with everything after it.
 */
export class TrigQuadReader extends TurtleQuadReader {
    /**
     * Reads one directive, graph block, or triples block of the default graph.
     */
    protected override _readStatement(): void {
        if (this._readDirective()) {
            return;
        }

        const type = this._peekType();

        if (type === RdfToken.GRAPH) {
            this._advance();
            this._readWrappedGraph(this._readGraphLabel());
        } else if (type === RdfToken.LCURLY) {
            this._readWrappedGraph(RdfDataFactory.defaultGraph());
        } else if (this._startsLabelledGraph(type)) {
            this._readWrappedGraph(this._readGraphLabel());
        } else {
            this._readTriples();
            this._consume(RdfToken.PERIOD);
        }
    }

    /**
     * Whether a token can only begin a statement: the keywords of the directives and `GRAPH`.
     * @param type The type of the token.
     * @returns `true` for the keyword of a directive or of a graph block.
     */
    protected override _beginsStatement(type: TokenType): boolean {
        return type === RdfToken.GRAPH || super._beginsStatement(type);
    }

    /**
     * Whether a token ends a triples block: a period, or the end of the graph block it is in.
     * @param type The type of the token.
     * @returns `true` for a period or a closing brace.
     */
    protected override _endsTriples(type: TokenType | undefined): boolean {
        return type === RdfToken.PERIOD || type === RdfToken.RCURLY;
    }

    /**
     * The index to resume at after a statement outside the graph blocks had an error: after the
     * next period outside any block, after the block that is open at the error, or at the next
     * directive or `GRAPH` keyword outside any block. Reading never resumes inside a block, whose
     * statements would otherwise be read into the default graph.
     * @param errorIndex The index of the token at which the error occurred.
     * @returns The index to resume at; the end of the tokens when nothing follows.
     */
    protected override _resumeIndexAfterError(errorIndex: number): number {
        let depth = 0;

        for (let index = errorIndex; index < this._tokens.length; index++) {
            const type = this._tokens[index].tokenType;

            if (type === RdfToken.LCURLY) {
                depth++;
            } else if (type === RdfToken.RCURLY) {
                if (depth <= 1) {
                    return index + 1;
                }

                depth--;
            } else if (depth === 0 && type === RdfToken.PERIOD) {
                return index + 1;
            } else if (depth === 0 && this._beginsStatement(type)) {
                return index;
            }
        }

        return this._tokens.length;
    }

    /**
     * Whether the current token is the label of a graph block: an IRI, a blank node label or
     * `[]`, followed by `{`.
     * @param type The type of the current token.
     * @returns `true` when a labelled graph block begins here.
     */
    private _startsLabelledGraph(type: TokenType | undefined): boolean {
        switch (type) {
            case RdfToken.IRIREF:
            case RdfToken.PNAME_LN:
            case RdfToken.PNAME_NS:
            case RdfToken.BLANK_NODE_LABEL:
                return this._peekType(1) === RdfToken.LCURLY;
            case RdfToken.LBRACKET:
                return this._peekType(1) === RdfToken.RBRACKET && this._peekType(2) === RdfToken.LCURLY;
            default:
                return false;
        }
    }

    /**
     * Reads the label of a graph: an IRI or a blank node.
     * @returns The graph.
     */
    private _readGraphLabel(): NamedNode | BlankNode {
        const type = this._peekType();

        if (type === RdfToken.BLANK_NODE_LABEL || type === RdfToken.LBRACKET) {
            return this._readBlankNode();
        }

        return this._readIri();
    }

    /**
     * Reads `{ triplesBlock? }` and emits its quads into a graph. While reading statement by
     * statement, a broken triples block is skipped and the graph block goes on.
     * @param graph The graph of the block.
     */
    private _readWrappedGraph(graph: Quad_Graph): void {
        this._consume(RdfToken.LCURLY);

        const outer = this._graph;

        this._graph = graph;

        try {
            while (this._peekType() !== RdfToken.RCURLY) {
                if (this._peekType() === undefined) {
                    throw this._unexpected("'}'");
                }

                const checkpoint = this._checkpoint();

                try {
                    this._readTriplesInGraph();
                } catch (error) {
                    this._recoverFrom(error, checkpoint, errorIndex => this._resumeIndexInGraph(errorIndex));
                }
            }

            this._consume(RdfToken.RCURLY);
        } finally {
            this._graph = outer;
        }
    }

    /**
     * Reads a triples block of a graph block with the period after it, which the last block
     * may leave out.
     */
    private _readTriplesInGraph(): void {
        this._readTriples();

        const type = this._peekType();

        if (type === RdfToken.PERIOD) {
            this._advance();
        } else if (type !== RdfToken.RCURLY) {
            throw this._unexpected("'.' or '}'");
        }
    }

    /**
     * The index to resume at after a triples block inside a graph block had an error: after
     * its period, or at the brace that closes the graph block.
     * @param errorIndex The index of the token at which the error occurred.
     * @returns The index to resume at; the end of the tokens when the block is not closed.
     */
    private _resumeIndexInGraph(errorIndex: number): number {
        let depth = 0;

        for (let index = errorIndex; index < this._tokens.length; index++) {
            const type = this._tokens[index].tokenType;

            if (type === RdfToken.LCURLY) {
                depth++;
            } else if (type === RdfToken.RCURLY) {
                if (depth === 0) {
                    return index;
                }

                depth--;
            } else if (depth === 0 && type === RdfToken.PERIOD) {
                return index + 1;
            }
        }

        return this._tokens.length;
    }
}
