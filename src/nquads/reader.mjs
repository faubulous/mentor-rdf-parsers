import dataFactory from '@rdfjs/data-model'
import { NQuadsParser } from './parser.mjs';

const BaseVisitor = new NQuadsParser().getBaseCstVisitorConstructor();

/**
 * A visitor class that constructs RDF/JS quads from N-Quads syntax trees.
 */
export class NQuadsReader extends BaseVisitor {

    constructor() {
        super();

        this.validateVisitor();
    }

    nquadsDoc(ctx) {
        const quads = [];

        if (ctx.statement) {
            for (const statementCtx of ctx.statement) {
                const quad = this.visit(statementCtx);

                if (quad) {
                    quads.push(quad);
                }
            }
        }

        return quads;
    }

    statement(ctx) {
        const subject = this.visit(ctx.subject[0]);
        const predicate = this.visit(ctx.predicate[0]);
        const object = this.visit(ctx.object[0]);
        const graph = ctx.graphLabel ? this.visit(ctx.graphLabel[0]) : undefined;

        return dataFactory.quad(subject, predicate, object, graph);
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
            throw new Error('Invalid datatype:' + ctx);
        }
    }

    graphLabel(ctx) {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
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