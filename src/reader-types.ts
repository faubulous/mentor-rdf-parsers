import type { NamedNode, Term } from '@rdfjs/types';

/**
 * Shared directive parse result used by Turtle/TriG/N3 readers.
 */
export interface DirectiveResult {
    prefix?: string;
    namespaceIri?: NamedNode;
    baseIri?: NamedNode;
}

/**
 * Shared verb parse result used by N3 readers.
 */
export interface VerbResult<TPredicate = Term> {
    predicate: TPredicate;
    inversePredicate?: boolean;
}

/**
 * Shared predicate/object parse result shape used across readers.
 */
export interface PredicateObjectResult<TPredicate = Term, TObject = Term, TCtx = unknown> {
    predicate: TPredicate;
    object: TObject;
    inversePredicate?: boolean;
    annotationCtx?: TCtx;
}

/**
 * Shared object list parse result shape used across readers.
 */
export interface ObjectListResult<TObject = Term, TCtx = unknown> {
    objectNodes: TObject[];
    annotationCtx?: TCtx;
}

/**
 * Shared verb info result with token metadata.
 */
export interface VerbInfoResult<TPredicate = any> {
    predicate: TPredicate;
    inversePredicate?: boolean;
}

/**
 * Shared predicate/object info result with token metadata.
 *
 * `nested` holds the statement contexts produced while reading the object, such as the
 * statements inside a blank node property list `[ ... ]` or the chain of a collection
 * `( ... )`. Callers emit the statement itself first and then its nested contexts, so the
 * result stays in document order with every parent before its children.
 */
export interface PredicateObjectInfoResult<TPredicate = any, TObject = any, TCtx = unknown, TNested = unknown> {
    predicate: TPredicate;
    object: TObject;
    inversePredicate?: boolean;
    annotationCtx?: TCtx;
    nested?: TNested[];
}

/**
 * Shared object list info result with token metadata.
 */
export interface ObjectListInfoResult<TObject = any, TCtx = unknown, TNested = unknown> {
    objectTokens: TObject[];
    annotationCtx?: TCtx;
    nested?: TNested[];
}