import type { IToken } from 'chevrotain';

/**
 * Generic Chevrotain CST context shape used by reader visitors.
 */
export interface BaseReaderCstContext {
    [key: string]: BaseReaderCstContext | BaseReaderCstContext[] | IToken[] | undefined;
    children?: BaseReaderCstContext;
}

/**
 * Shared directive fields for Turtle-like syntaxes.
 */
export interface DirectiveReaderCstFields extends BaseReaderCstContext {
    directive?: BaseReaderCstContext[];
    prefix?: BaseReaderCstContext[];
    base?: BaseReaderCstContext[];
    sparqlPrefix?: BaseReaderCstContext[];
    sparqlBase?: BaseReaderCstContext[];
    version?: BaseReaderCstContext[];
    sparqlVersion?: BaseReaderCstContext[];
}

/**
 * Shared term/rule fields for Turtle-like syntaxes.
 */
export interface TurtleCoreReaderCstFields extends BaseReaderCstContext {
    triples?: BaseReaderCstContext[];
    subject?: BaseReaderCstContext[];
    predicate?: BaseReaderCstContext[];
    object?: BaseReaderCstContext[];
    predicateObjectList?: BaseReaderCstContext[];
    objectList?: BaseReaderCstContext[];
    blankNodePropertyList?: BaseReaderCstContext[];
    collection?: BaseReaderCstContext[];

    iri?: BaseReaderCstContext[];
    prefixedName?: BaseReaderCstContext[];

    literal?: BaseReaderCstContext[];
    stringLiteral?: BaseReaderCstContext[];
    numericLiteral?: BaseReaderCstContext[];
    booleanLiteral?: BaseReaderCstContext[];
    string?: BaseReaderCstContext[];
    datatype?: BaseReaderCstContext[];

    blankNode?: BaseReaderCstContext[];
    anon?: BaseReaderCstContext[];
}

/**
 * Shared RDF-star fields for Turtle-like syntaxes.
 */
export interface RdfStarReaderCstFields extends BaseReaderCstContext {
    tripleTerm?: BaseReaderCstContext[];
    reifiedTriple?: BaseReaderCstContext[];
    rtSubject?: BaseReaderCstContext[];
    rtObject?: BaseReaderCstContext[];
    ttSubject?: BaseReaderCstContext[];
    ttObject?: BaseReaderCstContext[];
    reifier?: BaseReaderCstContext[];
    annotation?: BaseReaderCstContext[];
    annotationBlock?: BaseReaderCstContext[];
}

/**
 * Shared Turtle/TriG token fields.
 */
export interface TurtleTokenReaderCstFields extends BaseReaderCstContext {
    PNAME_NS?: IToken[];
    PNAME_LN?: IToken[];
    IRIREF?: IToken[];
    BLANK_NODE_LABEL?: IToken[];
    LANGTAG?: IToken[];
    INTEGER?: IToken[];
    DECIMAL?: IToken[];
    DOUBLE?: IToken[];
    STRING_LITERAL_QUOTE?: IToken[];
    STRING_LITERAL_SINGLE_QUOTE?: IToken[];
    STRING_LITERAL_LONG_QUOTE?: IToken[];
    STRING_LITERAL_LONG_SINGLE_QUOTE?: IToken[];
    A?: IToken[];
    true?: IToken[];
    false?: IToken[];
    LBRACKET?: IToken[];
    LPARENT?: IToken[];
}

/**
 * Shared CST shape for Turtle readers.
 */
export interface TurtleReaderCstContext
    extends DirectiveReaderCstFields,
    TurtleCoreReaderCstFields,
    RdfStarReaderCstFields,
    TurtleTokenReaderCstFields {}

/**
 * Shared CST shape for TriG readers.
 */
export interface TrigReaderCstContext extends TurtleReaderCstContext {
    block?: BaseReaderCstContext[];
    wrappedGraph?: BaseReaderCstContext[];
    triplesOrGraph?: BaseReaderCstContext[];
    triplesBlock?: BaseReaderCstContext[];
    triples2?: BaseReaderCstContext[];
    labelOrSubject?: BaseReaderCstContext[];
    blank?: BaseReaderCstContext[];
    GRAPH?: IToken[];
}

/**
 * Shared CST shape for N-Triples readers.
 */
export interface NTriplesReaderCstContext extends BaseReaderCstContext {
    triple?: BaseReaderCstContext[];
    subject?: BaseReaderCstContext[];
    predicate?: BaseReaderCstContext[];
    object?: BaseReaderCstContext[];
    literal?: BaseReaderCstContext[];
    datatype?: BaseReaderCstContext[];
    tripleTerm?: BaseReaderCstContext[];
    IRIREF_ABS?: IToken[];
    BLANK_NODE_LABEL?: IToken[];
    STRING_LITERAL_QUOTE?: IToken[];
    LANGTAG?: IToken[];
}

/**
 * Shared CST shape for N-Quads readers.
 */
export interface NQuadsReaderCstContext extends NTriplesReaderCstContext {
    statement?: BaseReaderCstContext[];
    graphLabel?: BaseReaderCstContext[];
}

/**
 * Shared CST shape for N3 readers.
 */
export interface N3ReaderCstContext extends BaseReaderCstContext {
    n3Doc?: BaseReaderCstContext[];
    n3Statement?: BaseReaderCstContext[];
    n3Directive?: BaseReaderCstContext[];
    sparqlDirective?: BaseReaderCstContext[];

    prefix?: BaseReaderCstContext[];
    base?: BaseReaderCstContext[];
    sparqlPrefix?: BaseReaderCstContext[];
    sparqlBase?: BaseReaderCstContext[];
    forAll?: BaseReaderCstContext[];
    forSome?: BaseReaderCstContext[];

    triples?: BaseReaderCstContext[];
    subject?: BaseReaderCstContext[];
    predicateObjectList?: BaseReaderCstContext[];
    verb?: BaseReaderCstContext[];
    predicate?: BaseReaderCstContext[];
    objectList?: BaseReaderCstContext[];
    object?: BaseReaderCstContext[];

    expression?: BaseReaderCstContext[];
    path?: BaseReaderCstContext[];
    pathItem?: BaseReaderCstContext[];
    quickVar?: BaseReaderCstContext[];

    iri?: BaseReaderCstContext[];
    prefixedName?: BaseReaderCstContext[];

    blankNode?: BaseReaderCstContext[];
    blankNodePropertyList?: BaseReaderCstContext[];
    anon?: BaseReaderCstContext[];

    collection?: BaseReaderCstContext[];

    literal?: BaseReaderCstContext[];
    stringLiteral?: BaseReaderCstContext[];
    numericLiteral?: BaseReaderCstContext[];
    booleanLiteral?: BaseReaderCstContext[];
    string?: BaseReaderCstContext[];
    datatype?: BaseReaderCstContext[];

    formula?: BaseReaderCstContext[];
    formulaContent?: BaseReaderCstContext[];

    PNAME_NS?: IToken[];
    PNAME_LN?: IToken[];
    IRIREF?: IToken[];
    BLANK_NODE_LABEL?: IToken[];
    LANGTAG?: IToken[];
    INTEGER?: IToken[];
    DECIMAL?: IToken[];
    DOUBLE?: IToken[];
    STRING_LITERAL_QUOTE?: IToken[];
    STRING_LITERAL_SINGLE_QUOTE?: IToken[];
    STRING_LITERAL_LONG_QUOTE?: IToken[];
    STRING_LITERAL_LONG_SINGLE_QUOTE?: IToken[];
    QUICK_VAR?: IToken[];

    A?: IToken[];
    EQUALS_SIGN?: IToken[];
    IMPLIES?: IToken[];
    IMPLIED_BY?: IToken[];
    HAS?: IToken[];
    IS?: IToken[];
    INVERSE_OF?: IToken[];

    EXCL?: IToken[];
    CARET?: IToken[];

    true?: IToken[];
    false?: IToken[];
    LBRACKET?: IToken[];
    LPARENT?: IToken[];
    LCURLY?: IToken[];
}