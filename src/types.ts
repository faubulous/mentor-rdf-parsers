import type { IToken } from 'chevrotain';
import type { Quad, Quad_Subject, Quad_Predicate, Quad_Object, Quad_Graph, Term } from '@rdfjs/types';
import dataFactory from '@rdfjs/data-model';

/**
 * An extended RDF/JS Quad that includes source tokens for each component.
 * Implements the RDFJS Quad interface, so it can be used anywhere a Quad is expected,
 * while also providing document position information via the token properties.
 */
export interface QuadTokens extends Quad {
    /**
     * The token that defines the subject position in the source.
     */
    subjectToken: IToken;

    /**
     * The token that defines the predicate position in the source.
     */
    predicateToken: IToken;

    /**
     * The token that defines the object position in the source.
     */
    objectToken: IToken;

    /**
     * The token that defines the graph position in the source (for TriG/N-Quads).
     * Undefined for triples in the default graph.
     */
    graphToken?: IToken;
}

/**
 * Creates a QuadTokens instance from individual term and token components.
 * The resulting object is a proper RDFJS Quad with additional token metadata.
 */
export function toQuadTokens(
    subject: Term, subjectToken: IToken,
    predicate: Term, predicateToken: IToken,
    object: Term, objectToken: IToken,
    graph?: Term, graphToken?: IToken,
): QuadTokens {
    const quad = dataFactory.quad(
        subject as Quad_Subject,
        predicate as Quad_Predicate,
        object as Quad_Object,
        graph as Quad_Graph | undefined,
    );
    return Object.assign(quad, {
        subjectToken,
        predicateToken,
        objectToken,
        graphToken,
    }) as QuadTokens;
}

/**
 * A quad with associated comment tokens.
 * Extends QuadTokens with leading or trailing comments from the source.
 */
export interface QuadContext extends QuadTokens {
    /**
     * Comment tokens that appear before this statement.
     * For statements sharing a subject, only the first statement gets leading comments.
     */
    leadingComments: IToken[];

    /**
     * A comment token on the same line as this statement's last token.
     * For statements sharing a subject, only the last statement gets the trailing comment.
     */
    trailingComment?: IToken;

    /**
     * The end offset of this statement in the source (for internal use).
     */
    endOffset: number;

    /**
     * The end line of this statement in the source (for trailing comment detection).
     */
    endLine: number;
}
