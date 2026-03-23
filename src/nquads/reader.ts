// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import type { CstNode, IToken } from 'chevrotain';
import { NQuadsParser } from './parser.js';
import type { QuadContext } from '../quad-context.js';
import { toQuadContext } from '../quad-context.js';
import { getCstChildren, findFirstTokenInCst, unescapeRdfString } from '../reader-helpers.js';
import type { NQuadsReaderCstContext as CstContext } from '../reader-cst-types.js';

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
        return getCstChildren(ctx as any) as CstContext;
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
    readQuadContexts(ctx: CstNode): QuadContext[] {
        const context = this.getChildren(ctx);
        const result: QuadContext[] = [];

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
    protected statementInfo(ctx: CstContext): QuadContext | undefined {
        const context = this.getChildren(ctx);
        const subject = this.subjectContext(context.subject![0]);
        const predicate = this.predicateContext(context.predicate![0]);
        const object = this.objectContext(context.object![0]);
        const graph = context.graphLabel ? this.graphLabelContext(context.graphLabel[0]) : undefined;

        return toQuadContext(
            subject.term, subject.token,
            predicate.term, predicate.token,
            object.term, object.token,
            graph?.term, graph?.token,
        );
    }

    /**
     * Get subject term and token.
     */
    protected subjectContext(ctx: CstContext) {
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
    protected predicateContext(ctx: CstContext) {
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
    protected objectContext(ctx: CstContext) {
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
            return this.literalContext(context.literal[0]);
        } else if (context.tripleTerm) {
            return this.tripleTermContext(context.tripleTerm[0]);
        }

        throw new Error('Invalid object');
    }

    /**
     * Get literal term and token.
     */
    protected literalContext(ctx: CstContext) {
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
    protected tripleTermContext(ctx: CstContext) {
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
    protected graphLabelContext(ctx: CstContext) {
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
        return findFirstTokenInCst(ctx as any);
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
        return unescapeRdfString(raw);
    }
}
