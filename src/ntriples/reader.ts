// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import { NTriplesParser } from './parser.js';

const BaseVisitor = new NTriplesParser().getBaseCstVisitorConstructor();

interface CstContext {
    [key: string]: CstContext[] | { image: string }[] | undefined;
    triple?: CstContext[];
    subject?: CstContext[];
    predicate?: CstContext[];
    object?: CstContext[];
    literal?: CstContext[];
    datatype?: CstContext[];
    tripleTerm?: CstContext[];
    IRIREF_ABS?: { image: string }[];
    BLANK_NODE_LABEL?: { image: string }[];
    STRING_LITERAL_QUOTE?: { image: string }[];
    LANGTAG?: { image: string }[];
}

/**
 * A visitor class that constructs RDF/JS quads from N-Triples syntax trees.
 */
export class NTriplesReader extends BaseVisitor {

    constructor() {
        super();

        this.validateVisitor();
    }

    ntriplesDoc(ctx: CstContext): Quad[] {
        const quads: Quad[] = [];

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

    versionDirective(_ctx: CstContext): undefined {
        // Version directive is informational only, no quads emitted
        return undefined;
    }

    triple(ctx: CstContext): Quad {
        const subject = this.visit(ctx.subject![0]) as NamedNode | BlankNode;
        const predicate = this.visit(ctx.predicate![0]) as NamedNode;
        const object = this.visit(ctx.object![0]) as Term;

        return dataFactory.quad(subject, predicate, object);
    }

    subject(ctx: CstContext): NamedNode | BlankNode {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        }
        throw new Error('Invalid subject');
    }

    predicate(ctx: CstContext): NamedNode {
        if (ctx.IRIREF_ABS) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid predicate: ' + ctx);
        }
    }

    object(ctx: CstContext): Term {
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
        throw new Error('Invalid object');
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
            const datatypeNode = this.visit(ctx.datatype[0]) as NamedNode;

            return dataFactory.literal(value, datatypeNode);
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
            throw new Error('Invalid datatype');
        }
    }

    getNamedNode(ctx: CstContext): NamedNode {
        let value = ctx.IRIREF_ABS![0].image.slice(1, -1);

        // Resolve Unicode escapes (\uXXXX and \UXXXXXXXX)
        value = value.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) =>
            String.fromCodePoint(parseInt(hex, 16))
        ).replace(/\\U([0-9A-Fa-f]{8})/g, (_, hex: string) =>
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
        return raw.replace(/\\u([0-9A-Fa-f]{4})|\\U([0-9A-Fa-f]{8})|\\(.)/g, (match, u4: string | undefined, u8: string | undefined, ch: string | undefined) => {
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
