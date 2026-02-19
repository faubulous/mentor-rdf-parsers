import dataFactory from '@rdfjs/data-model'
import { TurtleParser } from './parser.mjs';

const BaseVisitor = new TurtleParser().getBaseCstVisitorConstructor();

/**
 * A visitor class that constructs RDF/JS quads from Turtle syntax trees.
 */
export class TurtleReader extends BaseVisitor {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces = {};

    /**
     * The base IRI of the document.
     */
    baseIri = null;

    constructor() {
        super();

        this.validateVisitor();
    }

    turtleDoc(ctx) {
        if (ctx.directive) {
            for (const directive of ctx.directive) {
                const { prefix, namespaceIri, baseIri } = this.visit(directive);

                if (prefix !== undefined) {
                    this.namespaces[prefix] = namespaceIri;
                } else if (baseIri !== undefined) {
                    this.baseIri = baseIri;
                }
            }
        }

        const quads = [];

        if (ctx.triples) {
            for (const triple of ctx.triples) {
                for (const quad of this.visit(triple)) {
                    quads.push(quad);
                }
            }
        }

        return quads;
    }

    directive(ctx) {
        if (ctx.prefix) {
            return this.visit(ctx.prefix[0]);
        } else if (ctx.base) {
            return this.visit(ctx.base[0]);
        } else if (ctx.sparqlPrefix) {
            return this.visit(ctx.sparqlPrefix[0]);
        } else if (ctx.sparqlBase) {
            return this.visit(ctx.sparqlBase[0]);
        } else if (ctx.version) {
            return this.visit(ctx.version[0]);
        } else if (ctx.sparqlVersion) {
            return this.visit(ctx.sparqlVersion[0]);
        }
    }

    prefix(ctx) {
        const prefix = ctx.PNAME_NS[0].image.slice(0, -1);
        const namespaceIri = this.getNamedNode(ctx);

        return { prefix, namespaceIri };
    }

    base(ctx) {
        return this.getBaseIri(ctx);
    }

    sparqlPrefix(ctx) {
        const prefix = ctx.PNAME_NS[0].image.slice(0, -1);
        const namespaceIri = this.getNamedNode(ctx);

        return { prefix, namespaceIri };
    }

    sparqlBase(ctx) {
        return this.getBaseIri(ctx);
    }

    version(ctx) {
        // Version directives are informational hints; we don't enforce them.
        return {};
    }

    sparqlVersion(ctx) {
        return {};
    }

    versionSpecifier(ctx) {
        return {};
    }

    triples(ctx) {
        const quads = [];

        if (ctx.subject) {
            const subject = this.visit(ctx.subject[0], quads);

            if (!ctx.predicateObjectList) {
                throw new Error('Invalid triples: ' + JSON.stringify(ctx));
            }

            for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads)) {
                quads.push(dataFactory.quad(subject, predicate, object));
                this.processAnnotation(annotationCtx, subject, predicate, object, quads);
            }
        } else if (ctx.blankNodePropertyList) {
            const subjects = this.visit(ctx.blankNodePropertyList[0], quads);

            if (ctx.predicateObjectList) {
                const subject = subjects[0];

                for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads)) {
                    quads.push(dataFactory.quad(subject, predicate, object));
                    this.processAnnotation(annotationCtx, subject, predicate, object, quads);
                }
            }
        } else if (ctx.reifiedTriple) {
            // A reifiedTriple at top level acts as the subject of subsequent predicateObjectList.
            // It also generates the rdf:reifies quad for the reifier.
            const reifierNode = this.visit(ctx.reifiedTriple[0], quads);

            if (ctx.predicateObjectList) {
                for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads)) {
                    quads.push(dataFactory.quad(reifierNode, predicate, object));
                    this.processAnnotation(annotationCtx, reifierNode, predicate, object, quads);
                }
            }
        } else {
            throw new Error('Invalid triples: ' + JSON.stringify(ctx));
        }

        return quads;
    }

    collection(ctx, quads) {
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
            const elements = this.visit(objectNodes[i], quads);
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

    subject(ctx, quads) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        } else if (ctx.collection) {
            return this.visit(ctx.collection[0], quads);
        }
    }

    predicate(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri);
        } else if (ctx.A) {
            return dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
        } else {
            throw new Error('Invalid predicate: ' + JSON.stringify(ctx));
        }
    }

    object(ctx, quads) {
        if (ctx.iri) {
            return [this.visit(ctx.iri[0])];
        } else if (ctx.literal) {
            return [this.visit(ctx.literal[0])];
        } else if (ctx.blankNode) {
            return [this.visit(ctx.blankNode[0])];
        } else if (ctx.blankNodePropertyList) {
            return this.visit(ctx.blankNodePropertyList[0], quads);
        } else if (ctx.collection) {
            // collection() pushes internal quads and returns the head node
            return [this.visit(ctx.collection[0], quads)];
        } else if (ctx.tripleTerm) {
            return [this.visit(ctx.tripleTerm[0])];
        } else if (ctx.reifiedTriple) {
            // reifiedTriple returns the reifier node and pushes rdf:reifies quad
            return [this.visit(ctx.reifiedTriple[0], quads)];
        }
    }

    objectList(ctx, quads) {
        // Parse a list of objects that are separated by commas.
        // Each object may have an associated annotation.
        // annotation[i] corresponds to object[i].
        const results = [];

        for (let i = 0; i < ctx.object.length; i++) {
            const objectNodes = this.visit(ctx.object[i], quads);
            const annotationCtx = ctx.annotation?.[i];

            results.push({ objectNodes, annotationCtx });
        }

        return results;
    }

    predicateObjectList(ctx, quads) {
        const result = [];

        if (!ctx.predicate) {
            throw new Error('Invalid predicateObjectList: ' + JSON.stringify(ctx));
        }

        // The CST may contain multiple predicate/objectList pairs (separated by ';').
        // predicate[i] corresponds to objectList[i].
        for (let i = 0; i < ctx.predicate.length; i++) {
            const predicate = this.visit(ctx.predicate[i]);

            for (let { objectNodes, annotationCtx } of this.visit(ctx.objectList[i], quads)) {
                for (let object of objectNodes) {
                    result.push({ predicate, object, annotationCtx });
                }
            }
        }

        return result;
    }

    blankNodePropertyList(ctx, quads) {
        const result = [];

        if (ctx.predicateObjectList) {
            const subject = this.getBlankNode(ctx);

            for (const { predicate, object, annotationCtx } of this.visit(ctx.predicateObjectList[0], quads)) {
                quads.push(dataFactory.quad(subject, predicate, object));
                this.processAnnotation(annotationCtx, subject, predicate, object, quads);
            }

            // TODO: Return a quad instead ob a single node.
            result.push(subject);
        }

        return result;
    }

    blankNode(ctx) {
        if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        } else if (ctx.anon) {
            return this.visit(ctx.anon);
        } else {
            throw new Error('Invalid blank node: ' + JSON.stringify(ctx));
        }
    }

    anon(ctx) {
        return dataFactory.blankNode();
    }

    numericLiteral(ctx) {
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

    booleanLiteral(ctx) {
        if (ctx.true) {
            return dataFactory.literal('true', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else if (ctx.false) {
            return dataFactory.literal('false', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else {
            throw new Error('Invalid boolean literal: ' + JSON.stringify(ctx));
        }
    }

    stringLiteral(ctx) {
        const value = this.visit(ctx.string[0]);

        if (ctx.datatype) {
            const datatype = this.visit(ctx.datatype[0]);

            return dataFactory.literal(value, datatype);
        } else if (ctx.LANGTAG) {
            // LANGTAG image includes the leading '@', e.g. "@en" — strip it.
            const langtag = ctx.LANGTAG[0].image.slice(1);

            return dataFactory.literal(value, langtag);
        } else {
            return dataFactory.literal(value);
        }
    }

    string(ctx) {
        let raw;

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
    unescapeString(raw) {
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

    iri(ctx) {
        if (ctx.prefixedName) {
            return this.visit(ctx.prefixedName[0]);
        } else if (ctx.IRIREF) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid IRI: ' + JSON.stringify(ctx));
        }
    }

    prefixedName(ctx) {
        const pname = ctx.PNAME_LN ? ctx.PNAME_LN[0].image : ctx.PNAME_NS[0].image;
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

    literal(ctx) {
        if (ctx.stringLiteral) {
            return this.visit(ctx.stringLiteral[0]);
        } else if (ctx.numericLiteral) {
            return this.visit(ctx.numericLiteral[0]);
        } else if (ctx.booleanLiteral) {
            return this.visit(ctx.booleanLiteral[0]);
        } else {
            throw new Error('Invalid literal: ' + JSON.stringify(ctx));
        }
    }

    datatype(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else {
            throw new Error('Invalid datatype: ' + ctx);
        }
    }

    /**
     * Process a reifiedTriple node. Returns the reifier node (IRI or blank node).
     * Emits: reifierNode rdf:reifies <<( s p o )>> .
     */
    reifiedTriple(ctx, quads) {
        const rdfReifies = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies');

        const subject = this.visit(ctx.rtSubject[0], quads);
        const predicate = this.visit(ctx.predicate[0]);
        const object = this.visit(ctx.rtObject[0], quads);

        // Determine the reifier node
        let reifierNode;
        if (ctx.reifier) {
            reifierNode = this.visit(ctx.reifier[0]);
        } else {
            reifierNode = dataFactory.blankNode();
        }

        // Create the triple term
        const tripleTerm = dataFactory.quad(subject, predicate, object);

        // Emit: reifierNode rdf:reifies <<( s p o )>>
        quads.push(dataFactory.quad(reifierNode, rdfReifies, tripleTerm));

        return reifierNode;
    }

    rtSubject(ctx, quads) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        } else if (ctx.reifiedTriple) {
            return this.visit(ctx.reifiedTriple[0], quads);
        }
    }

    rtObject(ctx, quads) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        } else if (ctx.literal) {
            return this.visit(ctx.literal[0]);
        } else if (ctx.tripleTerm) {
            return this.visit(ctx.tripleTerm[0]);
        } else if (ctx.reifiedTriple) {
            return this.visit(ctx.reifiedTriple[0], quads);
        }
    }

    /**
     * Process a tripleTerm node: <<( s p o )>>
     * Returns a triple term (RDF/JS Quad used as a term).
     */
    tripleTerm(ctx) {
        const subject = this.visit(ctx.ttSubject[0]);
        const predicate = this.visit(ctx.predicate[0]);
        const object = this.visit(ctx.ttObject[0]);

        return dataFactory.quad(subject, predicate, object);
    }

    ttSubject(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        }
    }

    ttObject(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        } else if (ctx.literal) {
            return this.visit(ctx.literal[0]);
        } else if (ctx.tripleTerm) {
            return this.visit(ctx.tripleTerm[0]);
        }
    }

    /**
     * Process a reifier node: ~ (iri | BlankNode)?
     * Returns the reifier term (IRI, blank node, or fresh blank node).
     */
    reifier(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        } else {
            return dataFactory.blankNode();
        }
    }

    /**
     * Process an annotation node: (reifier | annotationBlock)*
     * This is only visited when needed, not always.
     */
    annotation(ctx, quads) {
        // Annotations are processed in processAnnotation, not directly here.
        // This visitor is needed to satisfy Chevrotain validation.
    }

    /**
     * Process an annotationBlock node: {| predicateObjectList |}
     */
    annotationBlock(ctx, quads) {
        // This visitor is needed to satisfy Chevrotain validation.
        // Actual processing is done in processAnnotation.
    }

    /**
     * Process annotation context from the CST.
     * Annotations create reifiers and emit triples.
     */
    processAnnotation(annotationCtx, subject, predicate, object, quads) {
        if (!annotationCtx) return;

        const rdfReifies = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies');
        const tripleTerm = dataFactory.quad(subject, predicate, object);

        // The annotation CST has reifier and/or annotationBlock children.
        const children = annotationCtx.children;
        if (!children) return;

        const reifierNodes = children.reifier || [];
        const annotationBlocks = children.annotationBlock || [];

        // Helper to extract the start offset from the first token in a CST rule node.
        const getStartOffset = (node) => {
            for (const key in node.children) {
                const arr = node.children[key];
                if (arr && arr.length > 0) {
                    const first = arr[0];
                    // Token nodes have startOffset directly
                    if (typeof first.startOffset === 'number') return first.startOffset;
                    // Sub-rule nodes: recurse
                    if (first.children) return getStartOffset(first);
                }
            }
            return 0;
        };

        // Collect all items with their start offset for ordering
        const items = [];

        for (const r of reifierNodes) {
            const reifierTerm = this.visit(r);
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
        let lastReifier = null;
        for (const item of items) {
            if (item.type === 'reifier') {
                // A reifier without a following annotation block just emits rdf:reifies
                const reifierTerm = item.term;
                quads.push(dataFactory.quad(reifierTerm, rdfReifies, tripleTerm));
                lastReifier = reifierTerm;
            } else if (item.type === 'annotationBlock') {
                // An annotation block uses the preceding reifier, or creates a fresh blank node
                let reifierTerm;
                if (lastReifier) {
                    reifierTerm = lastReifier;
                    lastReifier = null;
                } else {
                    reifierTerm = dataFactory.blankNode();
                    quads.push(dataFactory.quad(reifierTerm, rdfReifies, tripleTerm));
                }

                // Process the predicateObjectList inside the annotation block
                const polChildren = item.ctx.children;
                if (polChildren?.predicateObjectList) {
                    for (const { predicate: p, object: o, annotationCtx: innerAnnotation } of this.visit(polChildren.predicateObjectList[0], quads)) {
                        quads.push(dataFactory.quad(reifierTerm, p, o));
                        // Handle nested annotations recursively
                        this.processAnnotation(innerAnnotation, reifierTerm, p, o, quads);
                    }
                }
            }
        }
    }

    getBaseIri(ctx) {
        const value = this.getNamedNode(ctx);

        this.baseIri = value;

        return { baseIri: value };
    }

    getNamedNode(ctx) {
        let value = ctx.IRIREF[0].image.slice(1, -1);

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

    getBlankNode(ctx) {
        if (ctx.BLANK_NODE_LABEL !== undefined) {
            const value = ctx.BLANK_NODE_LABEL[0].image;

            return dataFactory.blankNode(value);
        } else {
            return dataFactory.blankNode();
        }
    }
}