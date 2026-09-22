// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import type { CstNode, IToken } from 'chevrotain';
import { TurtleParser } from './parser.js';
import type { QuadContext } from '../quad-context.js';
import { toQuadContext } from '../quad-context.js';
import { getBlankNodeIdFromToken, splitPrefixedName } from '../utils.js';
import { getCstChildren, findFirstTokenInCst, findStringTokenInCst, unescapeRdfString } from '../reader-helpers.js';
import type { TurtleReaderCstContext as CstContext } from '../reader-cst-types.js';
import type {
    DirectiveResult,
    PredicateObjectResult as SharedPredicateObjectResult,
    ObjectListResult as SharedObjectListResult,
    PredicateObjectInfoResult as SharedPredicateObjectInfoResult,
    ObjectListInfoResult as SharedObjectListInfoResult,
} from '../reader-types.js';

const BaseVisitor = new TurtleParser().getBaseCstVisitorConstructor();

type PredicateObjectResult = SharedPredicateObjectResult<NamedNode, Term, CstContext>;
type ObjectListResult = SharedObjectListResult<Term, CstContext>;
type PredicateObjectInfoResult = SharedPredicateObjectInfoResult<any, any, CstContext, QuadContext>;
type ObjectListInfoResult = SharedObjectListInfoResult<any, CstContext, QuadContext>;

const RDF_FIRST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first');
const RDF_REST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest');
const RDF_NIL = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');

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

    /**
     * Extract children from a CstNode or return the context as-is.
     * Chevrotain CST nodes have { name, children } structure.
     */
    protected getChildren(ctx: CstContext): CstContext {
        return getCstChildren(ctx as any) as CstContext;
    }

    protected processDirectives(context: CstContext): void {
        if (!context.directive) return;

        for (const directive of context.directive) {
            const { prefix, namespaceIri, baseIri } = this.visit(directive as any) as DirectiveResult;

            if (prefix !== undefined) {
                this.namespaces[prefix] = namespaceIri!;
            } else if (baseIri !== undefined) {
                this.baseIri = baseIri;
            }
        }
    }

    protected getSortedCommentTokens(tokens: IToken[]): IToken[] {
        return tokens
            .filter(t => t.tokenType.name === 'COMMENT')
            .sort((a, b) => a.startOffset - b.startOffset);
    }

    protected getStatementSpan(triplesInfos: QuadContext[]): { startOffset: number; endOffset: number; endLine: number } {
        const startOffset = triplesInfos[0].subjectToken.startOffset;

        let endOffset = 0;
        let endLine = 1;

        for (const info of triplesInfos) {
            const objToken = info.objectToken;
            const objEndOffset = objToken.endOffset ?? (objToken.startOffset + objToken.image.length - 1);
            const objEndLine = objToken.endLine ?? objToken.startLine ?? 1;

            if (objEndOffset > endOffset) {
                endOffset = objEndOffset;
                endLine = objEndLine;
            }
        }

        return { startOffset, endOffset, endLine };
    }

    /**
     * Find the index of the context that ends a statement block: the last one whose subject
     * token is the block's own subject token. Nested statements follow their parent in the
     * list, so the plain last element may belong to an inline blank node instead.
     */
    protected getTrailingStatementIndex(triplesInfos: QuadContext[]): number {
        const subjectToken = triplesInfos[0].subjectToken;

        for (let i = triplesInfos.length - 1; i >= 0; i--) {
            if (triplesInfos[i].subjectToken === subjectToken) {
                return i;
            }
        }

        return triplesInfos.length - 1;
    }

    /**
     * The offset at which a statement's own text begins.
     *
     * A statement begins at its predicate rather than at its subject: a subject is written once
     * for a whole block, so taking it would hand every comment inside the block to the statement
     * that opens it. The chain of a collection reports the token of an item as the predicate of
     * the statement holding it, so the items of a list are introduced one by one in the same way.
     */
    protected getStatementStart(context: QuadContext): number {
        return context.predicateToken.startOffset;
    }

    /**
     * The offset at which a statement's own text ends, which is the end of its object.
     */
    protected getStatementEnd(context: QuadContext): number {
        const token = context.objectToken;

        return token.endOffset ?? (token.startOffset + token.image.length - 1);
    }

    /**
     * The line a statement ends on.
     */
    protected getStatementEndLine(context: QuadContext): number {
        const token = context.objectToken;

        return token.endLine ?? token.startLine ?? 1;
    }

    /**
     * Attach the comments of a document to the statements they belong to.
     *
     * A comment sitting on the same line as the end of a statement trails it; every other comment
     * introduces the statement whose own text begins next, which is how a comment written inside a
     * block reaches the predicate it was written above rather than the resource that follows.
     * Comments after the last statement stay with it as leading comments, which is where a reader
     * looking for the footer of a document finds them.
     * @param contexts The statements of the document, which are given their comments in place.
     * @param comments The comment tokens of the document, in the order they were written.
     * @param blockEnds The statements that end a block, which a comment after one belongs to.
     */
    protected attachComments(contexts: QuadContext[], comments: IToken[], blockEnds: Set<QuadContext> = new Set()): void {
        if (contexts.length === 0 || comments.length === 0) {
            return;
        }

        const byStart = [...contexts].sort((a, b) => this.getStatementStart(a) - this.getStatementStart(b));
        const byEnd = [...contexts].sort((a, b) => this.getStatementEnd(a) - this.getStatementEnd(b));
        const lastInText = byStart[byStart.length - 1];

        // Both lists and the comments run forwards, so each is walked once.
        let startIndex = 0;
        let endIndex = 0;

        for (const comment of comments) {
            while (endIndex < byEnd.length && this.getStatementEnd(byEnd[endIndex]) < comment.startOffset) {
                endIndex++;
            }

            while (startIndex < byStart.length && this.getStatementStart(byStart[startIndex]) < comment.startOffset) {
                startIndex++;
            }

            const trailed = this.getTrailedStatement(byEnd, endIndex, comment, blockEnds);

            if (trailed && !trailed.trailingComment) {
                trailed.trailingComment = comment;
            } else {
                (byStart[startIndex] ?? lastInText).leadingComments!.push(comment);
            }
        }
    }

    /**
     * The statement a comment trails, if it trails one: the last to end before it on its line.
     *
     * Several statements can end on one line, because the statements written inside an inline
     * blank node or a collection end before the statement that holds it does. The comment belongs
     * to the one that ends the block, so a comment after `[ ... ] .` stays with the statement
     * holding the node rather than with the last statement written inside it.
     * @param byEnd The statements of the document ordered by where they end.
     * @param endIndex The position after the last statement to end before the comment.
     * @param comment The comment token.
     * @param blockEnds The statements that end a block.
     * @returns The statement the comment trails, or `undefined` if it trails none.
     */
    protected getTrailedStatement(byEnd: QuadContext[], endIndex: number, comment: IToken, blockEnds: Set<QuadContext>): QuadContext | undefined {
        let candidate: QuadContext | undefined;

        // Offsets grow with the lines, so walking back stops at the first statement of an earlier one.
        for (let i = endIndex - 1; i >= 0; i--) {
            const context = byEnd[i];

            if (this.getStatementEndLine(context) !== comment.startLine) {
                break;
            }

            if (blockEnds.has(context)) {
                return context;
            }

            candidate ??= context;
        }

        return candidate;
    }

    /**
     * Parse the document and return quad information with source tokens.
     * This is useful for IDE features that need to associate positions with triples.
     */
    readQuadContexts(ctx: CstNode, tokens?: IToken[]): QuadContext[] {
        const context = this.getChildren(ctx);

        // First process directives to populate namespaces and base IRI
        this.processDirectives(context);

        const comments = tokens ? this.getSortedCommentTokens(tokens) : [];

        const result: QuadContext[] = [];
        const quads: Quad[] = []; // For internal quad generation (collections, etc.)
        const blockEnds = new Set<QuadContext>();

        if (context.triples) {
            for (const triple of context.triples) {
                const triplesInfos = this.triplesInfo(triple, quads);
                if (triplesInfos.length === 0) continue;

                if (tokens) {
                    // The nested statements of an inline blank node or a collection follow their
                    // parent, so the last context is not necessarily a statement of the block's
                    // own subject. The one that ends the block is the last sharing its subject
                    // token, and it is the statement a comment after the block belongs to.
                    const trailingIndex = this.getTrailingStatementIndex(triplesInfos);

                    for (let i = 0; i < triplesInfos.length; i++) {
                        const context: QuadContext = { ...triplesInfos[i], leadingComments: [], trailingComment: undefined };

                        if (i === trailingIndex) {
                            blockEnds.add(context);
                        }

                        result.push(context);
                    }
                } else {
                    result.push(...triplesInfos);
                }
            }
        }

        // Comments are attached once every statement is known, and before the synthetic contexts
        // below join the result: those stand for statements that are not written in the text.
        if (tokens) {
            this.attachComments(result, comments, blockEnds);
        }

        // The statements of inline blank nodes and collections are emitted with their real
        // tokens right after their parent statement above. What remains in the side-effect
        // `quads` array without a context of its own are the quads of reified triples and
        // triple terms, which have no statement of their own in the text. The serializer
        // needs them to count blank-node references, so append them as synthetic
        // QuadContexts (no real token positions), skipping any that already have a context.
        if (quads.length > 0) {
            const syntheticToken: IToken = {
                image: '',
                startOffset: Infinity,
                endOffset: Infinity,
                startLine: Infinity,
                endLine: Infinity,
                startColumn: Infinity,
                endColumn: Infinity,
                tokenType: { name: 'SYNTHETIC' },
                tokenTypeIdx: -1,
            };

            const resultKeys = new Set<string>();
            for (const ctx of result) {
                resultKeys.add(`${ctx.subject.termType}\0${ctx.subject.value}\0${ctx.predicate.value}\0${ctx.object.termType}\0${ctx.object.value}`);
            }

            for (const quad of quads) {
                const key = `${quad.subject.termType}\0${quad.subject.value}\0${quad.predicate.value}\0${quad.object.termType}\0${quad.object.value}`;
                if (!resultKeys.has(key)) {
                    resultKeys.add(key);
                    result.push(toQuadContext(quad.subject, syntheticToken, quad.predicate, syntheticToken, quad.object, syntheticToken));
                }
            }
        }

        return result;
    }

    /**
     * Process triples and return QuadContext objects with token information.
     */
    protected triplesInfo(ctx: CstContext, quads: Quad[]): QuadContext[] {
        const context = this.getChildren(ctx);
        const result: QuadContext[] = [];

        if (context.subject) {
            // A collection in subject position emits its chain before the statements about it.
            const subjectToken = this.subjectInfo(context.subject[0], quads, result);

            if (!context.predicateObjectList) {
                throw new Error('Invalid triples: ' + JSON.stringify(context));
            }

            this.pushStatements(result, subjectToken, this.predicateObjectListInfo(context.predicateObjectList[0], quads));
        } else if (context.blankNodePropertyList) {
            const subjectToken = this.blankNodePropertyListInfo(context.blankNodePropertyList[0], quads, result);

            if (context.predicateObjectList) {
                this.pushStatements(result, subjectToken, this.predicateObjectListInfo(context.predicateObjectList[0], quads));
            }
        } else if (context.reifiedTriple) {
            const reifierToken = this.reifiedTripleInfo(context.reifiedTriple[0], quads, result);

            if (context.predicateObjectList) {
                this.pushStatements(result, reifierToken, this.predicateObjectListInfo(context.predicateObjectList[0], quads));
            }
        } else {
            throw new Error('Invalid triples: ' + JSON.stringify(ctx));
        }

        return result;
    }

    /**
     * Emit the statements of a subject, each followed by the contexts nested in its object,
     * so that a parent statement always precedes the statements of its inline blank node
     * or collection.
     */
    protected pushStatements(
        result: QuadContext[],
        subjectToken: { term: Term; token: IToken },
        pairs: PredicateObjectInfoResult[],
        graphToken?: { term: Term; token: IToken }
    ): void {
        for (const { predicate, object, nested } of pairs) {
            result.push(toQuadContext(
                subjectToken.term, subjectToken.token,
                predicate.term, predicate.token,
                object.term, object.token,
                graphToken?.term, graphToken?.token
            ));

            if (nested && nested.length > 0) {
                result.push(...nested);
            }
        }
    }

    /**
     * Get subject term and token.
     */
    protected subjectInfo(ctx: CstContext, quads: Quad[], infoResults: QuadContext[] = []) {
        const context = this.getChildren(ctx);
        if (context.iri) {
            return this.iriInfo(context.iri[0]);
        } else if (context.blankNode) {
            return this.blankNodeInfo(context.blankNode[0]);
        } else if (context.collection) {
            return this.collectionInfo(context.collection[0], quads, infoResults);
        }
        throw new Error('Invalid subject: ' + JSON.stringify(context));
    }

    /**
     * Get predicate term and token.
     */
    protected predicateInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);
        if (context.iri) {
            const iriInfo = this.iriInfo(context.iri[0]);
            return iriInfo;
        } else if (context.A) {
            return {
                term: dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                token: context.A[0]
            };
        }
        throw new Error('Invalid predicate: ' + JSON.stringify(context));
    }

    /**
     * Get object term and token. The statements nested in the object — those of an inline
     * blank node property list or the chain of a collection — are appended to `nested` with
     * their real source tokens, so callers can emit them right after the parent statement.
     */
    protected objectInfo(ctx: CstContext, quads: Quad[], nested: QuadContext[] = []) {
        const context = this.getChildren(ctx);
        if (context.iri) {
            return this.iriInfo(context.iri[0]);
        } else if (context.literal) {
            return this.literalInfo(context.literal[0]);
        } else if (context.blankNode) {
            return this.blankNodeInfo(context.blankNode[0]);
        } else if (context.blankNodePropertyList) {
            return this.blankNodePropertyListInfo(context.blankNodePropertyList[0], quads, nested);
        } else if (context.collection) {
            return this.collectionInfo(context.collection[0], quads, nested);
        } else if (context.tripleTerm) {
            return this.tripleTermInfo(context.tripleTerm[0]);
        } else if (context.reifiedTriple) {
            return this.reifiedTripleInfo(context.reifiedTriple[0], quads, nested);
        }
        throw new Error('Invalid object: ' + JSON.stringify(context));
    }

    /**
     * Get IRI term and token.
     */
    protected iriInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);
        if (context.prefixedName) {
            return this.prefixedNameInfo(context.prefixedName[0]);
        } else if (context.IRIREF) {
            return {
                term: this.getNamedNode(context),
                token: context.IRIREF[0]
            };
        }
        throw new Error('Invalid IRI: ' + JSON.stringify(context));
    }

    /**
     * Get prefixed name term and token.
     */
    protected prefixedNameInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);
        const token = context.PNAME_LN ? context.PNAME_LN[0] : context.PNAME_NS![0];
        const { prefix, localName } = splitPrefixedName(token.image);

        const namespaceIri = this.namespaces[prefix];

        if (!namespaceIri) {
            throw new Error(`Undefined prefix: ${prefix}`);
        }

        const unescapedLocalName = localName.replace(/\\([_~.\-!$&'()*+,;=/?#@%])/g, '$1');

        return {
            term: dataFactory.namedNode(namespaceIri.value + unescapedLocalName),
            token
        };
    }

    /**
     * Get blank node term and token.
     */
    protected blankNodeInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);

        if (context.BLANK_NODE_LABEL) {
            const token = context.BLANK_NODE_LABEL[0];

            return {
                term: dataFactory.blankNode(getBlankNodeIdFromToken(token) ?? token.image.substring(2)),
                token
            };
        } else if (context.anon) {
            // Anonymous blank node - return the LBRACKET token from the anon rule
            // The anon rule parses [ ] so we need to find the bracket token
            const anonCtx = context.anon[0];
            const token = this.findFirstToken(anonCtx);

            return {
                term: dataFactory.blankNode(),
                token: token!
            };
        }

        throw new Error('Invalid blank node: ' + JSON.stringify(context));
    }

    /**
     * Get blank node property list info. Returns the blank node subject and
    * populates infoResults with QuadContext objects for internal triples.
     */
    protected blankNodePropertyListInfo(ctx: CstContext, quads: Quad[], infoResults: QuadContext[]) {
        const context = this.getChildren(ctx);
        // The LBRACKET token marks the start of this blank node
        const token = context.LBRACKET ? context.LBRACKET[0] : this.findFirstToken(context)!;
        // Use pre-assigned ID from LBRACKET token payload if available
        const blankNodeId = token ? getBlankNodeIdFromToken(token) : undefined;
        const subject = dataFactory.blankNode(blankNodeId);
        const subjectToken = { term: subject, token };

        if (context.predicateObjectList) {
            const pairs = this.predicateObjectListInfo(context.predicateObjectList[0], quads);

            for (const { predicate, object } of pairs) {
                quads.push(dataFactory.quad(subject, predicate.term as NamedNode, object.term));
            }

            this.pushStatements(infoResults, subjectToken, pairs);
        }

        return subjectToken;
    }

    /**
     * Get literal term and token.
     */
    protected literalInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);

        if (context.stringLiteral) {
            return this.stringLiteralInfo(context.stringLiteral[0]);
        } else if (context.numericLiteral) {
            return this.numericLiteralInfo(context.numericLiteral[0]);
        } else if (context.booleanLiteral) {
            return this.booleanLiteralInfo(context.booleanLiteral[0]);
        }

        throw new Error('Invalid literal: ' + JSON.stringify(context));
    }

    /**
     * Get string literal term and token.
     */
    protected stringLiteralInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);
        const stringCtx = context.string![0];
        const token = this.findStringToken(stringCtx)!;
        const value = this.visit(stringCtx as any) as string;

        let literal: Literal;

        if (context.datatype) {
            const datatype = this.visit(context.datatype[0] as any) as NamedNode;

            literal = dataFactory.literal(value, datatype);
        } else if (context.LANGTAG) {
            const langtag = context.LANGTAG[0].image.slice(1);
            literal = dataFactory.literal(value, langtag);
        } else {
            literal = dataFactory.literal(value);
        }

        return { term: literal, token };
    }

    /**
     * Get numeric literal term and token.
     */
    protected numericLiteralInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);

        if (context.INTEGER) {
            return {
                term: dataFactory.literal(context.INTEGER[0].image, dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
                token: context.INTEGER[0]
            };
        } else if (context.DECIMAL) {
            return {
                term: dataFactory.literal(context.DECIMAL[0].image, dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#decimal')),
                token: context.DECIMAL[0]
            };
        } else if (context.DOUBLE) {
            return {
                term: dataFactory.literal(context.DOUBLE[0].image, dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double')),
                token: context.DOUBLE[0]
            };
        }

        throw new Error('Invalid numeric literal: ' + JSON.stringify(context));
    }

    /**
     * Get boolean literal term and token.
     */
    protected booleanLiteralInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);

        if (context.true) {
            return {
                term: dataFactory.literal('true', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean')),
                token: context.true[0]
            };
        } else if (context.false) {
            return {
                term: dataFactory.literal('false', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean')),
                token: context.false[0]
            };
        }

        throw new Error('Invalid boolean literal: ' + JSON.stringify(context));
    }

    /**
     * Get collection info. Returns the head node token (LPARENT).
     *
     * The `rdf:first` / `rdf:rest` chain is appended to `infoResults` with real tokens so that
     * the items of a list can be located in the source: the head node is marked by `(`, every
     * later chain node by the token of the item it holds, and the `rdf:rest` object of the last
     * node by `)`. The chain statements reuse the item token as their predicate token because
     * the predicates are not written in the text.
     */
    protected collectionInfo(ctx: CstContext, quads: Quad[], infoResults: QuadContext[] = []) {
        const context = this.getChildren(ctx);
        const token = context.LPARENT ? context.LPARENT[0] : this.findFirstToken(context)!;
        const closingToken = context.RPARENT ? context.RPARENT[0] : token;
        const objectNodes = context.object ?? [];

        if (objectNodes.length === 0) {
            return { term: RDF_NIL, token };
        }

        // Read every item first: the `rdf:rest` statement of a node points at the token of the
        // item that follows, which is only known once that item has been read.
        const items = objectNodes.map(node => {
            const nested: QuadContext[] = [];
            const item = this.objectInfo(node, quads, nested);

            return { term: item.term as Term, token: item.token as IToken, nested };
        });

        // Use pre-assigned ID from LPARENT token for the head node
        const headBlankNodeId = token ? getBlankNodeIdFromToken(token) : undefined;
        const head = dataFactory.blankNode(headBlankNodeId);
        let current: BlankNode = head;
        let currentToken: IToken = token;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const isLast = i === items.length - 1;

            // Derive rest-node IDs from the head ID so they never collide with
            // pre-assigned token blank-node IDs or @rdfjs/data-model counters.
            const restId = headBlankNodeId ? `${headBlankNodeId}-rest-${i + 1}` : undefined;
            const next: Term = isLast ? RDF_NIL : dataFactory.blankNode(restId);
            const nextToken = isLast ? closingToken : items[i + 1].token;

            quads.push(dataFactory.quad(current, RDF_FIRST, item.term));
            quads.push(dataFactory.quad(current, RDF_REST, next));

            infoResults.push(toQuadContext(current, currentToken, RDF_FIRST, item.token, item.term, item.token));

            if (item.nested.length > 0) {
                infoResults.push(...item.nested);
            }

            infoResults.push(toQuadContext(current, currentToken, RDF_REST, item.token, next, nextToken));

            if (!isLast) {
                current = next as BlankNode;
                currentToken = nextToken;
            }
        }

        return { term: head, token };
    }

    /**
     * Get triple term info.
     */
    protected tripleTermInfo(ctx: CstContext) {
        const context = this.getChildren(ctx);
        const token = this.findFirstToken(context)!;
        const subject = this.visit(context.ttSubject![0] as any) as NamedNode | BlankNode;
        const predicate = this.visit(context.predicate![0] as any) as NamedNode;
        const object = this.visit(context.ttObject![0] as any) as Term;

        return {
            term: dataFactory.quad(subject, predicate, object),
            token
        };
    }

    /**
     * Get reified triple info.
     */
    protected reifiedTripleInfo(ctx: CstContext, quads: Quad[], infoResults: QuadContext[]) {
        const context = this.getChildren(ctx);
        const token = this.findFirstToken(context)!;
        const rdfReifies = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies');

        const subject = this.visit(context.rtSubject![0], quads as any) as NamedNode | BlankNode;
        const predicate = this.visit(context.predicate![0] as any) as NamedNode;
        const object = this.visit(context.rtObject![0], quads as any) as Term;

        let reifierNode: NamedNode | BlankNode;

        if (context.reifier) {
            reifierNode = this.visit(context.reifier[0] as any) as NamedNode | BlankNode;
        } else {
            // Use pre-assigned ID from OPEN_REIFIED_TRIPLE token for anonymous reifier
            const openReifiedTripleToken = context.OPEN_REIFIED_TRIPLE?.[0];
            const blankNodeId = openReifiedTripleToken ? getBlankNodeIdFromToken(openReifiedTripleToken) : undefined;
            reifierNode = dataFactory.blankNode(blankNodeId);
        }

        const tripleTerm = dataFactory.quad(subject, predicate, object);
        quads.push(dataFactory.quad(reifierNode, rdfReifies, tripleTerm));

        return { term: reifierNode, token };
    }

    /**
     * Process predicate-object list and return info with tokens.
     */
    protected predicateObjectListInfo(ctx: CstContext, quads: Quad[]): PredicateObjectInfoResult[] {
        const context = this.getChildren(ctx);
        const result: PredicateObjectInfoResult[] = [];

        if (!context.predicate) {
            throw new Error('Invalid predicateObjectList: ' + JSON.stringify(context));
        }

        for (let i = 0; i < context.predicate.length; i++) {
            const predicate = this.predicateInfo(context.predicate[i]);

            for (let { objectTokens, annotationCtx, nested } of this.objectListInfo(context.objectList![i], quads)) {
                for (let objectToken of objectTokens) {
                    result.push({ predicate, object: objectToken, annotationCtx, nested });
                }
            }
        }

        return result;
    }

    /**
     * Process object list and return info with tokens. Each entry carries the statement
     * contexts nested in its object, such as those of an inline blank node.
     */
    protected objectListInfo(ctx: CstContext, quads: Quad[]): ObjectListInfoResult[] {
        const context = this.getChildren(ctx);
        const results: ObjectListInfoResult[] = [];

        for (let i = 0; i < context.object!.length; i++) {
            const nested: QuadContext[] = [];
            const objectToken = this.objectInfo(context.object![i], quads, nested);
            const annotationCtx = context.annotation?.[i];

            results.push({ objectTokens: [objectToken], annotationCtx, nested });
        }

        return results;
    }

    /**
     * Find the first token in a CST context.
     */
    protected findFirstToken(ctx: CstContext): IToken | undefined {
        return findFirstTokenInCst(ctx as any);
    }

    /**
     * Find the string token in a string context.
     */
    protected findStringToken(ctx: CstContext): IToken | undefined {
        return findStringTokenInCst(ctx as any);
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

        // Use pre-assigned ID from LPARENT token for the head blank node
        const lparentToken = ctx.LPARENT?.[0];
        const baseId = lparentToken ? getBlankNodeIdFromToken(lparentToken) : undefined;
        let head = dataFactory.blankNode(baseId);
        let current = head;

        for (let i = 0; i < objectNodes.length; i++) {
            // Visit the object, which may push sub-collection quads into `quads`.
            const elements = this.visit(objectNodes[i], quads as any) as Term[];
            const element = Array.isArray(elements) ? elements[0] : elements;

            quads.push(dataFactory.quad(current, first, element));

            if (i < objectNodes.length - 1) {
                // Derive rest node IDs from base ID
                const restId = baseId ? `${baseId}-rest-${i + 1}` : undefined;
                const next = dataFactory.blankNode(restId);

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
        // Use pre-assigned ID from LBRACKET token
        const lbracketToken = ctx.LBRACKET?.[0];
        const blankNodeId = lbracketToken ? getBlankNodeIdFromToken(lbracketToken) : undefined;
        return dataFactory.blankNode(blankNodeId);
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
        return unescapeRdfString(raw);
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
        const { prefix, localName } = splitPrefixedName(pname);

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
            // Use pre-assigned ID from TILDE token for anonymous reifier
            const tildeToken = ctx.TILDE?.[0];
            const blankNodeId = tildeToken ? getBlankNodeIdFromToken(tildeToken) : undefined;
            return dataFactory.blankNode(blankNodeId);
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
            const token = ctx.BLANK_NODE_LABEL[0];

            return dataFactory.blankNode(getBlankNodeIdFromToken(token) ?? token.image.substring(2));
        } else {
            // Use pre-assigned ID from LBRACKET token
            const lbracketToken = ctx.LBRACKET?.[0];
            const blankNodeId = lbracketToken ? getBlankNodeIdFromToken(lbracketToken) : undefined;
            return dataFactory.blankNode(blankNodeId);
        }
    }
}
