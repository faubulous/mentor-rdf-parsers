import type { BlankNode, Literal, NamedNode, Quad, Quad_Graph, Quad_Object, Quad_Subject } from '@rdfjs/types';
import type { TokenType } from 'chevrotain';
import { RdfDataFactory } from '../data-factory.js';
import { RdfToken } from '../tokens.js';
import { getBlankNodeIdFromToken } from '../utils.js';
import { getLanguageTag, unescapeIriReference, unescapeRdfString } from '../reader-helpers.js';
import { StatementQuadReader } from '../statement-quad-reader.js';

/**
 * Reads RDF/JS quads straight from an N-Triples token stream, without building a syntax tree.
 *
 * It accepts the tokens of {@link NTriplesLexer} and emits the same quads as
 * `NTriplesReader.visit(NTriplesParser.parse(tokens))`, with the blank node ids the lexer
 * assigned to the tokens. {@link read} stops at the first error; {@link readStatements} skips
 * the lines that have errors and reads the others.
 */
export class NTriplesQuadReader extends StatementQuadReader {
    /**
     * Reads one triple with its period, or a version directive.
     */
    protected _readStatement(): void {
        if (this._peekType() === RdfToken.SPARQL_VERSION) {
            this._advance();
            this._consume(RdfToken.STRING_LITERAL_QUOTE);

            return;
        }

        const subject = this._readSubject();
        const predicate = this._readIri();
        const object = this._readObject();
        const graph = this._readGraphLabel();

        this._consume(RdfToken.PERIOD);
        this._quads.push(RdfDataFactory.quad(subject, predicate, object, graph));
    }

    /**
     * Whether a token can only begin a statement: the keyword of the version directive.
     * @param type The type of the token.
     * @returns `true` for `VERSION`.
     */
    protected _beginsStatement(type: TokenType): boolean {
        return type === RdfToken.SPARQL_VERSION;
    }

    /**
     * Reads the graph of a statement, which N-Triples does not write: the default graph.
     * @returns The default graph.
     */
    protected _readGraphLabel(): Quad_Graph {
        return RdfDataFactory.defaultGraph();
    }

    /**
     * Reads a subject: an IRI or a blank node label.
     * @returns The subject.
     */
    protected _readSubject(): NamedNode | BlankNode {
        if (this._peekType() === RdfToken.BLANK_NODE_LABEL) {
            return this._readBlankNode();
        }

        return this._readIri();
    }

    /**
     * Reads an absolute IRI reference.
     * @returns The IRI.
     * @throws {QuadReaderError} When the current token is no IRI reference.
     */
    protected _readIri(): NamedNode {
        const token = this._consume(RdfToken.IRIREF_ABS);

        return RdfDataFactory.namedNode(unescapeIriReference(token.image.slice(1, -1)));
    }

    /**
     * Reads a blank node label, using the id the lexer assigned to it.
     * @returns The blank node.
     * @throws {QuadReaderError} When the current token is no blank node label.
     */
    protected _readBlankNode(): BlankNode {
        const token = this._consume(RdfToken.BLANK_NODE_LABEL);

        return RdfDataFactory.blankNode(getBlankNodeIdFromToken(token) ?? token.image.substring(2));
    }

    /**
     * Reads an object: an IRI, a blank node label, a literal or a triple term.
     * @returns The object.
     * @throws {QuadReaderError} When no object begins at the current token.
     */
    private _readObject(): Quad_Object {
        switch (this._peekType()) {
            case RdfToken.IRIREF_ABS:
                return this._readIri();
            case RdfToken.BLANK_NODE_LABEL:
                return this._readBlankNode();
            case RdfToken.OPEN_TRIPLE_TERM:
                return this._readTripleTerm();
            case RdfToken.STRING_LITERAL_QUOTE:
                return this._readLiteral();
            default:
                throw this._unexpected('an object');
        }
    }

    /**
     * Reads a string literal with an optional language tag or datatype.
     * @returns The literal.
     * @throws {QuadReaderError} When the current token is no string.
     */
    private _readLiteral(): Literal {
        const value = unescapeRdfString(this._consume(RdfToken.STRING_LITERAL_QUOTE).image.slice(1, -1));
        const type = this._peekType();

        if (type === RdfToken.LANGTAG) {
            return RdfDataFactory.literal(value, getLanguageTag(this._advance().image));
        } else if (type === RdfToken.DCARET) {
            this._advance();

            return RdfDataFactory.literal(value, this._readIri());
        }

        return RdfDataFactory.literal(value);
    }

    /**
     * Reads `<<( subject predicate object )>>` and returns it as a triple term.
     * @returns The triple term.
     */
    private _readTripleTerm(): Quad {
        this._consume(RdfToken.OPEN_TRIPLE_TERM);

        const subject: Quad_Subject = this._readSubject();
        const predicate = this._readIri();
        const object = this._readObject();

        this._consume(RdfToken.CLOSE_TRIPLE_TERM);

        return RdfDataFactory.quad(subject, predicate, object);
    }
}
