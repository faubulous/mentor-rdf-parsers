import dataFactory from '@rdfjs/data-model';
import type { BlankNode, Literal, NamedNode, Quad, Quad_Object, Quad_Subject, Term } from '@rdfjs/types';
import type { IToken, TokenType } from 'chevrotain';
import { RdfToken } from '../tokens.js';
import { getBlankNodeIdFromToken } from '../utils.js';
import { unescapeRdfString } from '../reader-helpers.js';
import { QuadReaderError } from '../quad-reader-error.js';

const RDF_TYPE = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const RDF_FIRST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first');
const RDF_REST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest');
const RDF_NIL = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');
const RDF_REIFIES = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies');
const XSD_INTEGER = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer');
const XSD_DECIMAL = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#decimal');
const XSD_DOUBLE = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double');
const XSD_BOOLEAN = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean');

const LOCAL_NAME_ESCAPE = /\\([_~.\-!$&'()*+,;=/?#@%])/g;
const IRI_UNICODE_ESCAPE = /\\u([0-9A-Fa-f]{4})|\\U([0-9A-Fa-f]{8})/g;

/**
 * A predicate and object read from a predicate-object list, with the annotation
 * written after the object. The quads of the pair are emitted once the subject is known.
 */
interface PredicateObjectPair {
    predicate: NamedNode;
    object: Term;
    annotation?: AnnotationItem[];
}

/**
 * One item of an annotation: a reifier `~ r`, or an annotation block `{| ... |}` whose
 * statements and nested quads are held back until the annotated triple has been emitted.
 */
interface AnnotationItem {
    reifier?: NamedNode | BlankNode;
    block?: AnnotationBlock;
}

/**
 * The content of an annotation block: the quads nested in its objects, which are
 * emitted before its own statements, and the statements themselves.
 */
interface AnnotationBlock {
    token: IToken;
    nested: Quad[];
    pairs: PredicateObjectPair[];
}

/**
 * Reads RDF/JS quads straight from a Turtle token stream, without building a syntax tree.
 *
 * This is the reader for the load path: it accepts the tokens of {@link TurtleLexer} and
 * emits the same quads as `TurtleReader.visit(TurtleParser.parse(tokens))`, in the same
 * order and with the same blank node ids, which it takes from the token payloads assigned
 * by the lexer. Directives apply from the point where they are written. The reader stops
 * at the first error and reports it as a {@link QuadReaderError}; a document with errors
 * is best handed to {@link TurtleParser}, whose error recovery reports them all.
 */
export class TurtleQuadReader {
    /**
     * The namespace IRIs declared so far, by prefix.
     */
    namespaces: Record<string, string> = {};

    /**
     * The base IRI declared so far, if any.
     */
    baseIri: string | undefined;

    private _tokens: IToken[] = [];

    private _index: number = 0;

    private _quads: Quad[] = [];

    /**
     * The named nodes of the prefixed names read so far, by their written form. A new prefix
     * declaration can change what a written form means, so the cache is cleared with it.
     */
    private _prefixedNames: Map<string, NamedNode> = new Map();

    /**
     * Reads the quads of a Turtle document.
     * @param tokens The tokens of the document, as produced by {@link TurtleLexer}. Comment tokens are skipped.
     * @returns The quads of the document.
     * @throws {QuadReaderError} At the first syntax error or undefined prefix.
     */
    read(tokens: IToken[]): Quad[] {
        this._tokens = tokens;
        this._index = 0;
        this._quads = [];
        this._prefixedNames.clear();

        this._skipComments();

        while (this._index < this._tokens.length) {
            this._readStatement();
        }

        return this._quads;
    }

    /**
     * Reads one directive, or one triples block with its terminating period.
     */
    private _readStatement(): void {
        const type = this._peekType();

        if (type === RdfToken.TTL_PREFIX) {
            this._readPrefixDirective(true);
        } else if (type === RdfToken.PREFIX) {
            this._readPrefixDirective(false);
        } else if (type === RdfToken.TTL_BASE) {
            this._readBaseDirective(true);
        } else if (type === RdfToken.BASE) {
            this._readBaseDirective(false);
        } else if (type === RdfToken.VERSION) {
            this._readVersionDirective(true);
        } else if (type === RdfToken.SPARQL_VERSION) {
            this._readVersionDirective(false);
        } else {
            this._readTriples();
            this._consume(RdfToken.PERIOD);
        }
    }

    /**
     * Reads `@prefix p: <iri> .` or `PREFIX p: <iri>` and registers the namespace.
     * @param terminated Whether the directive ends with a period.
     */
    private _readPrefixDirective(terminated: boolean): void {
        this._advance();

        const prefixToken = this._consume(RdfToken.PNAME_NS);
        const iri = this._readIriRef(this._consume(RdfToken.IRIREF));

        if (terminated) {
            this._consume(RdfToken.PERIOD);
        }

        this.namespaces[prefixToken.image.slice(0, -1)] = iri.value;
        this._prefixedNames.clear();
    }

    /**
     * Reads `@base <iri> .` or `BASE <iri>` and sets the base IRI.
     * @param terminated Whether the directive ends with a period.
     */
    private _readBaseDirective(terminated: boolean): void {
        this._advance();

        const iri = this._readIriRef(this._consume(RdfToken.IRIREF));

        if (terminated) {
            this._consume(RdfToken.PERIOD);
        }

        this.baseIri = iri.value;
    }

    /**
     * Reads `@version "1.2" .` or `VERSION "1.2"`. The version is informational and not enforced.
     * @param terminated Whether the directive ends with a period.
     */
    private _readVersionDirective(terminated: boolean): void {
        this._advance();

        const type = this._peekType();

        if (type !== RdfToken.STRING_LITERAL_QUOTE && type !== RdfToken.STRING_LITERAL_SINGLE_QUOTE) {
            throw this._unexpected('a version string');
        }

        this._advance();

        if (terminated) {
            this._consume(RdfToken.PERIOD);
        }
    }

    /**
     * Reads a triples block: a subject with its predicate-object list, a blank node property
     * list or a reified triple, each optionally followed by a predicate-object list.
     */
    private _readTriples(): void {
        const type = this._peekType();

        if (type === RdfToken.LBRACKET && this._peekType(1) !== RdfToken.RBRACKET) {
            const subject = this._readBlankNodePropertyList();

            if (this._peekType() !== RdfToken.PERIOD) {
                this._emitPairs(subject, this._readPredicateObjectList());
            }
        } else if (type === RdfToken.OPEN_REIFIED_TRIPLE) {
            const subject = this._readReifiedTriple();

            if (this._peekType() !== RdfToken.PERIOD) {
                this._emitPairs(subject, this._readPredicateObjectList());
            }
        } else {
            const subject = this._readSubject();

            this._emitPairs(subject, this._readPredicateObjectList());
        }
    }

    /**
     * Reads a subject: an IRI, a blank node or a collection.
     */
    private _readSubject(): Quad_Subject {
        const type = this._peekType();

        if (type === RdfToken.LPARENT) {
            return this._readCollection();
        } else if (type === RdfToken.BLANK_NODE_LABEL || type === RdfToken.LBRACKET) {
            return this._readBlankNode();
        } else {
            return this._readIri();
        }
    }

    /**
     * Reads a predicate-object list. The quads nested in the objects are emitted while
     * reading; the statements of the list itself are returned for the caller to emit
     * once their subject is known.
     */
    private _readPredicateObjectList(): PredicateObjectPair[] {
        const pairs: PredicateObjectPair[] = [];

        this._readObjectList(this._readPredicate(), pairs);

        while (this._peekType() === RdfToken.SEMICOLON) {
            this._advance();

            if (this._startsPredicate(this._peekType())) {
                this._readObjectList(this._readPredicate(), pairs);
            }
        }

        return pairs;
    }

    /**
     * Whether a token type can start a predicate.
     */
    private _startsPredicate(type: TokenType | undefined): boolean {
        return type === RdfToken.A || type === RdfToken.IRIREF || type === RdfToken.PNAME_LN || type === RdfToken.PNAME_NS;
    }

    /**
     * Reads the objects of a predicate, each with its annotation, into `pairs`.
     */
    private _readObjectList(predicate: NamedNode, pairs: PredicateObjectPair[]): void {
        pairs.push(this._readObjectWithAnnotation(predicate));

        while (this._peekType() === RdfToken.COMMA) {
            this._advance();

            pairs.push(this._readObjectWithAnnotation(predicate));
        }
    }

    /**
     * Reads one object and the reifiers and annotation blocks written after it.
     */
    private _readObjectWithAnnotation(predicate: NamedNode): PredicateObjectPair {
        const object = this._readObject();
        const pair: PredicateObjectPair = { predicate, object };

        let type = this._peekType();

        while (type === RdfToken.TILDE || type === RdfToken.OPEN_ANNOTATION) {
            pair.annotation ??= [];

            if (type === RdfToken.TILDE) {
                pair.annotation.push({ reifier: this._readReifier() });
            } else {
                pair.annotation.push({ block: this._readAnnotationBlock() });
            }

            type = this._peekType();
        }

        return pair;
    }

    /**
     * Reads a predicate: an IRI or the keyword `a`.
     */
    private _readPredicate(): NamedNode {
        if (this._peekType() === RdfToken.A) {
            this._advance();

            return RDF_TYPE;
        }

        return this._readIri();
    }

    /**
     * Reads an object: an IRI, a blank node, a collection, a blank node property list,
     * a literal, a triple term or a reified triple.
     */
    private _readObject(): Term {
        const type = this._peekType();

        if (type === RdfToken.LBRACKET) {
            return this._peekType(1) === RdfToken.RBRACKET ? this._readBlankNode() : this._readBlankNodePropertyList();
        } else if (type === RdfToken.LPARENT) {
            return this._readCollection();
        } else if (type === RdfToken.BLANK_NODE_LABEL) {
            return this._readBlankNode();
        } else if (type === RdfToken.OPEN_TRIPLE_TERM) {
            return this._readTripleTerm();
        } else if (type === RdfToken.OPEN_REIFIED_TRIPLE) {
            return this._readReifiedTriple();
        } else if (type === RdfToken.IRIREF || type === RdfToken.PNAME_LN || type === RdfToken.PNAME_NS) {
            return this._readIri();
        } else {
            return this._readLiteral();
        }
    }

    /**
     * Reads `[ predicateObjectList ]`, emits its statements and returns its blank node.
     */
    private _readBlankNodePropertyList(): BlankNode {
        const subject = this._blankNodeFor(this._consume(RdfToken.LBRACKET));
        const pairs = this._readPredicateObjectList();

        this._consume(RdfToken.RBRACKET);
        this._emitPairs(subject, pairs);

        return subject;
    }

    /**
     * Reads `( object* )`, emits its `rdf:first` / `rdf:rest` chain and returns the head
     * node, or `rdf:nil` for an empty collection.
     */
    private _readCollection(): NamedNode | BlankNode {
        const open = this._consume(RdfToken.LPARENT);

        if (this._peekType() === RdfToken.RPARENT) {
            this._advance();

            return RDF_NIL;
        }

        const headId = getBlankNodeIdFromToken(open);
        const head = dataFactory.blankNode(headId);

        let current = head;
        let position = 0;

        while (this._peekType() !== RdfToken.RPARENT) {
            const item = this._readObject();

            position++;

            this._quads.push(dataFactory.quad(current, RDF_FIRST, item as Quad_Object));

            if (this._peekType() === RdfToken.RPARENT) {
                this._quads.push(dataFactory.quad(current, RDF_REST, RDF_NIL));
            } else {
                const next = dataFactory.blankNode(headId ? `${headId}-rest-${position}` : undefined);

                this._quads.push(dataFactory.quad(current, RDF_REST, next));

                current = next;
            }
        }

        this._advance();

        return head;
    }

    /**
     * Reads `<< subject predicate object reifier? >>`, emits the `rdf:reifies` statement
     * and returns the reifier.
     */
    private _readReifiedTriple(): NamedNode | BlankNode {
        const open = this._consume(RdfToken.OPEN_REIFIED_TRIPLE);
        const subject = this._readReifiedTripleSubject();
        const predicate = this._readPredicate();
        const object = this._readReifiedTripleObject();
        const reifier = this._peekType() === RdfToken.TILDE ? this._readReifier() : this._blankNodeFor(open);

        this._consume(RdfToken.CLOSE_REIFIED_TRIPLE);
        this._quads.push(dataFactory.quad(reifier, RDF_REIFIES, dataFactory.quad(subject, predicate, object as Quad_Object)));

        return reifier;
    }

    /**
     * Reads the subject of a reified triple: an IRI, a blank node or a nested reified triple.
     */
    private _readReifiedTripleSubject(): Quad_Subject {
        const type = this._peekType();

        if (type === RdfToken.OPEN_REIFIED_TRIPLE) {
            return this._readReifiedTriple();
        } else if (type === RdfToken.BLANK_NODE_LABEL || type === RdfToken.LBRACKET) {
            return this._readBlankNode();
        } else {
            return this._readIri();
        }
    }

    /**
     * Reads the object of a reified triple: an IRI, a blank node, a literal, a triple term
     * or a nested reified triple.
     */
    private _readReifiedTripleObject(): Term {
        const type = this._peekType();

        if (type === RdfToken.OPEN_REIFIED_TRIPLE) {
            return this._readReifiedTriple();
        } else if (type === RdfToken.OPEN_TRIPLE_TERM) {
            return this._readTripleTerm();
        } else if (type === RdfToken.BLANK_NODE_LABEL || type === RdfToken.LBRACKET) {
            return this._readBlankNode();
        } else if (type === RdfToken.IRIREF || type === RdfToken.PNAME_LN || type === RdfToken.PNAME_NS) {
            return this._readIri();
        } else {
            return this._readLiteral();
        }
    }

    /**
     * Reads `<<( subject predicate object )>>` and returns it as a triple term.
     */
    private _readTripleTerm(): Quad {
        this._consume(RdfToken.OPEN_TRIPLE_TERM);

        const subjectType = this._peekType();
        const subject = subjectType === RdfToken.BLANK_NODE_LABEL || subjectType === RdfToken.LBRACKET
            ? this._readBlankNode()
            : this._readIri();
        const predicate = this._readPredicate();
        const object = this._readTripleTermObject();

        this._consume(RdfToken.CLOSE_TRIPLE_TERM);

        return dataFactory.quad(subject, predicate, object as Quad_Object);
    }

    /**
     * Reads the object of a triple term: an IRI, a blank node, a literal or a nested triple term.
     */
    private _readTripleTermObject(): Term {
        const type = this._peekType();

        if (type === RdfToken.OPEN_TRIPLE_TERM) {
            return this._readTripleTerm();
        } else if (type === RdfToken.BLANK_NODE_LABEL || type === RdfToken.LBRACKET) {
            return this._readBlankNode();
        } else if (type === RdfToken.IRIREF || type === RdfToken.PNAME_LN || type === RdfToken.PNAME_NS) {
            return this._readIri();
        } else {
            return this._readLiteral();
        }
    }

    /**
     * Reads `~` with an optional IRI or blank node and returns the reifier; an anonymous
     * reifier takes the blank node id of the `~` token.
     */
    private _readReifier(): NamedNode | BlankNode {
        const tilde = this._consume(RdfToken.TILDE);
        const type = this._peekType();

        if (type === RdfToken.BLANK_NODE_LABEL || type === RdfToken.LBRACKET) {
            return this._readBlankNode();
        } else if (type === RdfToken.IRIREF || type === RdfToken.PNAME_LN || type === RdfToken.PNAME_NS) {
            return this._readIri();
        } else {
            return this._blankNodeFor(tilde);
        }
    }

    /**
     * Reads `{| predicateObjectList |}`. The quads nested in its objects are collected
     * separately so that they follow the annotated triple when the block is emitted.
     */
    private _readAnnotationBlock(): AnnotationBlock {
        const token = this._consume(RdfToken.OPEN_ANNOTATION);
        const outer = this._quads;

        this._quads = [];

        const pairs = this._readPredicateObjectList();
        const nested = this._quads;

        this._quads = outer;
        this._consume(RdfToken.CLOSE_ANNOTATION);

        return { token, nested, pairs };
    }

    /**
     * Emits the statements of a subject, each followed by the quads of its annotation.
     */
    private _emitPairs(subject: Quad_Subject, pairs: PredicateObjectPair[]): void {
        for (const pair of pairs) {
            this._quads.push(dataFactory.quad(subject, pair.predicate, pair.object as Quad_Object));

            if (pair.annotation) {
                this._emitAnnotation(subject, pair, pair.annotation);
            }
        }
    }

    /**
     * Emits the quads of the reifiers and annotation blocks of a triple, in source order.
     * A block uses the reifier written right before it; otherwise it gets a fresh one with
     * the blank node id of its `{|` token.
     */
    private _emitAnnotation(subject: Quad_Subject, pair: PredicateObjectPair, items: AnnotationItem[]): void {
        const tripleTerm = dataFactory.quad(subject, pair.predicate, pair.object as Quad_Object);

        let lastReifier: NamedNode | BlankNode | undefined;

        for (const item of items) {
            if (item.reifier) {
                this._quads.push(dataFactory.quad(item.reifier, RDF_REIFIES, tripleTerm));

                lastReifier = item.reifier;
            } else if (item.block) {
                let reifier = lastReifier;

                if (reifier) {
                    lastReifier = undefined;
                } else {
                    reifier = this._blankNodeFor(item.block.token);

                    this._quads.push(dataFactory.quad(reifier, RDF_REIFIES, tripleTerm));
                }

                for (const quad of item.block.nested) {
                    this._quads.push(quad);
                }

                this._emitPairs(reifier, item.block.pairs);
            }
        }
    }

    /**
     * Reads a blank node: a label, or the anonymous node `[ ]`.
     */
    private _readBlankNode(): BlankNode {
        const token = this._advance();

        if (token.tokenType === RdfToken.BLANK_NODE_LABEL) {
            return dataFactory.blankNode(getBlankNodeIdFromToken(token) ?? token.image.substring(2));
        } else if (token.tokenType === RdfToken.LBRACKET) {
            this._consume(RdfToken.RBRACKET);

            return this._blankNodeFor(token);
        }

        throw this._unexpected('a blank node', token);
    }

    /**
     * Creates the blank node that a token stands for, using the id the lexer assigned to it.
     */
    private _blankNodeFor(token: IToken): BlankNode {
        return dataFactory.blankNode(getBlankNodeIdFromToken(token));
    }

    /**
     * Reads a literal: a string with an optional language tag or datatype, a number or a boolean.
     */
    private _readLiteral(): Literal {
        const token = this._advance();
        const type = token.tokenType;

        if (type === RdfToken.STRING_LITERAL_QUOTE || type === RdfToken.STRING_LITERAL_SINGLE_QUOTE) {
            return this._readStringLiteral(token.image.slice(1, -1));
        } else if (type === RdfToken.STRING_LITERAL_LONG_QUOTE || type === RdfToken.STRING_LITERAL_LONG_SINGLE_QUOTE) {
            return this._readStringLiteral(token.image.slice(3, -3));
        } else if (type === RdfToken.INTEGER) {
            return dataFactory.literal(token.image, XSD_INTEGER);
        } else if (type === RdfToken.DECIMAL) {
            return dataFactory.literal(token.image, XSD_DECIMAL);
        } else if (type === RdfToken.DOUBLE) {
            return dataFactory.literal(token.image, XSD_DOUBLE);
        } else if (type === RdfToken.TRUE) {
            return dataFactory.literal('true', XSD_BOOLEAN);
        } else if (type === RdfToken.FALSE) {
            return dataFactory.literal('false', XSD_BOOLEAN);
        }

        throw this._unexpected('a literal', token);
    }

    /**
     * Completes a string literal with the language tag or datatype that follows it.
     * @param raw The string content between the quotes, with its escape sequences.
     */
    private _readStringLiteral(raw: string): Literal {
        const value = raw.includes('\\') ? unescapeRdfString(raw) : raw;
        const type = this._peekType();

        if (type === RdfToken.LANGTAG) {
            return dataFactory.literal(value, this._advance().image.slice(1));
        } else if (type === RdfToken.DCARET) {
            this._advance();

            return dataFactory.literal(value, this._readIri());
        }

        return dataFactory.literal(value);
    }

    /**
     * Reads an IRI reference or a prefixed name.
     */
    private _readIri(): NamedNode {
        const token = this._advance();
        const type = token.tokenType;

        if (type === RdfToken.PNAME_LN || type === RdfToken.PNAME_NS) {
            return this._readPrefixedName(token);
        } else if (type === RdfToken.IRIREF) {
            return this._readIriRef(token);
        }

        throw this._unexpected('an IRI', token);
    }

    /**
     * Resolves a prefixed name against the namespaces declared so far. Repeated names share
     * one term: the cache is keyed by the written form, which is cheaper to look up than the
     * resolved IRI because the lexer created that string once and V8 remembers its hash.
     */
    private _readPrefixedName(token: IToken): NamedNode {
        const image = token.image;
        const cached = this._prefixedNames.get(image);

        if (cached !== undefined) {
            return cached;
        }

        const colonIndex = image.indexOf(':');
        const prefix = image.slice(0, colonIndex);
        const namespaceIri = this.namespaces[prefix];

        if (namespaceIri === undefined) {
            throw new QuadReaderError(`Undefined prefix: ${prefix}`, token);
        }

        let localName = image.slice(colonIndex + 1);

        if (localName.includes('\\')) {
            localName = localName.replace(LOCAL_NAME_ESCAPE, '$1');
        }

        const node = dataFactory.namedNode(namespaceIri + localName);

        this._prefixedNames.set(image, node);

        return node;
    }

    /**
     * Resolves an IRI reference token: unicode escapes are decoded and a relative IRI
     * is resolved against the base IRI, if one is declared.
     */
    private _readIriRef(token: IToken): NamedNode {
        let value = token.image.slice(1, -1);

        if (value.includes('\\')) {
            value = value.replace(IRI_UNICODE_ESCAPE, (_, u4, u8) => String.fromCodePoint(parseInt(u4 ?? u8, 16)));
        }

        if (value.includes(':') || this.baseIri === undefined) {
            return dataFactory.namedNode(value);
        } else if (value === '') {
            return dataFactory.namedNode(this.baseIri);
        } else {
            return dataFactory.namedNode(new URL(value, this.baseIri).href);
        }
    }

    /**
     * The type of the token `offset` positions ahead of the current one, ignoring comments,
     * or `undefined` past the end of the input.
     */
    private _peekType(offset: number = 0): TokenType | undefined {
        let index = this._index;

        while (offset > 0 && index < this._tokens.length) {
            index = this._nextIndex(index);
            offset--;
        }

        return this._tokens[index]?.tokenType;
    }

    /**
     * Returns the current token and moves to the next one that is not a comment.
     */
    private _advance(): IToken {
        const token = this._tokens[this._index];

        if (token === undefined) {
            throw this._unexpected('more input');
        }

        this._index = this._nextIndex(this._index);

        return token;
    }

    /**
     * Returns the current token after checking its type, and moves on.
     */
    private _consume(type: TokenType): IToken {
        const token = this._tokens[this._index];

        if (token === undefined || token.tokenType !== type) {
            throw this._unexpected(`'${type.name}'`, token);
        }

        this._index = this._nextIndex(this._index);

        return token;
    }

    /**
     * Moves the position to the first token that is not a comment.
     */
    private _skipComments(): void {
        while (this._tokens[this._index]?.tokenType === RdfToken.COMMENT) {
            this._index++;
        }
    }

    /**
     * The index of the next token after `index` that is not a comment.
     */
    private _nextIndex(index: number): number {
        index++;

        while (this._tokens[index]?.tokenType === RdfToken.COMMENT) {
            index++;
        }

        return index;
    }

    /**
     * Creates the error for a token that does not fit the grammar at the current position.
     * @param expected What the grammar expected at this point.
     * @param token The token found, or the current token when omitted.
     */
    private _unexpected(expected: string, token: IToken | undefined = this._tokens[this._index]): QuadReaderError {
        if (token === undefined) {
            return new QuadReaderError(`Unexpected end of input, expected ${expected}`, undefined);
        }

        return new QuadReaderError(`Expected ${expected} but found '${token.image}'`, token);
    }
}
