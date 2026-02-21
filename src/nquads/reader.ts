// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import { NQuadsParser } from './parser.js';

interface CstContext {
    [key: string]: CstContext[] | { image: string }[] | undefined;
    statement?: CstContext[];
    subject?: CstContext[];
    predicate?: CstContext[];
    object?: CstContext[];
    literal?: CstContext[];
    datatype?: CstContext[];
    tripleTerm?: CstContext[];
    graphLabel?: CstContext[];
    IRIREF_ABS?: { image: string }[];
    BLANK_NODE_LABEL?: { image: string }[];
    STRING_LITERAL_QUOTE?: { image: string }[];
    LANGTAG?: { image: string }[];
}

const BaseVisitor = new NQuadsParser().getBaseCstVisitorConstructor();

/**
 * A visitor class that constructs RDF/JS quads from N-Quads syntax trees.
 */
export class NQuadsReader extends BaseVisitor {

    constructor() {
        super();

        this.validateVisitor();
    }

    nquadsDoc(ctx: CstContext): Quad[] {
        const quads: Quad[] = [];

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

    versionDirective(ctx: CstContext): undefined {
        // Version directive is informational only, no quads emitted
        return undefined;
    }

    statement(ctx: CstContext): Quad {
        const subject = this.visit(ctx.subject![0]) as NamedNode | BlankNode;
        const predicate = this.visit(ctx.predicate![0]) as NamedNode;
        const object = this.visit(ctx.object![0]) as Term;
        const graph = ctx.graphLabel ? this.visit(ctx.graphLabel[0]) as NamedNode | BlankNode : undefined;

        return dataFactory.quad(subject, predicate, object, graph);
    }

    subject(ctx: CstContext): NamedNode | BlankNode | undefined {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        }
    }

    predicate(ctx: CstContext): NamedNode {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid predicate: ' + ctx);
        }
    }

    object(ctx: CstContext): NamedNode | BlankNode | Literal | Quad | undefined {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        }
        else if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        }
        else if (ctx.literal) {
            return this.visit(ctx.literal[0]) as Literal;
        }
        else if (ctx.tripleTerm) {
            return this.visit(ctx.tripleTerm[0]) as Quad;
        }
    }

    tripleTerm(ctx: CstContext): Quad {
        const subject = this.visit(ctx.subject![0]) as NamedNode | BlankNode;
        const predicate = this.visit(ctx.predicate![0]) as NamedNode;
        const object = this.visit(ctx.object![0]) as Term;

        return dataFactory.quad(subject, predicate, object);
    }

    literal(ctx: CstContext): Literal {
        const value = this.getLiteralValue(ctx);

        if (ctx.datatype) {
            const datatype = this.visit(ctx.datatype[0]) as NamedNode;

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

    datatype(ctx: CstContext): NamedNode {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid datatype:' + ctx);
        }
    }

    graphLabel(ctx: CstContext): NamedNode | BlankNode | undefined {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        }
    }

    getNamedNode(ctx: CstContext): NamedNode {
        let value = ctx.IRIREF_ABS![0].image.slice(1, -1);

        // Resolve Unicode escapes (\uXXXX and \UXXXXXXXX)
        value = value.replace(/\\u([0-9A-Fa-f]{4})/g, (_: string, hex: string) =>
            String.fromCodePoint(parseInt(hex, 16))
        ).replace(/\\U([0-9A-Fa-f]{8})/g, (_: string, hex: string) =>
            String.fromCodePoint(parseInt(hex, 16))
        );

        return dataFactory.namedNode(value);
    }

    getBlankNode(ctx: CstContext): BlankNode {
        return dataFactory.blankNode(ctx.BLANK_NODE_LABEL![0].image);
    }

    getLiteralValue(ctx: CstContext): string {
        const raw = ctx.STRING_LITERAL_QUOTE![0].image.slice(1, -1);

        return this.unescapeString(raw);
    }

    /**
     * Interpret escape sequences in a string value.
     */
    unescapeString(raw: string): string {
        return raw.replace(/\\u([0-9A-Fa-f]{4})|\\U([0-9A-Fa-f]{8})|\\(.)/g, (match: string, u4: string, u8: string, ch: string) => {
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
