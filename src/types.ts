import type { IToken } from 'chevrotain';
import type { Term } from '@rdfjs/types';

/**
 * Associates a term with the token that defines it in the source document.
 * 
 * For different term types, the token represents:
 * - Named nodes (IRIs): IRIREF, PNAME_LN, or PNAME_NS token
 * - Blank nodes: BLANK_NODE_LABEL (_:label) or LBRACKET ([) token
 * - Literals: The string token (STRING_LITERAL_QUOTE, etc.) or numeric/boolean token
 * - `a` keyword: The A token (represents rdf:type)
 */
export interface TermToken {
    /**
     * The RDF term (NamedNode, BlankNode, Literal, etc.)
     */
    term: Term;

    /**
     * The primary token that defines the position of this term in the source.
     * Contains startOffset, endOffset, startLine, startColumn, endLine, endColumn.
     */
    token: IToken;
}

/**
 * Information about a quad including the source tokens for each component.
 * This allows associating document positions with the RDF data model.
 */
export interface QuadInfo {
    /**
     * The subject term and its defining token.
     */
    subject: TermToken;

    /**
     * The predicate term and its defining token.
     */
    predicate: TermToken;

    /**
     * The object term and its defining token.
     */
    object: TermToken;

    /**
     * The graph term and its defining token (for TriG/N-Quads).
     * Undefined for triples in the default graph.
     */
    graph?: TermToken;
}
