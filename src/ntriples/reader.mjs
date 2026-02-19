import dataFactory from '@rdfjs/data-model'
import { NTriplesParser } from './parser.mjs';

const BaseVisitor = new NTriplesParser().getBaseCstVisitorConstructor();

/**
 * A visitor class that constructs RDF/JS quads from N-Triples syntax trees.
 */
export class NTriplesReader extends BaseVisitor {

    constructor() {
        super();

        this.validateVisitor();
    }

    ntriplesDoc(ctx) {
        const quads = [];

        if (ctx.triple) {
            for (const tripleCtx of ctx.triple) {
                const quad = this.visit(tripleCtx);

                if (quad) {
                    quads.push(quad);
                }
            }
        }

        return quads;
    }

    triple(ctx) {
        const subject = this.visit(ctx.subject[0]);
        const predicate = this.visit(ctx.predicate[0]);
        const object = this.visit(ctx.object[0]);

        return dataFactory.quad(subject, predicate, object);
    }

    subject(ctx) {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        }
    }

    predicate(ctx) {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid predicate: ' + ctx);
        }
    }

    object(ctx) {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        }
        else if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        }
        else if (ctx.literal) {
            return this.visit(ctx.literal[0]);
        }
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
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid datatype');
        }
    }

    getNamedNode(ctx) {
        return dataFactory.namedNode(ctx.IRIREF_ABS[0].image.slice(1, -1));
    }

    getBlankNode(ctx) {
        return dataFactory.blankNode(ctx.BLANK_NODE_LABEL[0].image);
    }

    getLiteralValue(ctx) {
        return ctx.STRING_LITERAL_QUOTE[0].image.slice(1, -1);
    }
}