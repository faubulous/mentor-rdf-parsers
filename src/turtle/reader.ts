// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import type { IToken } from 'chevrotain';
import { TurtleParser } from './parser.js';

const BaseVisitor = new TurtleParser().getBaseCstVisitorConstructor();

/**
 * CST context interface for Turtle grammar rules.
 * Using index signature to be compatible with Chevrotain's visitor pattern.
 */
interface CstContext {
    [key: string]: CstContext[] | IToken[] | undefined;
    // Document structure
    directive?: CstContext[];
    triples?: CstContext[];

    // Directives
    prefix?: CstContext[];
    base?: CstContext[];
    sparqlPrefix?: CstContext[];
    sparqlBase?: CstContext[];
    version?: CstContext[];
    sparqlVersion?: CstContext[];

    // Core elements
    subject?: CstContext[];
    predicate?: CstContext[];
    object?: CstContext[];
    predicateObjectList?: CstContext[];
    objectList?: CstContext[];
    blankNodePropertyList?: CstContext[];
    collection?: CstContext[];

    // IRI and prefixed names
    iri?: CstContext[];
    prefixedName?: CstContext[];

    // Literals
    literal?: CstContext[];
    stringLiteral?: CstContext[];
    numericLiteral?: CstContext[];
    booleanLiteral?: CstContext[];
    string?: CstContext[];
    datatype?: CstContext[];

    // Blank nodes
    blankNode?: CstContext[];
    anon?: CstContext[];

    // RDF-star / Turtle-star
    tripleTerm?: CstContext[];
    reifiedTriple?: CstContext[];
    rtSubject?: CstContext[];
    rtObject?: CstContext[];
    ttSubject?: CstContext[];
    ttObject?: CstContext[];
    reifier?: CstContext[];
    annotation?: CstContext[];
    annotationBlock?: CstContext[];

    // Tokens
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

    // Children for nested CST nodes
    children?: CstContext;
}

/**
 * Result from parsing a directive.
 */
interface DirectiveResult {
    prefix?: string;
    namespaceIri?: NamedNode;
    baseIri?: NamedNode;
}

/**
 * Result from parsing a predicate-object pair.
 */
interface PredicateObjectResult {
    predicate: NamedNode;
    object: Term;
    annotationCtx?: CstContext;
}

/**
 * Result from parsing an object list item.
 */
interface ObjectListResult {
    objectNodes: Term[];
    annotationCtx?: CstContext;
}

/**
 * A visitor class that constructs RDF/JS quads from Turtle syntax trees.
 */
export class TurtleReader extends BaseVisitor {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces: Record<string, NamedNode> = {};

    /**
     * The base IRI of the document.
     */
    baseIri: NamedNode | null = null;

    constructor() {
        super();

        this.validateVisitor();
    }

    turtleDoc(ctx: CstContext): Quad[] {
        if (ctx.directive) {
            for (const directive of ctx.directive) {
                const { prefix, namespaceIri, baseIri } = this.visit(directive as any) as DirectiveResult;

                if (prefix !== undefined) {
                    this.namespaces[prefix] = namespaceIri!;
                } else if (baseIri !== undefined) {
                    this.baseIri = baseIri;
                }
            }
        }

        const quads: Quad[] = [];

        if (ctx.triples) {
            for (const triple of ctx.triples) {
                for (const quad of this.visit(triple as any) as Quad[]) {
                    quads.push(quad);
                }
            }
        }

        return quads;
    }

    directive(ctx: CstContext): DirectiveResult {
        if (ctx.prefix) {
            return this.visit(ctx.prefix[0] as any) as DirectiveResult;
        } else if (ctx.base) {
            return this.visit(ctx.base[0] as any) as DirectiveResult;
        } else if (ctx.sparqlPrefix) {
            return this.visit(ctx.sparqlPrefix[0] as any) as DirectiveResult;
        } else if (ctx.sparqlBase) {
            return this.visit(ctx.sparqlBase[0] as any) as DirectiveResult;
        } else if (ctx.version) {
            return this.visit(ctx.version[0] as any) as DirectiveResult;
        } else if (ctx.sparqlVersion) {
            return this.visit(ctx.sparqlVersion[0] as any) as DirectiveResult;
        }
        return {};
    }

    prefix(ctx: CstContext): DirectiveResult {
        const prefix = ctx.PNAME_NS![0].image.slice(0, -1);
        const namespaceIri = this.getNamedNode(ctx);

        return { prefix, namespaceIri };
    }

    base(ctx: CstContext): DirectiveResult {
        return this.getBaseIri(ctx);
    }

    sparqlPrefix(ctx: CstContext): DirectiveResult {
        const prefix = ctx.PNAME_NS![0].image.slice(0, -1);
        const namespaceIri = this.getNamedNode(ctx);

        return { prefix, namespaceIri };
    }

    sparqlBase(ctx: CstContext): DirectiveResult {
        return this.getBaseIri(ctx);
    }

    version(ctx: CstContext): DirectiveResult {
        // Version directives are informational hints; we don't enforce them.
        return {};
    }

    sparqlVersion(ctx: CstContext): DirectiveResult {
        return {};
    }

    versionSpecifier(ctx: CstContext): DirectiveResult {
        return {};
    }

    triples(ctx: CstContext): Quad[] {
        const quads: Quad[] = [];

        if (ctx.subject) {
            const subject = this.visit(ctx.subject[0], quads as any) as NamedNode | BlankNode;

            if (!ctx.predicateObjectList) {
                throw new Error('Invalid triples: ' + JSON.stringify(ctx));
            }

            for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads as any) as PredicateObjectResult[]) {
                quads.push(dataFactory.quad(subject, predicate, object));
                this.processAnnotation(annotationCtx, subject, predicate, object, quads);
            }
        } else if (ctx.blankNodePropertyList) {
            const subjects = this.visit(ctx.blankNodePropertyList[0], quads as any) as BlankNode[];

            if (ctx.predicateObjectList) {
                const subject = subjects[0];

                for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads as any) as PredicateObjectResult[]) {
                    quads.push(dataFactory.quad(subject, predicate, object));
                    this.processAnnotation(annotationCtx, subject, predicate, object, quads);
                }
            }
        } else if (ctx.reifiedTriple) {
            // A reifiedTriple at top level acts as the subject of subsequent predicateObjectList.
            // It also generates the rdf:reifies quad for the reifier.
            const reifierNode = this.visit(ctx.reifiedTriple[0], quads as any) as NamedNode | BlankNode;

            if (ctx.predicateObjectList) {
                for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads as any) as PredicateObjectResult[]) {
                    quads.push(dataFactory.quad(reifierNode, predicate, object));
                    this.processAnnotation(annotationCtx, reifierNode, predicate, object, quads);
                }
            }
        } else {
            throw new Error('Invalid triples: ' + JSON.stringify(ctx));
        }

        return quads;
    }

    collection(ctx: CstContext, quads: Quad[]): NamedNode | BlankNode {
        // Generate a linked list of blank nodes, push internal quads to `quads`,
        // and return the head blank node (or rdf:nil for an empty list).
        const nil = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');
        const rest = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest');
        const first = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first');

        const objectNodes = ctx.object ?? [];

        if (objectNodes.length === 0) {
            return nil;
        }

        let head = dataFactory.blankNode();
        let current = head;

        for (let i = 0; i < objectNodes.length; i++) {
            // Visit the object, which may push sub-collection quads into `quads`.
            const elements = this.visit(objectNodes[i], quads as any) as Term[];
            const element = Array.isArray(elements) ? elements[0] : elements;

            quads.push(dataFactory.quad(current, first, element));

            if (i < objectNodes.length - 1) {
                const next = dataFactory.blankNode();

                quads.push(dataFactory.quad(current, rest, next));

                current = next;
            } else {
                quads.push(dataFactory.quad(current, rest, nil));
            }
        }

        return head;
    }

    subject(ctx: CstContext, quads: Quad[]): NamedNode | BlankNode | undefined {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0] as any) as BlankNode;
        } else if (ctx.collection) {
            return this.visit(ctx.collection[0], quads as any) as NamedNode | BlankNode;
        }
    }

    predicate(ctx: CstContext): NamedNode {
        if (ctx.iri) {
            return this.visit(ctx.iri as any) as NamedNode;
        } else if (ctx.A) {
            return dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
        } else {
            throw new Error('Invalid predicate: ' + JSON.stringify(ctx));
        }
    }

    object(ctx: CstContext, quads: Quad[]): Term[] | undefined {
        if (ctx.iri) {
            return [this.visit(ctx.iri[0] as any) as NamedNode];
        } else if (ctx.literal) {
            return [this.visit(ctx.literal[0] as any) as Literal];
        } else if (ctx.blankNode) {
            return [this.visit(ctx.blankNode[0] as any) as BlankNode];
        } else if (ctx.blankNodePropertyList) {
            return this.visit(ctx.blankNodePropertyList[0], quads as any) as BlankNode[];
        } else if (ctx.collection) {
            // collection() pushes internal quads and returns the head node
            return [this.visit(ctx.collection[0], quads as any) as NamedNode | BlankNode];
        } else if (ctx.tripleTerm) {
            return [this.visit(ctx.tripleTerm[0] as any) as Quad];
        } else if (ctx.reifiedTriple) {
            // reifiedTriple returns the reifier node and pushes rdf:reifies quad
            return [this.visit(ctx.reifiedTriple[0], quads as any) as NamedNode | BlankNode];
        }
    }

    objectList(ctx: CstContext, quads: Quad[]): ObjectListResult[] {
        // Parse a list of objects that are separated by commas.
        // Each object may have an associated annotation.
        // annotation[i] corresponds to object[i].
        const results: ObjectListResult[] = [];

        for (let i = 0; i < ctx.object!.length; i++) {
            const objectNodes = this.visit(ctx.object![i], quads as any) as Term[];
            const annotationCtx = ctx.annotation?.[i];

            results.push({ objectNodes, annotationCtx });
        }

        return results;
    }

    predicateObjectList(ctx: CstContext, quads: Quad[]): PredicateObjectResult[] {
        const result: PredicateObjectResult[] = [];

        if (!ctx.predicate) {
            throw new Error('Invalid predicateObjectList: ' + JSON.stringify(ctx));
        }

        // The CST may contain multiple predicate/objectList pairs (separated by ';').
        // predicate[i] corresponds to objectList[i].
        for (let i = 0; i < ctx.predicate.length; i++) {
            const predicate = this.visit(ctx.predicate[i] as any) as NamedNode;

            for (let { objectNodes, annotationCtx } of this.visit(ctx.objectList![i], quads as any) as ObjectListResult[]) {
                for (let object of objectNodes) {
                    result.push({ predicate, object, annotationCtx });
                }
            }
        }

        return result;
    }

    blankNodePropertyList(ctx: CstContext, quads: Quad[]): BlankNode[] {
        const result: BlankNode[] = [];

        if (ctx.predicateObjectList) {
            const subject = this.getBlankNode(ctx);

            for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads as any) as PredicateObjectResult[]) {
                quads.push(dataFactory.quad(subject, predicate, object));
                this.processAnnotation(annotationCtx, subject, predicate, object, quads);
            }

            // TODO: Return a quad instead ob a single node.
            result.push(subject);
        }

        return result;
    }

    blankNode(ctx: CstContext): BlankNode {
        if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        } else if (ctx.anon) {
            return this.visit(ctx.anon as any) as BlankNode;
        } else {
            throw new Error('Invalid blank node: ' + JSON.stringify(ctx));
        }
    }

    anon(ctx: CstContext): BlankNode {
        return dataFactory.blankNode();
    }

    numericLiteral(ctx: CstContext): Literal {
        if (ctx.INTEGER) {
            return dataFactory.literal(ctx.INTEGER[0].image, dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer'));
        } else if (ctx.DECIMAL) {
            return dataFactory.literal(ctx.DECIMAL[0].image, dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#decimal'));
        } else if (ctx.DOUBLE) {
            return dataFactory.literal(ctx.DOUBLE[0].image, dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double'));
        } else {
            throw new Error('Invalid numeric literal: ' + JSON.stringify(ctx));
        }
    }

    booleanLiteral(ctx: CstContext): Literal {
        if (ctx.true) {
            return dataFactory.literal('true', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else if (ctx.false) {
            return dataFactory.literal('false', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else {
            throw new Error('Invalid boolean literal: ' + JSON.stringify(ctx));
        }
    }

    stringLiteral(ctx: CstContext): Literal {
        const value = this.visit(ctx.string![0] as any) as string;

        if (ctx.datatype) {
            const datatype = this.visit(ctx.datatype[0] as any) as NamedNode;

            return dataFactory.literal(value, datatype);
        } else if (ctx.LANGTAG) {
            // LANGTAG image includes the leading '@', e.g. "@en" — strip it.
            const langtag = ctx.LANGTAG[0].image.slice(1);

            return dataFactory.literal(value, langtag);
        } else {
            return dataFactory.literal(value);
        }
    }

    string(ctx: CstContext): string {
        let raw: string;

        if (ctx.STRING_LITERAL_QUOTE) {
            raw = ctx.STRING_LITERAL_QUOTE[0].image.slice(1, -1);
        } else if (ctx.STRING_LITERAL_SINGLE_QUOTE) {
            raw = ctx.STRING_LITERAL_SINGLE_QUOTE[0].image.slice(1, -1);
        } else if (ctx.STRING_LITERAL_LONG_QUOTE) {
            raw = ctx.STRING_LITERAL_LONG_QUOTE[0].image.slice(3, -3);
        } else if (ctx.STRING_LITERAL_LONG_SINGLE_QUOTE) {
            raw = ctx.STRING_LITERAL_LONG_SINGLE_QUOTE[0].image.slice(3, -3);
        } else {
            throw new Error('Invalid string: ' + JSON.stringify(ctx));
        }

        return this.unescapeString(raw);
    }

    /**
     * Interpret escape sequences in a Turtle string value.
     */
    unescapeString(raw: string): string {
        return raw.replace(/\\u([0-9A-Fa-f]{4})|\\U([0-9A-Fa-f]{8})|\\(.)/g, (match, u4, u8, ch) => {
            if (u4) return String.fromCodePoint(parseInt(u4, 16));
            if (u8) return String.fromCodePoint(parseInt(u8, 16));
            switch (ch) {
                case 't': return '\t';
                case 'n': return '\n';
                case 'r': return '\r';
                case 'b': return '\b';
                case 'f': return '\f';
                case '"': return '"';
                case "'": return "'";
                case '\\': return '\\';
                default: return match;
            }
        });
    }

    iri(ctx: CstContext): NamedNode {
        if (ctx.prefixedName) {
            return this.visit(ctx.prefixedName[0] as any) as NamedNode;
        } else if (ctx.IRIREF) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid IRI: ' + JSON.stringify(ctx));
        }
    }

    prefixedName(ctx: CstContext): NamedNode {
        const pname = ctx.PNAME_LN ? ctx.PNAME_LN[0].image : ctx.PNAME_NS![0].image;
        const colonIndex = pname.indexOf(':');
        const prefix = colonIndex > -1 ? pname.slice(0, colonIndex) : '';
        const localName = colonIndex > -1 ? pname.slice(colonIndex + 1) : '';

        const namespaceIri = this.namespaces[prefix];

        if (!namespaceIri) {
            throw new Error(`Undefined prefix: ${prefix}`);
        }

        // Unescape backslash-escaped characters in local names (e.g. \~ \. \- \! etc.)
        const unescapedLocalName = localName.replace(/\\([_~.\-!$&'()*+,;=/?#@%])/g, '$1');

        return dataFactory.namedNode(namespaceIri.value + unescapedLocalName);
    }

    literal(ctx: CstContext): Literal {
        if (ctx.stringLiteral) {
            return this.visit(ctx.stringLiteral[0] as any) as Literal;
        } else if (ctx.numericLiteral) {
            return this.visit(ctx.numericLiteral[0] as any) as Literal;
        } else if (ctx.booleanLiteral) {
            return this.visit(ctx.booleanLiteral[0] as any) as Literal;
        } else {
            throw new Error('Invalid literal: ' + JSON.stringify(ctx));
        }
    }

    datatype(ctx: CstContext): NamedNode {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else {
            throw new Error('Invalid datatype: ' + ctx);
        }
    }

    /**
     * Process a reifiedTriple node. Returns the reifier node (IRI or blank node).
     * Emits: reifierNode rdf:reifies <<( s p o )>> .
     */
    reifiedTriple(ctx: CstContext, quads: Quad[]): NamedNode | BlankNode {
        const rdfReifies = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies');

        const subject = this.visit(ctx.rtSubject![0], quads as any) as NamedNode | BlankNode;
        const predicate = this.visit(ctx.predicate![0] as any) as NamedNode;
        const object = this.visit(ctx.rtObject![0], quads as any) as Term;

        // Determine the reifier node
        let reifierNode: NamedNode | BlankNode;
        if (ctx.reifier) {
            reifierNode = this.visit(ctx.reifier[0] as any) as NamedNode | BlankNode;
        } else {
            reifierNode = dataFactory.blankNode();
        }

        // Create the triple term
        const tripleTerm = dataFactory.quad(subject, predicate, object);

        // Emit: reifierNode rdf:reifies <<( s p o )>>
        quads.push(dataFactory.quad(reifierNode, rdfReifies, tripleTerm));

        return reifierNode;
    }

    rtSubject(ctx: CstContext, quads: Quad[]): NamedNode | BlankNode | undefined {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0] as any) as BlankNode;
        } else if (ctx.reifiedTriple) {
            return this.visit(ctx.reifiedTriple[0], quads as any) as NamedNode | BlankNode;
        }
    }

    rtObject(ctx: CstContext, quads: Quad[]): Term | undefined {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0] as any) as BlankNode;
        } else if (ctx.literal) {
            return this.visit(ctx.literal[0] as any) as Literal;
        } else if (ctx.tripleTerm) {
            return this.visit(ctx.tripleTerm[0] as any) as Quad;
        } else if (ctx.reifiedTriple) {
            return this.visit(ctx.reifiedTriple[0], quads as any) as NamedNode | BlankNode;
        }
    }

    /**
     * Process a tripleTerm node: <<( s p o )>>
     * Returns a triple term (RDF/JS Quad used as a term).
     */
    tripleTerm(ctx: CstContext): Quad {
        const subject = this.visit(ctx.ttSubject![0] as any) as NamedNode | BlankNode;
        const predicate = this.visit(ctx.predicate![0] as any) as NamedNode;
        const object = this.visit(ctx.ttObject![0] as any) as Term;

        return dataFactory.quad(subject, predicate, object);
    }

    ttSubject(ctx: CstContext): NamedNode | BlankNode | undefined {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0] as any) as BlankNode;
        }
    }

    ttObject(ctx: CstContext): Term | undefined {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0] as any) as BlankNode;
        } else if (ctx.literal) {
            return this.visit(ctx.literal[0] as any) as Literal;
        } else if (ctx.tripleTerm) {
            return this.visit(ctx.tripleTerm[0] as any) as Quad;
        }
    }

    /**
     * Process a reifier node: ~ (iri | BlankNode)?
     * Returns the reifier term (IRI, blank node, or fresh blank node).
     */
    reifier(ctx: CstContext): NamedNode | BlankNode {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0] as any) as BlankNode;
        } else {
            return dataFactory.blankNode();
        }
    }

    /**
     * Process an annotation node: (reifier | annotationBlock)*
     * This is only visited when needed, not always.
     */
    annotation(ctx: CstContext, quads: Quad[]): void {
        // Annotations are processed in processAnnotation, not directly here.
        // This visitor is needed to satisfy Chevrotain validation.
    }

    /**
     * Process an annotationBlock node: {| predicateObjectList |}
     */
    annotationBlock(ctx: CstContext, quads: Quad[]): void {
        // This visitor is needed to satisfy Chevrotain validation.
        // Actual processing is done in processAnnotation.
    }

    /**
     * Process annotation context from the CST.
     * Annotations create reifiers and emit triples.
     */
    processAnnotation(annotationCtx: CstContext | undefined, subject: NamedNode | BlankNode, predicate: NamedNode, object: Term, quads: Quad[]): void {
        if (!annotationCtx) return;

        const rdfReifies = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies');
        const tripleTerm = dataFactory.quad(subject, predicate, object);

        // The annotation CST has reifier and/or annotationBlock children.
        const children = annotationCtx.children;
        if (!children) return;

        const reifierNodes = children.reifier || [];
        const annotationBlocks = children.annotationBlock || [];

        // Helper to extract the start offset from the first token in a CST rule node.
        const getStartOffset = (node: CstContext): number => {
            for (const key in node.children) {
                const arr = (node.children as Record<string, (IToken | CstContext)[]>)[key];
                if (arr && arr.length > 0) {
                    const first = arr[0];
                    // Token nodes have startOffset directly
                    if (typeof (first as IToken).startOffset === 'number') return (first as IToken).startOffset;
                    // Sub-rule nodes: recurse
                    if ((first as CstContext).children) return getStartOffset(first as CstContext);
                }
            }
            return 0;
        };

        // Collect all items with their start offset for ordering
        interface AnnotationItem {
            offset: number;
            type: 'reifier' | 'annotationBlock';
            term?: NamedNode | BlankNode;
            ctx?: CstContext;
        }

        const items: AnnotationItem[] = [];

        for (const r of reifierNodes) {
            const reifierTerm = this.visit(r as any) as NamedNode | BlankNode;
            items.push({
                offset: getStartOffset(r),
                type: 'reifier',
                term: reifierTerm
            });
        }

        for (const ab of annotationBlocks) {
            items.push({
                offset: getStartOffset(ab),
                type: 'annotationBlock',
                ctx: ab
            });
        }

        // Sort by source position
        items.sort((a, b) => a.offset - b.offset);

        // Process items in order
        let lastReifier: NamedNode | BlankNode | null = null;
        for (const item of items) {
            if (item.type === 'reifier') {
                // A reifier without a following annotation block just emits rdf:reifies
                const reifierTerm = item.term!;
                quads.push(dataFactory.quad(reifierTerm, rdfReifies, tripleTerm));
                lastReifier = reifierTerm;
            } else if (item.type === 'annotationBlock') {
                // An annotation block uses the preceding reifier, or creates a fresh blank node
                let reifierTerm: NamedNode | BlankNode;
                if (lastReifier) {
                    reifierTerm = lastReifier;
                    lastReifier = null;
                } else {
                    reifierTerm = dataFactory.blankNode();
                    quads.push(dataFactory.quad(reifierTerm, rdfReifies, tripleTerm));
                }

                // Process the predicateObjectList inside the annotation block
                const polChildren = item.ctx!.children;
                if (polChildren?.predicateObjectList) {
                    for (const { predicate: p, object: o, annotationCtx: innerAnnotation } of this.visit(polChildren.predicateObjectList[0], quads as any) as PredicateObjectResult[]) {
                        quads.push(dataFactory.quad(reifierTerm, p, o));
                        // Handle nested annotations recursively
                        this.processAnnotation(innerAnnotation, reifierTerm, p, o, quads);
                    }
                }
            }
        }
    }

    getBaseIri(ctx: CstContext): DirectiveResult {
        const value = this.getNamedNode(ctx);

        this.baseIri = value;

        return { baseIri: value };
    }

    getNamedNode(ctx: CstContext): NamedNode {
        let value = ctx.IRIREF![0].image.slice(1, -1);

        // Resolve Unicode escapes (\uXXXX and \UXXXXXXXX)
        value = value.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        ).replace(/\\U([0-9A-Fa-f]{8})/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        );

        if (value.includes(':')) {
            return dataFactory.namedNode(value);
        } else if (value === '' && this.baseIri) {
            return dataFactory.namedNode(this.baseIri.value);
        } else if (value !== '' && this.baseIri) {
            return dataFactory.namedNode(new URL(value, this.baseIri.value).href);
        } else {
            // No base IRI available — keep the relative IRI as-is.
            return dataFactory.namedNode(value);
        }
    }

    getBlankNode(ctx: CstContext): BlankNode {
        if (ctx.BLANK_NODE_LABEL !== undefined) {
            const value = ctx.BLANK_NODE_LABEL[0].image;

            return dataFactory.blankNode(value);
        } else {
            return dataFactory.blankNode();
        }
    }
}
