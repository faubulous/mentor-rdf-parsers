// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term, Variable } from '@rdfjs/types';
import type { CstNode, IToken } from 'chevrotain';
import { N3Parser } from './parser.js';
import type { QuadInfo, TermToken } from '../types.js';

const BaseVisitor = new N3Parser().getBaseCstVisitorConstructor();

/**
 * CST context interface for N3 grammar rules.
 * Using index signature to be compatible with Chevrotain's visitor pattern.
 */
interface CstContext {
    [key: string]: CstContext[] | IToken[] | undefined;
    // Document structure
    n3Doc?: CstContext[];
    n3Statement?: CstContext[];
    n3Directive?: CstContext[];
    sparqlDirective?: CstContext[];

    // Directives
    prefix?: CstContext[];
    base?: CstContext[];
    sparqlPrefix?: CstContext[];
    sparqlBase?: CstContext[];
    forAll?: CstContext[];
    forSome?: CstContext[];

    // Triples and statements
    triples?: CstContext[];
    subject?: CstContext[];
    predicateObjectList?: CstContext[];
    verb?: CstContext[];
    predicate?: CstContext[];
    objectList?: CstContext[];
    object?: CstContext[];

    // Expressions and paths
    expression?: CstContext[];
    path?: CstContext[];
    pathItem?: CstContext[];

    // Quick variables
    quickVar?: CstContext[];

    // IRI and prefixed names
    iri?: CstContext[];
    prefixedName?: CstContext[];

    // Blank nodes
    blankNode?: CstContext[];
    blankNodePropertyList?: CstContext[];
    anon?: CstContext[];

    // Collections
    collection?: CstContext[];

    // Literals
    literal?: CstContext[];
    stringLiteral?: CstContext[];
    numericLiteral?: CstContext[];
    booleanLiteral?: CstContext[];
    string?: CstContext[];
    datatype?: CstContext[];

    // Formula
    formula?: CstContext[];
    formulaContent?: CstContext[];

    // Tokens
    PNAME_NS?: IToken[];
    PNAME_LN?: IToken[];
    IRIREF?: IToken[];
    BLANK_NODE_LABEL?: IToken[];
    LANGTAG?: IToken[];
    INTEGER?: IToken[];
    DECIMAL?: IToken[];
    DOUBLE?: IToken[];
    STRING_LITERAL_QUOTE?: IToken[];
    STRING_LITERAL_SINGLE_QUOTE?: IToken[];
    STRING_LITERAL_LONG_QUOTE?: IToken[];
    STRING_LITERAL_LONG_SINGLE_QUOTE?: IToken[];
    QUICK_VAR?: IToken[];

    // Verb tokens
    A?: IToken[];
    EQUALS_SIGN?: IToken[];
    IMPLIES?: IToken[];
    IMPLIED_BY?: IToken[];
    HAS?: IToken[];
    IS?: IToken[];
    INVERSE_OF?: IToken[];

    // Path tokens
    EXCL?: IToken[];
    CARET?: IToken[];

    // Boolean tokens
    true?: IToken[];
    false?: IToken[];
    LBRACKET?: IToken[];
    LPARENT?: IToken[];
    LCURLY?: IToken[];

    // Children for nested CST nodes
    children?: CstContext;
}

/**
 * Result from parsing a directive.
 */
interface DirectiveResult {
    prefix?: string;
    namespaceIri?: NamedNode;
    baseIri?: NamedNode;
}

/**
 * Result from parsing a verb.
 */
interface VerbResult {
    predicate: Term;
    inversePredicate?: boolean;
}

/**
 * Result from parsing a predicate-object pair.
 */
interface PredicateObjectResult {
    predicate: Term;
    object: Term;
    inversePredicate?: boolean;
}

/**
 * Result from parsing a verb with token info.
 */
interface VerbInfoResult {
    predicate: TermToken;
    inversePredicate?: boolean;
}

/**
 * Result from parsing a predicate-object pair with token info.
 */
interface PredicateObjectInfoResult {
    predicate: TermToken;
    object: TermToken;
    inversePredicate?: boolean;
}

// Well-known IRIs
const RDF_TYPE = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const RDF_FIRST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first');
const RDF_REST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest');
const RDF_NIL = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');
const OWL_SAME_AS = dataFactory.namedNode('http://www.w3.org/2002/07/owl#sameAs');
const LOG_IMPLIES = dataFactory.namedNode('http://www.w3.org/2000/10/swap/log#implies');

/**
 * A visitor class that constructs RDF/JS quads from N3 syntax trees.
 */
export class N3Reader extends BaseVisitor {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces: Record<string, NamedNode> = {};

    /**
     * The base IRI of the document.
     */
    baseIri: NamedNode | null = null;

    /**
     * Counter for generating path-related blank nodes.
     */
    _pathBlankNodeCounter: number = 0;

    constructor() {
        super();

        this.validateVisitor();
    }

    /**
     * Helper to extract children from a CstNode.
     * Chevrotain's parser.parse() returns { name, children } but visitor methods expect children directly.
     */
    protected getChildren(ctx: CstContext): CstContext {
        return ctx.children ? ctx.children : ctx;
    }

    // ── Top-level ──────────────────────────────────────────────────────────

    n3Doc(ctx: CstContext): Quad[] {
        const quads: Quad[] = [];

        // Process sparql directives
        if (ctx.sparqlDirective) {
            for (const directive of ctx.sparqlDirective) {
                this._processDirectiveResult(this.visit(directive as any) as DirectiveResult);
            }
        }

        // Process n3Statements
        if (ctx.n3Statement) {
            for (const stmt of ctx.n3Statement) {
                this.visit(stmt, quads as any);
            }
        }

        return quads;
    }

    /**
     * Parse the document and return quad information with source tokens.
     * This is useful for IDE features that need to associate positions with triples.
     */
    n3DocInfo(ctx: CstNode): QuadInfo[] {
        const context = this.getChildren(ctx);
        const result: QuadInfo[] = [];
        const quads: Quad[] = []; // For internal quad generation

        // Process sparql directives
        if (context.sparqlDirective) {
            for (const directive of context.sparqlDirective) {
                this._processDirectiveResult(this.visit(directive as any) as DirectiveResult);
            }
        }

        // Process n3Statements
        if (context.n3Statement) {
            for (const stmt of context.n3Statement) {
                this.n3StatementInfo(stmt, quads, result);
            }
        }

        return result;
    }

    /**
     * Process n3Statement and collect QuadInfo.
     */
    protected n3StatementInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): void {
        const context = this.getChildren(ctx);
        if (context.n3Directive) {
            const res = this.visit(context.n3Directive[0] as any) as DirectiveResult;
            this._processDirectiveResult(res);
        } else if (context.triples) {
            this.triplesInfo(context.triples[0], quads, infoResults);
        }
    }

    /**
     * Process triples and collect QuadInfo.
     */
    protected triplesInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): void {
        const context = this.getChildren(ctx);
        // Collect nested triples in a local array first, so we can add main triples before them
        const nestedInfoResults: QuadInfo[] = [];
        const subjectToken = this.subjectInfo(context.subject![0], quads, nestedInfoResults);

        if (context.predicateObjectList) {
            for (const { predicate, object, inversePredicate } of this.predicateObjectListInfo(context.predicateObjectList[0], quads, nestedInfoResults)) {
                if (inversePredicate) {
                    // For `<- pred`, the object becomes the subject and vice versa
                    infoResults.push({
                        subject: object,
                        predicate,
                        object: subjectToken
                    });
                } else {
                    infoResults.push({
                        subject: subjectToken,
                        predicate,
                        object
                    });
                }
            }
        }
        
        // Append nested triples after main triples
        infoResults.push(...nestedInfoResults);
    }

    /**
     * Get subject term and token.
     */
    protected subjectInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): TermToken {
        const context = this.getChildren(ctx);
        return this.expressionInfo(context.expression![0], quads, infoResults);
    }

    /**
     * Get expression term and token.
     */
    protected expressionInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): TermToken {
        const context = this.getChildren(ctx);
        return this.pathInfo(context.path![0], quads, infoResults);
    }

    /**
     * Get path term and token.
     */
    protected pathInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): TermToken {
        const context = this.getChildren(ctx);
        let nodeToken = this.pathItemInfo(context.pathItem![0], quads, infoResults);

        // Handle path operators: ! (forward) and ^ (reverse)
        if (context.EXCL && context.path) {
            const property = this.visit(context.path[0], quads as any) as NamedNode;
            const blank = dataFactory.blankNode(`_path${this._pathBlankNodeCounter++}`);
            quads.push(dataFactory.quad(nodeToken.term as NamedNode | BlankNode, property, blank));
            // Keep the original token but update the term
            return { term: blank, token: nodeToken.token };
        } else if (context.CARET && context.path) {
            const property = this.visit(context.path[0], quads as any) as NamedNode;
            const blank = dataFactory.blankNode(`_path${this._pathBlankNodeCounter++}`);
            quads.push(dataFactory.quad(blank, property, nodeToken.term as NamedNode | BlankNode | Literal));
            return { term: blank, token: nodeToken.token };
        }

        return nodeToken;
    }

    /**
     * Get pathItem term and token.
     */
    protected pathItemInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): TermToken {
        const context = this.getChildren(ctx);
        if (context.formula) {
            return this.formulaInfo(context.formula[0], quads, infoResults);
        } else if (context.collection) {
            return this.collectionInfo(context.collection[0], quads);
        } else if (context.blankNodePropertyList) {
            return this.blankNodePropertyListInfo(context.blankNodePropertyList[0], quads, infoResults);
        } else if (context.quickVar) {
            return this.quickVarInfo(context.quickVar[0]);
        } else if (context.iri) {
            return this.iriInfo(context.iri[0]);
        } else if (context.blankNode) {
            return this.blankNodeInfo(context.blankNode[0]);
        } else if (context.literal) {
            return this.literalInfo(context.literal[0]);
        }

        throw new Error('Invalid pathItem: ' + JSON.stringify(context));
    }

    /**
     * Process predicate-object list and return info with tokens.
     */
    protected predicateObjectListInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): PredicateObjectInfoResult[] {
        const context = this.getChildren(ctx);
        const result: PredicateObjectInfoResult[] = [];

        if (!context.verb) return result;

        for (let i = 0; i < context.verb.length; i++) {
            const verbResult = this.verbInfo(context.verb[i], quads, infoResults);

            if (context.objectList && context.objectList[i]) {
                const objectTokens = this.objectListInfo(context.objectList[i], quads, infoResults);

                for (const objToken of objectTokens) {
                    result.push({
                        predicate: verbResult.predicate,
                        object: objToken,
                        inversePredicate: verbResult.inversePredicate || false
                    });
                }
            }
        }

        return result;
    }

    /**
     * Get verb term and token.
     */
    protected verbInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): VerbInfoResult {
        const context = this.getChildren(ctx);
        if (context.A) {
            return {
                predicate: { term: RDF_TYPE, token: context.A[0] }
            };
        } else if (context.EQUALS_SIGN) {
            return {
                predicate: { term: OWL_SAME_AS, token: context.EQUALS_SIGN[0] }
            };
        } else if (context.IMPLIES) {
            return {
                predicate: { term: LOG_IMPLIES, token: context.IMPLIES[0] }
            };
        } else if (context.IMPLIED_BY) {
            return {
                predicate: { term: LOG_IMPLIES, token: context.IMPLIED_BY[0] },
                inversePredicate: true
            };
        } else if (context.HAS) {
            const predToken = this.expressionInfo(context.expression![0], quads, infoResults);
            return { predicate: predToken };
        } else if (context.IS) {
            const predToken = this.expressionInfo(context.expression![0], quads, infoResults);
            return { predicate: predToken, inversePredicate: true };
        } else if (context.predicate) {
            return this.predicateInfoN3(context.predicate[0], quads, infoResults);
        }

        throw new Error('Invalid verb: ' + JSON.stringify(context));
    }

    /**
     * Get predicate term and token for N3.
     */
    protected predicateInfoN3(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): VerbInfoResult {
        const context = this.getChildren(ctx);
        if (context.INVERSE_OF) {
            const predToken = this.expressionInfo(context.expression![0], quads, infoResults);
            return { predicate: predToken, inversePredicate: true };
        }
        const predToken = this.expressionInfo(context.expression![0], quads, infoResults);
        return { predicate: predToken };
    }

    /**
     * Process object list and return info with tokens.
     */
    protected objectListInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): TermToken[] {
        const context = this.getChildren(ctx);
        const results: TermToken[] = [];

        if (context.object) {
            for (const obj of context.object) {
                results.push(this.objectInfo(obj, quads, infoResults));
            }
        }

        return results;
    }

    /**
     * Get object term and token.
     */
    protected objectInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): TermToken {
        const context = this.getChildren(ctx);
        return this.expressionInfo(context.expression![0], quads, infoResults);
    }

    /**
     * Get IRI term and token.
     */
    protected iriInfo(ctx: CstContext): TermToken {
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
    protected prefixedNameInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        const token = context.PNAME_LN ? context.PNAME_LN[0] : context.PNAME_NS![0];
        const pname = token.image;
        const colonIndex = pname.indexOf(':');
        const prefix = colonIndex > -1 ? pname.slice(0, colonIndex) : '';
        const localName = colonIndex > -1 ? pname.slice(colonIndex + 1) : '';

        let namespaceIri = this.namespaces[prefix];

        if (!namespaceIri) {
            if (prefix === '') {
                namespaceIri = dataFactory.namedNode('#');
                this.namespaces[''] = namespaceIri;
            } else {
                throw new Error(`Undefined prefix: ${prefix}`);
            }
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
    protected blankNodeInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        if (context.BLANK_NODE_LABEL) {
            return {
                term: dataFactory.blankNode(context.BLANK_NODE_LABEL[0].image),
                token: context.BLANK_NODE_LABEL[0]
            };
        } else if (context.anon) {
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
     * Get blank node property list info.
     */
    protected blankNodePropertyListInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): TermToken {
        const context = this.getChildren(ctx);
        const token = context.LBRACKET ? context.LBRACKET[0] : this.findFirstToken(context)!;
        const subject = dataFactory.blankNode();
        const subjectToken: TermToken = { term: subject, token };

        if (context.predicateObjectList) {
            for (const { predicate, object, inversePredicate } of this.predicateObjectListInfo(context.predicateObjectList[0], quads)) {
                if (inversePredicate) {
                    quads.push(dataFactory.quad(object.term as NamedNode | BlankNode, predicate.term as NamedNode, subject));
                    infoResults.push({
                        subject: object,
                        predicate,
                        object: subjectToken
                    });
                } else {
                    quads.push(dataFactory.quad(subject, predicate.term as NamedNode, object.term as NamedNode | BlankNode | Literal));
                    infoResults.push({
                        subject: subjectToken,
                        predicate,
                        object
                    });
                }
            }
        }

        return subjectToken;
    }

    /**
     * Get literal term and token.
     */
    protected literalInfo(ctx: CstContext): TermToken {
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
    protected stringLiteralInfo(ctx: CstContext): TermToken {
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
    protected numericLiteralInfo(ctx: CstContext): TermToken {
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
    protected booleanLiteralInfo(ctx: CstContext): TermToken {
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
     * Get collection info.
     */
    protected collectionInfo(ctx: CstContext, quads: Quad[]): TermToken {
        const context = this.getChildren(ctx);
        const token = context.LPARENT ? context.LPARENT[0] : this.findFirstToken(context)!;
        const objectNodes = context.object ?? [];

        if (objectNodes.length === 0) {
            return { term: RDF_NIL, token };
        }

        let head = dataFactory.blankNode();
        let current: BlankNode = head;

        for (let i = 0; i < objectNodes.length; i++) {
            const element = this.visit(objectNodes[i], quads as any) as Term;

            quads.push(dataFactory.quad(current, RDF_FIRST, element as NamedNode | BlankNode | Literal));

            if (i < objectNodes.length - 1) {
                const next = dataFactory.blankNode();
                quads.push(dataFactory.quad(current, RDF_REST, next));
                current = next;
            } else {
                quads.push(dataFactory.quad(current, RDF_REST, RDF_NIL));
            }
        }

        return { term: head, token };
    }

    /**
     * Get formula info.
     */
    protected formulaInfo(ctx: CstContext, parentQuads: Quad[], infoResults: QuadInfo[]): TermToken {
        const context = this.getChildren(ctx);
        const token = context.LCURLY ? context.LCURLY[0] : this.findFirstToken(context)!;
        const formulaQuads: Quad[] = [];

        if (context.formulaContent) {
            // Process formula content and collect QuadInfo
            this.formulaContentInfo(context.formulaContent[0], formulaQuads, infoResults);
        }

        const graphNode = dataFactory.blankNode();

        for (const q of formulaQuads) {
            parentQuads.push(dataFactory.quad(q.subject, q.predicate, q.object, graphNode));
        }

        return { term: graphNode, token };
    }

    /**
     * Process formula content and collect QuadInfo.
     */
    protected formulaContentInfo(ctx: CstContext, quads: Quad[], infoResults: QuadInfo[]): void {
        const context = this.getChildren(ctx);
        
        // Process n3Statements within formula
        if (context.n3Statement) {
            for (const stmt of context.n3Statement) {
                this.n3StatementInfo(stmt, quads, infoResults);
            }
        }
    }

    /**
     * Get quick variable info.
     */
    protected quickVarInfo(ctx: CstContext): TermToken {
        const context = this.getChildren(ctx);
        const token = context.QUICK_VAR![0];
        const name = token.image.slice(1);
        return {
            term: dataFactory.variable(name),
            token
        };
    }

    /**
     * Find the first token in a CST context.
     */
    protected findFirstToken(ctx: CstContext): IToken | undefined {
        for (const key in ctx) {
            if (key === 'children') continue;
            const value = ctx[key];
            if (Array.isArray(value) && value.length > 0) {
                const first = value[0];
                if (typeof (first as IToken).startOffset === 'number') {
                    return first as IToken;
                }
                if ((first as CstContext).children || typeof first === 'object') {
                    const token = this.findFirstToken(first as CstContext);
                    if (token) return token;
                }
            }
        }
        return undefined;
    }

    /**
     * Find the string token in a string context.
     */
    protected findStringToken(ctx: CstContext): IToken | undefined {
        const context = this.getChildren(ctx);
        if (context.STRING_LITERAL_QUOTE) return context.STRING_LITERAL_QUOTE[0];
        if (context.STRING_LITERAL_SINGLE_QUOTE) return context.STRING_LITERAL_SINGLE_QUOTE[0];
        if (context.STRING_LITERAL_LONG_QUOTE) return context.STRING_LITERAL_LONG_QUOTE[0];
        if (context.STRING_LITERAL_LONG_SINGLE_QUOTE) return context.STRING_LITERAL_LONG_SINGLE_QUOTE[0];
        return undefined;
    }

    n3Statement(ctx: CstContext, quads: Quad[]): void {
        if (ctx.n3Directive) {
            const result = this.visit(ctx.n3Directive[0] as any) as DirectiveResult;
            this._processDirectiveResult(result);
        } else if (ctx.triples) {
            this.visit(ctx.triples[0], quads as any);
        }
    }

    n3Directive(ctx: CstContext): DirectiveResult {
        if (ctx.prefix) {
            return this.visit(ctx.prefix[0] as any) as DirectiveResult;
        } else if (ctx.base) {
            return this.visit(ctx.base[0] as any) as DirectiveResult;
        } else if (ctx.forAll) {
            return this.visit(ctx.forAll[0] as any) as DirectiveResult;
        } else if (ctx.forSome) {
            return this.visit(ctx.forSome[0] as any) as DirectiveResult;
        }
        return {};
    }

    sparqlDirective(ctx: CstContext): DirectiveResult {
        if (ctx.sparqlPrefix) {
            return this.visit(ctx.sparqlPrefix[0] as any) as DirectiveResult;
        } else if (ctx.sparqlBase) {
            return this.visit(ctx.sparqlBase[0] as any) as DirectiveResult;
        }
        return {};
    }

    _processDirectiveResult(result: DirectiveResult): void {
        if (!result) return;

        if (result.prefix !== undefined && result.namespaceIri !== undefined) {
            this.namespaces[result.prefix] = result.namespaceIri;
        } else if (result.baseIri !== undefined) {
            this.baseIri = result.baseIri;
        }
    }

    // ── Directives ─────────────────────────────────────────────────────────

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

    forAll(ctx: CstContext): DirectiveResult {
        // @forAll declarations are quantifier hints; we don't emit quads for them.
        return {};
    }

    forSome(ctx: CstContext): DirectiveResult {
        // @forSome declarations are quantifier hints; we don't emit quads for them.
        return {};
    }

    // ── Triples ────────────────────────────────────────────────────────────

    triples(ctx: CstContext, quads: Quad[]): void {
        const subject = this.visit(ctx.subject![0], quads as any) as Term;

        if (ctx.predicateObjectList) {
            for (const { predicate, object, inversePredicate } of this.visit(ctx.predicateObjectList[0], quads as any) as PredicateObjectResult[]) {
                if (inversePredicate) {
                    // For `<- pred`, the object becomes the subject and vice versa
                    quads.push(dataFactory.quad(object as NamedNode | BlankNode, predicate as NamedNode, subject as NamedNode | BlankNode | Literal));
                } else {
                    quads.push(dataFactory.quad(subject as NamedNode | BlankNode, predicate as NamedNode, object as NamedNode | BlankNode | Literal));
                }
            }
        }
    }

    subject(ctx: CstContext, quads: Quad[]): Term {
        return this.visit(ctx.expression![0], quads as any) as Term;
    }

    predicateObjectList(ctx: CstContext, quads: Quad[]): PredicateObjectResult[] {
        const result: PredicateObjectResult[] = [];

        if (!ctx.verb) return result;

        for (let i = 0; i < ctx.verb.length; i++) {
            const verbResult = this.visit(ctx.verb[i], quads as any) as VerbResult;

            if (ctx.objectList && ctx.objectList[i]) {
                const objects = this.visit(ctx.objectList[i], quads as any) as Term[];

                for (const obj of objects) {
                    result.push({
                        predicate: verbResult.predicate,
                        object: obj,
                        inversePredicate: verbResult.inversePredicate || false
                    });
                }
            }
        }

        return result;
    }

    verb(ctx: CstContext, quads: Quad[]): VerbResult {
        if (ctx.A) {
            return { predicate: RDF_TYPE };
        } else if (ctx.EQUALS_SIGN) {
            return { predicate: OWL_SAME_AS };
        } else if (ctx.IMPLIES) {
            return { predicate: LOG_IMPLIES };
        } else if (ctx.IMPLIED_BY) {
            // `<= expr` means `expr log:implies this`, so we need to swap subject and object
            return { predicate: LOG_IMPLIES, inversePredicate: true };
        } else if (ctx.HAS) {
            // `has expr` is the same as just `expr` as a predicate
            const predicate = this.visit(ctx.expression![0], quads as any) as Term;
            return { predicate };
        } else if (ctx.IS) {
            // `is expr of` means use the expression as predicate but swap subject/object
            const predicate = this.visit(ctx.expression![0], quads as any) as Term;
            return { predicate, inversePredicate: true };
        } else if (ctx.predicate) {
            return this.visit(ctx.predicate[0], quads as any) as VerbResult;
        }

        throw new Error('Invalid verb: ' + JSON.stringify(ctx));
    }

    predicate(ctx: CstContext, quads: Quad[]): VerbResult {
        if (ctx.INVERSE_OF) {
            // `<- expr` means the expression is the predicate but subject/object are swapped
            const predicate = this.visit(ctx.expression![0], quads as any) as Term;
            return { predicate, inversePredicate: true };
        }
        // Regular predicate
        const predicate = this.visit(ctx.expression![0], quads as any) as Term;
        return { predicate };
    }

    objectList(ctx: CstContext, quads: Quad[]): Term[] {
        const results: Term[] = [];

        if (ctx.object) {
            for (const obj of ctx.object) {
                results.push(this.visit(obj, quads as any) as Term);
            }
        }

        return results;
    }

    object(ctx: CstContext, quads: Quad[]): Term {
        return this.visit(ctx.expression![0], quads as any) as Term;
    }

    // ── Expressions & Paths ────────────────────────────────────────────────

    expression(ctx: CstContext, quads: Quad[]): Term {
        return this.visit(ctx.path![0], quads as any) as Term;
    }

    path(ctx: CstContext, quads: Quad[]): Term {
        let node = this.visit(ctx.pathItem![0], quads as any) as Term;

        // Handle path operators: ! (forward) and ^ (reverse)
        if (ctx.EXCL && ctx.path) {
            // a!b means: create a blank node _:x, emit a b _:x, return _:x
            const property = this.visit(ctx.path[0], quads as any) as NamedNode;
            const blank = dataFactory.blankNode(`_path${this._pathBlankNodeCounter++}`);
            quads.push(dataFactory.quad(node as NamedNode | BlankNode, property, blank));
            return blank;
        } else if (ctx.CARET && ctx.path) {
            // a^b means: create a blank node _:x, emit _:x b a, return _:x
            const property = this.visit(ctx.path[0], quads as any) as NamedNode;
            const blank = dataFactory.blankNode(`_path${this._pathBlankNodeCounter++}`);
            quads.push(dataFactory.quad(blank, property, node as NamedNode | BlankNode | Literal));
            return blank;
        }

        return node;
    }

    pathItem(ctx: CstContext, quads: Quad[]): Term {
        if (ctx.formula) {
            return this.visit(ctx.formula[0], quads as any) as Term;
        } else if (ctx.collection) {
            return this.visit(ctx.collection[0], quads as any) as Term;
        } else if (ctx.blankNodePropertyList) {
            return this.visit(ctx.blankNodePropertyList[0], quads as any) as Term;
        } else if (ctx.quickVar) {
            return this.visit(ctx.quickVar[0] as any) as Term;
        } else if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as Term;
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0] as any) as Term;
        } else if (ctx.literal) {
            return this.visit(ctx.literal[0] as any) as Term;
        }

        throw new Error('Invalid pathItem: ' + JSON.stringify(ctx));
    }

    // ── Formula ────────────────────────────────────────────────────────────

    formula(ctx: CstContext, parentQuads: Quad[]): BlankNode {
        const formulaQuads: Quad[] = [];

        if (ctx.formulaContent) {
            this.visit(ctx.formulaContent[0], formulaQuads as any);
        }

        // In N3, a formula is a graph term represented as a blank node.
        // The triples within the formula belong to that graph.
        const graphNode = dataFactory.blankNode();

        // Push formula quads into the parent quads with the graph node
        for (const q of formulaQuads) {
            parentQuads.push(dataFactory.quad(q.subject, q.predicate, q.object, graphNode));
        }

        return graphNode;
    }

    formulaContent(ctx: CstContext, quads: Quad[]): void {
        if (ctx.sparqlDirective) {
            const result = this.visit(ctx.sparqlDirective[0] as any) as DirectiveResult;
            this._processDirectiveResult(result);
        }

        if (ctx.n3Statement) {
            this.visit(ctx.n3Statement[0], quads as any);
        }

        if (ctx.formulaContent) {
            for (const fc of ctx.formulaContent) {
                this.visit(fc, quads as any);
            }
        }
    }

    // ── Quick Variables ────────────────────────────────────────────────────

    quickVar(ctx: CstContext): Variable {
        // Quick variables are represented as N3 variables — we use blank nodes
        // following the convention of other N3 implementations.
        const name = ctx.QUICK_VAR![0].image.slice(1); // Remove leading '?'
        return dataFactory.variable(name);
    }

    // ── Collections ────────────────────────────────────────────────────────

    collection(ctx: CstContext, quads: Quad[]): NamedNode | BlankNode {
        const objectNodes = ctx.object ?? [];

        if (objectNodes.length === 0) {
            return RDF_NIL;
        }

        let head = dataFactory.blankNode();
        let current: BlankNode = head;

        for (let i = 0; i < objectNodes.length; i++) {
            const element = this.visit(objectNodes[i], quads as any) as Term;

            quads.push(dataFactory.quad(current, RDF_FIRST, element as NamedNode | BlankNode | Literal));

            if (i < objectNodes.length - 1) {
                const next = dataFactory.blankNode();
                quads.push(dataFactory.quad(current, RDF_REST, next));
                current = next;
            } else {
                quads.push(dataFactory.quad(current, RDF_REST, RDF_NIL));
            }
        }

        return head;
    }

    // ── Blank Node Property List ───────────────────────────────────────────

    blankNodePropertyList(ctx: CstContext, quads: Quad[]): BlankNode {
        const subject = dataFactory.blankNode();

        if (ctx.predicateObjectList) {
            for (const { predicate, object, inversePredicate } of this.visit(ctx.predicateObjectList[0], quads as any) as PredicateObjectResult[]) {
                if (inversePredicate) {
                    quads.push(dataFactory.quad(object as NamedNode | BlankNode, predicate as NamedNode, subject));
                } else {
                    quads.push(dataFactory.quad(subject, predicate as NamedNode, object as NamedNode | BlankNode | Literal));
                }
            }
        }

        return subject;
    }

    // ── IRIs ───────────────────────────────────────────────────────────────

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
        const colonIndex = pname.indexOf(':');
        const prefix = colonIndex > -1 ? pname.slice(0, colonIndex) : '';
        const localName = colonIndex > -1 ? pname.slice(colonIndex + 1) : '';

        let namespaceIri = this.namespaces[prefix];

        if (!namespaceIri) {
            // N3 allows implicit empty prefix — resolve to '#'
            if (prefix === '') {
                namespaceIri = dataFactory.namedNode('#');
                this.namespaces[''] = namespaceIri;
            } else {
                throw new Error(`Undefined prefix: ${prefix}`);
            }
        }

        // Unescape backslash-escaped characters in local names
        const unescapedLocalName = localName.replace(/\\([_~.\-!$&'()*+,;=/?#@%])/g, '$1');

        return dataFactory.namedNode(namespaceIri.value + unescapedLocalName);
    }

    // ── Blank Nodes ────────────────────────────────────────────────────────

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
        return dataFactory.blankNode();
    }

    // ── Literals ───────────────────────────────────────────────────────────

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

    datatype(ctx: CstContext): NamedNode {
        if (ctx.iri) {
            return this.visit(ctx.iri[0] as any) as NamedNode;
        } else {
            throw new Error('Invalid datatype: ' + ctx);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * Interpret escape sequences in an N3 string value.
     */
    unescapeString(raw: string): string {
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

    getBaseIri(ctx: CstContext): DirectiveResult {
        const value = this.getNamedNode(ctx);

        this.baseIri = value;

        return { baseIri: value };
    }

    getNamedNode(ctx: CstContext): NamedNode {
        let value = ctx.IRIREF![0].image.slice(1, -1);

        // Resolve Unicode escapes
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
            return dataFactory.namedNode(value);
        }
    }

    getBlankNode(ctx: CstContext): BlankNode {
        if (ctx.BLANK_NODE_LABEL !== undefined) {
            const value = ctx.BLANK_NODE_LABEL[0].image;
            return dataFactory.blankNode(value);
        } else {
            return dataFactory.blankNode();
        }
    }
}
