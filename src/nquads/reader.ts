// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import type { CstNode, IToken } from 'chevrotain';
import { NQuadsParser } from './parser.js';
import type { QuadInfo, TermToken } from '../types.js';

interface CstContext {
    [key: string]: CstContext[] | IToken[] | undefined;
    statement?: CstContext[];
    subject?: CstContext[];
    predicate?: CstContext[];
    object?: CstContext[];
    literal?: CstContext[];
    datatype?: CstContext[];
    tripleTerm?: CstContext[];
    graphLabel?: CstContext[];
    IRIREF_ABS?: IToken[];
    BLANK_NODE_LABEL?: IToken[];
    STRING_LITERAL_QUOTE?: IToken[];
    LANGTAG?: IToken[];
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

    /**
     * Extract children from a CstNode or return the context as-is.
     */
    protected getChildren(ctx: CstContext): CstContext {
        return ctx.children ? ctx.children : ctx;
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

    /**
     * Parse the document and return quad information with source tokens.
     * This is useful for IDE features that need to associate positions with quads.
     */
    nquadsDocInfo(ctx: CstNode): QuadInfo[] {
        const context = this.getChildren(ctx);
        const result: QuadInfo[] = [];

        if (context.statement) {
            for (const statementCtx of context.statement) {
                const info = this.statementInfo(statementCtx);
                if (info) {
                    result.push(info);
                }
            }
        }

        return result;
    }

    /**
     * Get statement info with tokens.
     */
    protected statementInfo(ctx: CstContext): QuadInfo | undefined {
        const context = this.getChildren(ctx);
        const subject = this.subjectInfo(context.subject![0]);
        const predicate = this.predicateInfo(context.predicate![0]);
        const object = this.objectInfo(context.object![0]);
        const graph = context.graphLabel ? this.graphLabelInfo(context.graphLabel[0]) : undefined;

        const quadInfo: QuadInfo = { subject, predicate, object };
        if (graph) {
            quadInfo.graph = graph;
        }
        return quadInfo;
    }

    /**
     * Get subject term and token.
     */
    protected subjectInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        if (context.IRIREF_ABS) {
            return {
                term: this.getNamedNode(context),
                token: context.IRIREF_ABS[0]
            };
        } else if (context.BLANK_NODE_LABEL) {
            return {
                term: this.getBlankNode(context),
                token: context.BLANK_NODE_LABEL[0]
            };
        }
        throw new Error('Invalid subject');
    }

    /**
     * Get predicate term and token.
     */
    protected predicateInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        if (context.IRIREF_ABS) {
            return {
                term: this.getNamedNode(context),
                token: context.IRIREF_ABS[0]
            };
        }
        throw new Error('Invalid predicate: ' + context);
    }

    /**
     * Get object term and token.
     */
    protected objectInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        if (context.IRIREF_ABS) {
            return {
                term: this.getNamedNode(context),
                token: context.IRIREF_ABS[0]
            };
        } else if (context.BLANK_NODE_LABEL) {
            return {
                term: this.getBlankNode(context),
                token: context.BLANK_NODE_LABEL[0]
            };
        } else if (context.literal) {
            return this.literalInfo(context.literal[0]);
        } else if (context.tripleTerm) {
            return this.tripleTermInfo(context.tripleTerm[0]);
        }
        throw new Error('Invalid object');
    }

    /**
     * Get literal term and token.
     */
    protected literalInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        const token = context.STRING_LITERAL_QUOTE![0];
        const value = this.getLiteralValue(context);

        let literal: Literal;
        if (context.datatype) {
            const datatype = this.visit(context.datatype[0]) as NamedNode;
            literal = dataFactory.literal(value, datatype);
        } else if (context.LANGTAG) {
            const langtag = context.LANGTAG[0].image.slice(1).toLowerCase();
            literal = dataFactory.literal(value, langtag);
        } else {
            literal = dataFactory.literal(value);
        }

        return { term: literal, token };
    }

    /**
     * Get triple term info.
     */
    protected tripleTermInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        const subject = this.visit(context.subject![0]) as NamedNode | BlankNode;
        const predicate = this.visit(context.predicate![0]) as NamedNode;
        const object = this.visit(context.object![0]) as Term;

        const token = this.findFirstToken(context);

        return {
            term: dataFactory.quad(subject, predicate, object),
            token: token!
        };
    }

    /**
     * Get graph label term and token.
     */
    protected graphLabelInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        if (context.IRIREF_ABS) {
            return {
                term: this.getNamedNode(context),
                token: context.IRIREF_ABS[0]
            };
        } else if (context.BLANK_NODE_LABEL) {
            return {
                term: this.getBlankNode(context),
                token: context.BLANK_NODE_LABEL[0]
            };
        }
        throw new Error('Invalid graph label');
    }

    /**
     * Find the first token in a CST context.
     */
    protected findFirstToken(ctx: CstContext): IToken | undefined {
        for (const key in ctx) {
            const value = ctx[key];
            if (Array.isArray(value) && value.length > 0) {
                const first = value[0];
                if (typeof (first as IToken).startOffset === 'number') {
                    return first as IToken;
                }
                if (typeof first === 'object') {
                    const token = this.findFirstToken(first as CstContext);
                    if (token) return token;
                }
            }
        }
        return undefined;
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
