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
                    this.base = baseIri;
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

    triples(ctx) {
        const quads = [];

        if (ctx.subject) {
            const subject = this.visit(ctx.subject[0]);

            if (!ctx.predicateObjectList) {
                throw new Error('Invalid triples: ' + JSON.stringify(ctx));
            }

            for (const { predicate, object } of this.visit(ctx.predicateObjectList[0], quads)) {
                quads.push(dataFactory.quad(subject, predicate, object));
            }
        } else if (ctx.blankNodePropertyList) {
            for (const object of this.visit(ctx.blankNodePropertyList[0], quads)) {
                quads.push(dataFactory.quad(subject, predicate, object));
            }
        } else {
            throw new Error('Invalid triples: ' + JSON.stringify(ctx));
        }

        return quads;
    }

    collection(ctx) {
        // Generate a linked list of blank nodes and return the quads.
        const nil = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');

        const objects = ctx.object ? ctx.object.map(o => this.visit(o)) : [];

        if (objects.length === 0) {
            return [nil];
        }

        const result = [];

        let head = dataFactory.blankNode();
        let current = head;

        const rest = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest');
        const first = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first');

        objects.forEach((element, i) => {
            result.push(dataFactory.quad(current, first, element));

            if (i < objects.length - 1) {
                const next = dataFactory.blankNode();

                result.push(dataFactory.quad(current, rest, next));

                current = next;
            } else {
                result.push(dataFactory.quad(current, rest, nil));
            }
        });

        return result;
    }

    subject(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
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
        // TODO: Always return an iterable.
        if (ctx.iri) {
            return [this.visit(ctx.iri[0])];
        } else if (ctx.literal) {
            return [this.visit(ctx.literal[0])];
        } else if (ctx.blankNode) {
            return [this.visit(ctx.blankNode[0])];
        } else if (ctx.blankNodePropertyList) {
            return this.visit(ctx.blankNodePropertyList[0], quads);
        } else if (ctx.collection) {
            return this.visit(ctx.collection[0], quads);
        }
    }

    objectList(ctx, quads) {
        // Parse a list of objects that are separated by commas.
        return ctx.object.map(o => this.visit(o, quads));
    }

    predicateObjectList(ctx, quads) {
        const result = [];

        if (!ctx.predicate) {
            throw new Error('Invalid predicateObjectList: ' + JSON.stringify(ctx));
        }

        const predicate = this.visit(ctx.predicate);

        for (let objects of this.visit(ctx.objectList[0], quads)) {
            for (let object of objects) {
                result.push({ predicate, object });
            }
        }

        return result;
    }

    blankNodePropertyList(ctx, quads) {
        const result = [];

        if (ctx.predicateObjectList) {
            const subject = this.getBlankNode(ctx);

            for (const { predicate, object } of this.visit(ctx.predicateObjectList[0], quads)) {
                quads.push(dataFactory.quad(subject, predicate, object));
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
        if (ctx.TRUE) {
            return dataFactory.literal('true', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else if (ctx.FALSE) {
            return dataFactory.literal('false', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else {
            throw new Error('Invalid boolean literal: ' + JSON.stringify(ctx));
        }
    }

    stringLiteral(ctx) {
        if (ctx.STRING_LITERAL_QUOTE) {
            return dataFactory.literal(ctx.STRING_LITERAL_QUOTE[0].image.slice(1, -1));
        } else if (ctx.STRING_LITERAL_SINGLE_QUOTE) {
            return dataFactory.literal(ctx.STRING_LITERAL_SINGLE_QUOTE[0].image.slice(1, -1));
        } else if (ctx.STRING_LITERAL_LONG_SINGLE_QUOTE) {
            return dataFactory.literal(ctx.STRING_LITERAL_LONG_SINGLE_QUOTE[0].image.slice(3, -3));
        } else if (ctx.STRING_LITERAL_LONG_QUOTE) {
            return dataFactory.literal(ctx.STRING_LITERAL_LONG_QUOTE[0].image.slice(3, -3));
        } else {
            throw new Error('Invalid string literal: ' + JSON.stringify(ctx));
        }
    }

    string(ctx) {
        return this.stringLiteral(ctx);
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
        const prefix = pname.split(':')[0] ?? '';
        const localName = pname.split(':')[1] ?? '';

        const namespaceIri = this.namespaces[prefix];

        if (!namespaceIri) {
            throw new Error(`Undefined prefix: ${prefix}`);
        }

        return dataFactory.namedNode(namespaceIri.value + localName);
    }

    literal(ctx) {
        const value = this.getLiteralValue(ctx);

        if (ctx.datatype) {
            const datatype = this.visit(ctx.datatype[0]);

            return dataFactory.literal(value, datatype);
        } else if (ctx.LANGTAG) {
            const langtag = ctx.LANGTAG[0].image;

            return dataFactory.literal(value, langtag);
        } else {
            return dataFactory.literal(value);
        }
    }

    datatype(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else {
            throw new Error('Invalid datatype: ' + ctx);
        }
    }

    getBaseIri(ctx) {
        const value = this.getNamedNode(ctx);

        if (this.baseIri) {
            throw new Error('Multiple base IRIs are not allowed.');
        } else {
            this.baseIri = value;
        }

        return { baseIri: value };
    }

    getNamedNode(ctx) {
        const value = ctx.IRIREF[0].image.slice(1, -1);

        if (value.includes((':'))) {
            return dataFactory.namedNode(value);
        } else if (this.baseIri) {
            return dataFactory.namedNode(new URL(value, this.baseIri.value).href);
        } else {
            throw new Error('Cannot resolve relative IRI without base IRI: ' + value);
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

    getLiteralValue(ctx) {
        // TODO: This does not handle multiline strings correctly.
        return ctx.STRING_LITERAL_QUOTE[0].image.slice(1, -1);
    }
}