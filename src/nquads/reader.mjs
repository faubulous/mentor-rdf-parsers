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

    versionDirective(ctx) {
        // Version directive is informational only, no quads emitted
        return undefined;
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
        else if (ctx.tripleTerm) {
            return this.visit(ctx.tripleTerm[0]);
        }
    }

    tripleTerm(ctx) {
        const subject = this.visit(ctx.subject[0]);
        const predicate = this.visit(ctx.predicate[0]);
        const object = this.visit(ctx.object[0]);

        return dataFactory.quad(subject, predicate, object);
    }

    literal(ctx) {
        const value = this.getLiteralValue(ctx);

        if (ctx.datatype) {
            const datatype = this.visit(ctx.datatype[0]);

            return dataFactory.literal(value, datatype);
        } else if (ctx.LANGTAG) {
            // LANGTAG image includes the leading '@', e.g. "@en" — strip it.
            // Language tags are normalized to lowercase per BCP 47.
            const langtag = ctx.LANGTAG[0].image.slice(1).toLowerCase();

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
        let value = ctx.IRIREF_ABS[0].image.slice(1, -1);

        // Resolve Unicode escapes (\uXXXX and \UXXXXXXXX)
        value = value.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        ).replace(/\\U([0-9A-Fa-f]{8})/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        );

        return dataFactory.namedNode(value);
    }

    getBlankNode(ctx) {
        return dataFactory.blankNode(ctx.BLANK_NODE_LABEL[0].image);
    }

    getLiteralValue(ctx) {
        const raw = ctx.STRING_LITERAL_QUOTE[0].image.slice(1, -1);

        return this.unescapeString(raw);
    }

    /**
     * Interpret escape sequences in a string value.
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
}