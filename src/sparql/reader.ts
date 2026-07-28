// @ts-nocheck
import dataFactory from '@rdfjs/data-model';
import type { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import type { CstNode, IToken } from 'chevrotain';
import { SparqlParser } from './parser.js';
import { sparql, BUILT_IN_FUNCTIONS } from './vocabulary.js';
import { getBlankNodeIdFromToken, splitPrefixedName } from '../utils.js';
import { getCstChildren, getOrderedCstChildren, findFirstTokenInCst, findStringTokenInCst, unescapeRdfString } from '../reader-helpers.js';

const BaseVisitor = new SparqlParser().getBaseCstVisitorConstructor();

const RDF_TYPE = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const RDF_FIRST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first');
const RDF_REST = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest');
const RDF_NIL = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');
const RDF_REIFIES = dataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies');

const XSD_INTEGER = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer');
const XSD_DECIMAL = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#decimal');
const XSD_DOUBLE = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#double');
const XSD_BOOLEAN = dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean');

const TRUE = dataFactory.literal('true', XSD_BOOLEAN);

/**
 * The result of visiting a group graph pattern: either the elements of the
 * group or a single sub-select node.
 */
type GroupResult = { subSelect?: Term; elements: Term[] };

/**
 * The context passed down while reading triples productions.
 */
type TriplesContext = { subject?: Term; predicate?: Term; object?: Term; elements: Term[] };

/**
 * A visitor class that constructs an RDF representation of SPARQL 1.2 queries
 * and updates from SPARQL syntax trees, using the SPARQL syntax vocabulary
 * (https://w3id.org/sparql-syntax#).
 *
 * The reader emits RDF/JS quads describing the query structure: the query or
 * update root node is typed (e.g. sparql:SelectQuery), variables become shared
 * blank nodes typed sparql:Variable, graph patterns become typed element nodes
 * collected in rdf:Lists, and syntactic sugar (collections, blank node
 * property lists, reified triples, annotations) is desugared the way the
 * SPARQL 1.2 specification does.
 */
export class SparqlReader extends BaseVisitor {
    /**
     * A map of prefixes to their namespace IRI.
     */
    namespaces: Record<string, NamedNode> = {};

    /**
     * The base IRI of the query.
     */
    baseIri: NamedNode | null = null;

    /**
     * The root node of the last read query or update.
     */
    rootNode: Term | null = null;

    /**
     * Optional IRI to use for the root query or update node. When set, the
     * root node is emitted as this named node instead of a blank node, so
     * that queries can be addressed by a stable IRI, such as the IRI of the
     * document containing the query.
     */
    rootIri: NamedNode | null = null;

    /**
     * The quads accumulated during the current read.
     * Note: Named with an underscore to avoid shadowing the `quads` visitor method.
     */
    protected _quads: Quad[] = [];

    /**
     * Shared variable nodes, keyed by variable name (without sigil).
     */
    protected variables: Map<string, BlankNode> = new Map();

    /**
     * Shared syntactic blank node representations, keyed by blank node ID.
     */
    protected blankNodes: Map<string, BlankNode> = new Map();

    /**
     * The version string of the last VERSION declaration, if any.
     */
    protected versionString: string | null = null;

    constructor() {
        super();

        this.validateVisitor();
    }

    // ==========================================
    // Helpers
    // ==========================================

    protected emit(subject: Term, predicate: NamedNode, object: Term): void {
        this._quads.push(dataFactory.quad(subject, predicate, object));
    }

    /**
     * Create a fresh structural blank node, optionally typed.
     */
    protected createNode(type?: NamedNode): BlankNode {
        const node = dataFactory.blankNode();

        if (type) {
            this.emit(node, RDF_TYPE, type);
        }

        return node;
    }

    /**
     * Build an rdf:List from the given items and return its head.
     */
    protected makeList(items: Term[]): Term {
        if (items.length === 0) {
            return RDF_NIL;
        }

        const head = dataFactory.blankNode();
        let current = head;

        for (let i = 0; i < items.length; i++) {
            this.emit(current, RDF_FIRST, items[i]);

            if (i < items.length - 1) {
                const next = dataFactory.blankNode();
                this.emit(current, RDF_REST, next);
                current = next;
            } else {
                this.emit(current, RDF_REST, RDF_NIL);
            }
        }

        return head;
    }

    /**
     * Create a sparql:TriplePattern element node.
     */
    protected triplePatternNode(subject: Term, predicate: Term, object: Term): BlankNode {
        const node = this.createNode(sparql.TriplePattern);
        this.emit(node, sparql.subject, subject);
        this.emit(node, sparql.predicate, predicate);
        this.emit(node, sparql.object, object);
        return node;
    }

    /**
     * Create a sparql:TripleTerm node.
     */
    protected tripleTermNode(subject: Term, predicate: Term, object: Term): BlankNode {
        const node = this.createNode(sparql.TripleTerm);
        this.emit(node, sparql.subject, subject);
        this.emit(node, sparql.predicate, predicate);
        this.emit(node, sparql.object, object);
        return node;
    }

    /**
     * Create a binary operator expression node.
     */
    protected binaryNode(type: NamedNode, arg1: Term, arg2: Term): BlankNode {
        const node = this.createNode(type);
        this.emit(node, sparql.arg1, arg1);
        this.emit(node, sparql.arg2, arg2);
        return node;
    }

    /**
     * Create a unary operator expression node.
     */
    protected unaryNode(type: NamedNode, arg: Term): BlankNode {
        const node = this.createNode(type);
        this.emit(node, sparql.arg, arg);
        return node;
    }

    /**
     * Create a sparql:BuiltInCall node.
     */
    protected builtInCallNode(fn: NamedNode, args: Term[]): BlankNode {
        const node = this.createNode(sparql.BuiltInCall);
        this.emit(node, sparql.function, fn);
        this.emit(node, sparql.args, this.makeList(args));
        return node;
    }

    /**
     * Create a fresh node representing an anonymous syntactic blank node,
     * reusing the blank node ID pre-assigned to the given token, if any.
     */
    protected syntacticBlankNode(token?: IToken): BlankNode {
        const id = token ? getBlankNodeIdFromToken(token) : undefined;
        const node = dataFactory.blankNode(id);
        this.emit(node, RDF_TYPE, sparql.BlankNode);
        return node;
    }

    /**
     * Get the shared variable node for a VAR1/VAR2 token.
     */
    protected getVariable(token: IToken): BlankNode {
        const name = token.image.slice(1);
        let node = this.variables.get(name);

        if (!node) {
            node = dataFactory.blankNode();
            this.variables.set(name, node);
            this.emit(node, RDF_TYPE, sparql.Variable);
            this.emit(node, sparql.varName, dataFactory.literal(name));
        }

        return node;
    }

    /**
     * Resolve an IRI value against the current base IRI.
     */
    protected resolveIri(value: string): NamedNode {
        if (value === '' && this.baseIri) {
            return dataFactory.namedNode(this.baseIri.value);
        } else if (value !== '' && this.baseIri) {
            try {
                return dataFactory.namedNode(new URL(value, this.baseIri.value).href);
            } catch {
                return dataFactory.namedNode(value);
            }
        }

        return dataFactory.namedNode(value);
    }

    /**
     * Flatten a group graph pattern result into an element array.
     */
    protected groupElements(result: GroupResult): Term[] {
        return result.subSelect ? [result.subSelect] : result.elements;
    }

    /**
     * Create the node representing a UNION branch or lone group.
     */
    protected groupNode(result: GroupResult): Term {
        if (result.subSelect) {
            return result.subSelect;
        }

        const node = this.createNode(sparql.Group);
        this.emit(node, sparql.elements, this.makeList(result.elements));
        return node;
    }

    // ==========================================
    // Entry point and prologue
    // ==========================================

    queryOrUpdate(ctx): Quad[] {
        this.namespaces = {};
        this.baseIri = null;
        this.rootNode = null;
        this._quads = [];
        this.variables = new Map();
        this.blankNodes = new Map();
        this.versionString = null;

        if (ctx.prologue) {
            this.visit(ctx.prologue[0]);
        }

        let root: Term | null = null;

        if (ctx.queryBody) {
            root = this.visit(ctx.queryBody[0]);
        } else if (ctx.updateBody) {
            root = this.visit(ctx.updateBody[0]);
        }

        if (root && this.versionString !== null) {
            this.emit(root, sparql.version, dataFactory.literal(this.versionString));
        }

        // Give the root node a stable identity when a root IRI is configured.
        // Blank nodes cannot appear in the predicate position, so rewriting
        // subjects and objects covers all occurrences.
        if (root && root.termType === 'BlankNode' && this.rootIri) {
            const rootIri = this.rootIri;

            this._quads = this._quads.map(q => (q.subject.equals(root) || q.object.equals(root))
                ? dataFactory.quad(
                    q.subject.equals(root) ? rootIri : q.subject,
                    q.predicate,
                    q.object.equals(root) ? rootIri : q.object)
                : q);

            root = rootIri;
        }

        this.rootNode = root;

        return this._quads;
    }

    query(ctx): Term | null {
        if (ctx.prologue) {
            this.visit(ctx.prologue[0]);
        }

        return ctx.queryBody ? this.visit(ctx.queryBody[0]) : null;
    }

    queryBody(ctx): Term {
        let root: Term;

        if (ctx.selectQuery) {
            root = this.visit(ctx.selectQuery[0]);
        } else if (ctx.constructQuery) {
            root = this.visit(ctx.constructQuery[0]);
        } else if (ctx.describeQuery) {
            root = this.visit(ctx.describeQuery[0]);
        } else if (ctx.askQuery) {
            root = this.visit(ctx.askQuery[0]);
        } else {
            throw new Error('Invalid query body: ' + JSON.stringify(Object.keys(ctx)));
        }

        if (ctx.valuesClause) {
            const values = this.visit(ctx.valuesClause[0]);

            if (values) {
                this.emit(root, sparql.values, values);
            }
        }

        return root;
    }

    prologue(ctx): void {
        for (const { node } of getOrderedCstChildren(ctx)) {
            this.visit(node);
        }
    }

    baseDecl(ctx): void {
        const value = ctx.IRIREF[0].image.slice(1, -1);
        this.baseIri = this.resolveIri(value);
    }

    prefixDecl(ctx): void {
        const prefix = ctx.PNAME_NS[0].image.slice(0, -1);
        const value = ctx.IRIREF[0].image.slice(1, -1);
        this.namespaces[prefix] = this.resolveIri(value);
    }

    versionDecl(ctx): void {
        this.versionString = this.visit(ctx.versionSpecifier[0]);
    }

    versionSpecifier(ctx): string {
        const token = findFirstTokenInCst(ctx);
        return unescapeRdfString(token.image.slice(1, -1));
    }

    // ==========================================
    // Query forms
    // ==========================================

    selectQuery(ctx): Term {
        const node = this.createNode(sparql.SelectQuery);

        this.visit(ctx.selectClause[0], node);

        for (const clause of ctx.datasetClause ?? []) {
            this.visit(clause, node);
        }

        this.emit(node, sparql.where, this.makeList(this.visit(ctx.whereClause[0])));
        this.visit(ctx.solutionModifier[0], node);

        return node;
    }

    subSelect(ctx): Term {
        const node = this.createNode(sparql.SubSelect);

        this.visit(ctx.selectClause[0], node);
        this.emit(node, sparql.where, this.makeList(this.visit(ctx.whereClause[0])));
        this.visit(ctx.solutionModifier[0], node);

        if (ctx.valuesClause) {
            const values = this.visit(ctx.valuesClause[0]);

            if (values) {
                this.emit(node, sparql.values, values);
            }
        }

        return node;
    }

    selectClause(ctx, node: Term): void {
        if (ctx.DISTINCT) {
            this.emit(node, sparql.distinct, TRUE);
        } else if (ctx.REDUCED) {
            this.emit(node, sparql.reduced, TRUE);
        }

        if (ctx.STAR) {
            this.emit(node, sparql.star, TRUE);
            return;
        }

        // Bare variables and (expression AS ?var) aliases share the 'var' key;
        // an alias target is the var that directly follows its expression.
        const items = getOrderedCstChildren(ctx, ['var', 'expression']);
        const projection: Term[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].key === 'expression') {
                const alias = this.createNode(sparql.Alias);
                this.emit(alias, sparql.expression, this.visit(items[i].node));

                if (i + 1 < items.length && items[i + 1].key === 'var') {
                    this.emit(alias, sparql.variable, this.visit(items[i + 1].node));
                    i++;
                }

                projection.push(alias);
            } else {
                projection.push(this.visit(items[i].node));
            }
        }

        this.emit(node, sparql.projection, this.makeList(projection));
    }

    constructQuery(ctx): Term {
        const node = this.createNode(sparql.ConstructQuery);

        for (const clause of ctx.datasetClause ?? []) {
            this.visit(clause, node);
        }

        if (ctx.constructTemplate) {
            this.emit(node, sparql.template, this.makeList(this.visit(ctx.constructTemplate[0])));
            this.emit(node, sparql.where, this.makeList(this.visit(ctx.whereClause[0])));
        } else {
            // CONSTRUCT WHERE shorthand: the template doubles as the pattern.
            const elements = ctx.triplesTemplate ? this.visit(ctx.triplesTemplate[0]) : [];

            this.emit(node, sparql.template, this.makeList(elements));
            this.emit(node, sparql.where, this.makeList(elements));
        }

        this.visit(ctx.solutionModifier[0], node);

        return node;
    }

    describeQuery(ctx): Term {
        const node = this.createNode(sparql.DescribeQuery);

        if (ctx.STAR) {
            this.emit(node, sparql.star, TRUE);
        } else if (ctx.varOrIri) {
            const targets = ctx.varOrIri.map(target => this.visit(target));
            this.emit(node, sparql.describeTargets, this.makeList(targets));
        }

        for (const clause of ctx.datasetClause ?? []) {
            this.visit(clause, node);
        }

        if (ctx.whereClause) {
            this.emit(node, sparql.where, this.makeList(this.visit(ctx.whereClause[0])));
        }

        this.visit(ctx.solutionModifier[0], node);

        return node;
    }

    askQuery(ctx): Term {
        const node = this.createNode(sparql.AskQuery);

        for (const clause of ctx.datasetClause ?? []) {
            this.visit(clause, node);
        }

        this.emit(node, sparql.where, this.makeList(this.visit(ctx.whereClause[0])));
        this.visit(ctx.solutionModifier[0], node);

        return node;
    }

    datasetClause(ctx, node: Term): void {
        if (ctx.defaultGraphClause) {
            this.emit(node, sparql.from, this.visit(ctx.defaultGraphClause[0]));
        } else if (ctx.namedGraphClause) {
            this.emit(node, sparql.fromNamed, this.visit(ctx.namedGraphClause[0]));
        }
    }

    defaultGraphClause(ctx): Term {
        return this.visit(ctx.sourceSelector[0]);
    }

    namedGraphClause(ctx): Term {
        return this.visit(ctx.sourceSelector[0]);
    }

    sourceSelector(ctx): Term {
        return this.visit(ctx.iri[0]);
    }

    whereClause(ctx): Term[] {
        return this.groupElements(this.visit(ctx.groupGraphPattern[0]));
    }

    // ==========================================
    // Solution modifiers
    // ==========================================

    solutionModifier(ctx, node: Term): void {
        if (ctx.groupClause) {
            this.visit(ctx.groupClause[0], node);
        }
        if (ctx.havingClause) {
            this.visit(ctx.havingClause[0], node);
        }
        if (ctx.orderClause) {
            this.visit(ctx.orderClause[0], node);
        }
        if (ctx.limitOffsetClauses) {
            this.visit(ctx.limitOffsetClauses[0], node);
        }
    }

    groupClause(ctx, node: Term): void {
        const conditions = (ctx.groupCondition ?? []).map(condition => this.visit(condition));
        this.emit(node, sparql.groupBy, this.makeList(conditions));
    }

    groupCondition(ctx): Term {
        if (ctx.builtInCall) {
            return this.visit(ctx.builtInCall[0]);
        } else if (ctx.functionCall) {
            return this.visit(ctx.functionCall[0]);
        } else if (ctx.expression) {
            const expression = this.visit(ctx.expression[0]);

            if (ctx.var) {
                const alias = this.createNode(sparql.Alias);
                this.emit(alias, sparql.expression, expression);
                this.emit(alias, sparql.variable, this.visit(ctx.var[0]));
                return alias;
            }

            return expression;
        } else if (ctx.var) {
            return this.visit(ctx.var[0]);
        }

        throw new Error('Invalid group condition: ' + JSON.stringify(Object.keys(ctx)));
    }

    havingClause(ctx, node: Term): void {
        const conditions = (ctx.havingCondition ?? []).map(condition => this.visit(condition));
        this.emit(node, sparql.having, this.makeList(conditions));
    }

    havingCondition(ctx): Term {
        return this.visit(ctx.constraint[0]);
    }

    orderClause(ctx, node: Term): void {
        const conditions = (ctx.orderCondition ?? []).map(condition => this.visit(condition));
        this.emit(node, sparql.orderBy, this.makeList(conditions));
    }

    orderCondition(ctx): Term {
        if (ctx.ASC || ctx.DESC) {
            const node = this.createNode(ctx.ASC ? sparql.Asc : sparql.Desc);
            this.emit(node, sparql.expression, this.visit(ctx.brackettedExpression[0]));
            return node;
        } else if (ctx.constraint) {
            return this.visit(ctx.constraint[0]);
        } else if (ctx.var) {
            return this.visit(ctx.var[0]);
        }

        throw new Error('Invalid order condition: ' + JSON.stringify(Object.keys(ctx)));
    }

    limitOffsetClauses(ctx, node: Term): void {
        if (ctx.limitClause) {
            this.visit(ctx.limitClause[0], node);
        }
        if (ctx.offsetClause) {
            this.visit(ctx.offsetClause[0], node);
        }
    }

    limitClause(ctx, node: Term): void {
        this.emit(node, sparql.limit, dataFactory.literal(ctx.INTEGER[0].image, XSD_INTEGER));
    }

    offsetClause(ctx, node: Term): void {
        this.emit(node, sparql.offset, dataFactory.literal(ctx.INTEGER[0].image, XSD_INTEGER));
    }

    // ==========================================
    // VALUES / inline data
    // ==========================================

    valuesClause(ctx): Term | null {
        return ctx.dataBlock ? this.visit(ctx.dataBlock[0]) : null;
    }

    inlineData(ctx): Term {
        return this.visit(ctx.dataBlock[0]);
    }

    dataBlock(ctx): Term {
        if (ctx.inlineDataOneVar) {
            return this.visit(ctx.inlineDataOneVar[0]);
        }

        return this.visit(ctx.inlineDataFull[0]);
    }

    inlineDataOneVar(ctx): Term {
        const node = this.createNode(sparql.Values);
        const variable = this.visit(ctx.var[0]);

        this.emit(node, sparql.variables, this.makeList([variable]));

        const rows = (ctx.dataBlockValue ?? []).map(value => this.makeList([this.visit(value)]));
        this.emit(node, sparql.bindings, this.makeList(rows));

        return node;
    }

    inlineDataFull(ctx): Term {
        const node = this.createNode(sparql.Values);
        const lcurlyOffset = ctx.LCURLY[0].startOffset;

        const variables = (ctx.var ?? []).map(variable => this.visit(variable));
        this.emit(node, sparql.variables, this.makeList(variables));

        // Reconstruct the binding rows: values are grouped between the paren
        // tokens that follow the opening curly brace; NIL is an empty row.
        const items = getOrderedCstChildren(ctx, ['LPARENT', 'RPARENT', 'NIL', 'dataBlockValue'])
            .filter(item => item.offset > lcurlyOffset);

        const rows: Term[] = [];
        let row: Term[] | null = null;

        for (const item of items) {
            if (item.key === 'LPARENT') {
                row = [];
            } else if (item.key === 'RPARENT') {
                rows.push(this.makeList(row ?? []));
                row = null;
            } else if (item.key === 'NIL') {
                rows.push(RDF_NIL);
            } else if (row) {
                row.push(this.visit(item.node));
            }
        }

        this.emit(node, sparql.bindings, this.makeList(rows));

        return node;
    }

    dataBlockValue(ctx): Term {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.rdfLiteral) {
            return this.visit(ctx.rdfLiteral[0]);
        } else if (ctx.numericLiteral) {
            return this.visit(ctx.numericLiteral[0]);
        } else if (ctx.booleanLiteral) {
            return this.visit(ctx.booleanLiteral[0]);
        } else if (ctx.UNDEF) {
            return sparql.undef;
        } else if (ctx.tripleTermData) {
            return this.visit(ctx.tripleTermData[0]);
        }

        throw new Error('Invalid data block value: ' + JSON.stringify(Object.keys(ctx)));
    }

    // ==========================================
    // Group graph patterns
    // ==========================================

    groupGraphPattern(ctx): GroupResult {
        if (ctx.subSelect) {
            return { subSelect: this.visit(ctx.subSelect[0]), elements: [] };
        } else if (ctx.groupGraphPatternSub) {
            return { elements: this.visit(ctx.groupGraphPatternSub[0]) };
        }

        return { elements: [] };
    }

    groupGraphPatternSub(ctx): Term[] {
        const elements: Term[] = [];

        for (const { node } of getOrderedCstChildren(ctx, ['triplesBlock', 'graphPatternNotTriples'])) {
            elements.push(...this.visit(node));
        }

        return elements;
    }

    triplesBlock(ctx): Term[] {
        const elements = this.visit(ctx.triplesSameSubjectPath[0]);

        if (ctx.triplesBlock) {
            elements.push(...this.visit(ctx.triplesBlock[0]));
        }

        return elements;
    }

    graphPatternNotTriples(ctx): Term[] {
        if (ctx.groupOrUnionGraphPattern) {
            return [this.visit(ctx.groupOrUnionGraphPattern[0])];
        } else if (ctx.optionalGraphPattern) {
            return [this.visit(ctx.optionalGraphPattern[0])];
        } else if (ctx.minusGraphPattern) {
            return [this.visit(ctx.minusGraphPattern[0])];
        } else if (ctx.graphGraphPattern) {
            return [this.visit(ctx.graphGraphPattern[0])];
        } else if (ctx.serviceGraphPattern) {
            return [this.visit(ctx.serviceGraphPattern[0])];
        } else if (ctx.filter) {
            return [this.visit(ctx.filter[0])];
        } else if (ctx.bind) {
            return [this.visit(ctx.bind[0])];
        } else if (ctx.inlineData) {
            return [this.visit(ctx.inlineData[0])];
        } else if (ctx.reifiedTripleBlockPath) {
            return this.visit(ctx.reifiedTripleBlockPath[0]);
        }

        throw new Error('Invalid graph pattern: ' + JSON.stringify(Object.keys(ctx)));
    }

    optionalGraphPattern(ctx): Term {
        const node = this.createNode(sparql.Optional);
        const elements = this.groupElements(this.visit(ctx.groupGraphPattern[0]));

        this.emit(node, sparql.elements, this.makeList(elements));

        return node;
    }

    graphGraphPattern(ctx): Term {
        const node = this.createNode(sparql.Graph);

        this.emit(node, sparql.graph, this.visit(ctx.varOrIri[0]));

        const elements = this.groupElements(this.visit(ctx.groupGraphPattern[0]));
        this.emit(node, sparql.elements, this.makeList(elements));

        return node;
    }

    serviceGraphPattern(ctx): Term {
        const node = this.createNode(sparql.Service);

        if (ctx.SILENT) {
            this.emit(node, sparql.silent, TRUE);
        }

        this.emit(node, sparql.endpoint, this.visit(ctx.varOrIri[0]));

        const elements = this.groupElements(this.visit(ctx.groupGraphPattern[0]));
        this.emit(node, sparql.elements, this.makeList(elements));

        return node;
    }

    minusGraphPattern(ctx): Term {
        const node = this.createNode(sparql.Minus);
        const elements = this.groupElements(this.visit(ctx.groupGraphPattern[0]));

        this.emit(node, sparql.elements, this.makeList(elements));

        return node;
    }

    groupOrUnionGraphPattern(ctx): Term {
        const branches = (ctx.groupGraphPattern ?? []).map(branch => this.visit(branch));

        if (branches.length === 1) {
            return this.groupNode(branches[0]);
        }

        const node = this.createNode(sparql.Union);
        this.emit(node, sparql.elements, this.makeList(branches.map(branch => this.groupNode(branch))));

        return node;
    }

    filter(ctx): Term {
        const node = this.createNode(sparql.Filter);
        this.emit(node, sparql.expression, this.visit(ctx.constraint[0]));
        return node;
    }

    constraint(ctx): Term {
        if (ctx.brackettedExpression) {
            return this.visit(ctx.brackettedExpression[0]);
        } else if (ctx.builtInCall) {
            return this.visit(ctx.builtInCall[0]);
        } else if (ctx.functionCall) {
            return this.visit(ctx.functionCall[0]);
        }

        throw new Error('Invalid constraint: ' + JSON.stringify(Object.keys(ctx)));
    }

    bind(ctx): Term {
        const node = this.createNode(sparql.Bind);
        this.emit(node, sparql.expression, this.visit(ctx.expression[0]));
        this.emit(node, sparql.variable, this.visit(ctx.var[0]));
        return node;
    }

    functionCall(ctx): Term {
        const node = this.createNode(sparql.FunctionCall);
        this.emit(node, sparql.function, this.visit(ctx.iri[0]));

        const { distinct, args } = this.visit(ctx.argList[0]);

        if (distinct) {
            this.emit(node, sparql.distinct, TRUE);
        }

        this.emit(node, sparql.args, this.makeList(args));

        return node;
    }

    argList(ctx): { distinct: boolean; args: Term[] } {
        return {
            distinct: !!ctx.DISTINCT,
            args: (ctx.expression ?? []).map(expression => this.visit(expression))
        };
    }

    expressionList(ctx): Term[] {
        return (ctx.expression ?? []).map(expression => this.visit(expression));
    }

    // ==========================================
    // Triples productions (path family, WHERE patterns)
    // ==========================================

    triplesSameSubjectPath(ctx): Term[] {
        const elements: Term[] = [];

        if (ctx.varOrTerm) {
            const subject = this.visit(ctx.varOrTerm[0]);
            this.visit(ctx.propertyListPathNotEmpty[0], { subject, elements });
        } else if (ctx.triplesNodePath) {
            const subject = this.visit(ctx.triplesNodePath[0], elements);

            if (ctx.propertyListPath) {
                this.visit(ctx.propertyListPath[0], { subject, elements });
            }
        } else if (ctx.reifiedTripleBlockPath) {
            return this.visit(ctx.reifiedTripleBlockPath[0]);
        }

        return elements;
    }

    propertyListPath(ctx, context: TriplesContext): void {
        if (ctx.propertyListPathNotEmpty) {
            this.visit(ctx.propertyListPathNotEmpty[0], context);
        }
    }

    propertyListPathNotEmpty(ctx, context: TriplesContext): void {
        // Verbs and object lists alternate; Chevrotain groups them by name,
        // so the pairing is reconstructed from source order.
        let predicate: Term | null = null;

        for (const item of getOrderedCstChildren(ctx, ['verbPath', 'verbSimple', 'objectListPath'])) {
            if (item.key === 'objectListPath') {
                this.visit(item.node, { ...context, predicate });
            } else {
                predicate = this.visit(item.node);
            }
        }
    }

    verbPath(ctx): Term {
        return this.visit(ctx.path[0]);
    }

    verbSimple(ctx): Term {
        return this.visit(ctx.var[0]);
    }

    objectListPath(ctx, context: TriplesContext): void {
        for (const objectPath of ctx.objectPath ?? []) {
            this.visit(objectPath, context);
        }
    }

    objectPath(ctx, context: TriplesContext): void {
        const object = this.visit(ctx.graphNodePath[0], context.elements);

        context.elements.push(this.triplePatternNode(context.subject, context.predicate, object));

        if (ctx.annotationPath) {
            this.visit(ctx.annotationPath[0], { ...context, object });
        }
    }

    graphNodePath(ctx, elements: Term[]): Term {
        if (ctx.varOrTerm) {
            return this.visit(ctx.varOrTerm[0]);
        } else if (ctx.triplesNodePath) {
            return this.visit(ctx.triplesNodePath[0], elements);
        } else if (ctx.reifiedTriple) {
            return this.visit(ctx.reifiedTriple[0], elements);
        }

        throw new Error('Invalid graph node: ' + JSON.stringify(Object.keys(ctx)));
    }

    triplesNodePath(ctx, elements: Term[]): Term {
        if (ctx.collectionPath) {
            return this.visit(ctx.collectionPath[0], elements);
        }

        return this.visit(ctx.blankNodePropertyListPath[0], elements);
    }

    blankNodePropertyListPath(ctx, elements: Term[]): Term {
        const subject = this.syntacticBlankNode(ctx.LBRACKET?.[0]);

        this.visit(ctx.propertyListPathNotEmpty[0], { subject, elements });

        return subject;
    }

    collectionPath(ctx, elements: Term[]): Term {
        return this.readCollection(ctx.graphNodePath ?? [], ctx.LPARENT?.[0], elements);
    }

    /**
     * Desugar a collection into rdf:first/rdf:rest triple patterns over fresh
     * syntactic blank nodes, mirroring the SPARQL 1.2 translation.
     */
    protected readCollection(memberNodes: CstNode[], token: IToken | undefined, elements: Term[]): Term {
        const members = memberNodes.map(member => this.visit(member, elements));

        if (members.length === 0) {
            return RDF_NIL;
        }

        const headId = token ? getBlankNodeIdFromToken(token) : undefined;
        const cells: BlankNode[] = [];

        for (let i = 0; i < members.length; i++) {
            const cellId = i === 0 ? headId : (headId ? `${headId}-rest-${i}` : undefined);
            const cell = dataFactory.blankNode(cellId);
            this.emit(cell, RDF_TYPE, sparql.BlankNode);
            cells.push(cell);
        }

        for (let i = 0; i < members.length; i++) {
            elements.push(this.triplePatternNode(cells[i], RDF_FIRST, members[i]));
            elements.push(this.triplePatternNode(cells[i], RDF_REST, i < members.length - 1 ? cells[i + 1] : RDF_NIL));
        }

        return cells[0];
    }

    // ==========================================
    // Triples productions (non-path family, templates)
    // ==========================================

    triplesTemplate(ctx): Term[] {
        const elements = this.visit(ctx.triplesSameSubject[0]);

        if (ctx.triplesTemplate) {
            elements.push(...this.visit(ctx.triplesTemplate[0]));
        }

        return elements;
    }

    constructTemplate(ctx): Term[] {
        return ctx.constructTriples ? this.visit(ctx.constructTriples[0]) : [];
    }

    constructTriples(ctx): Term[] {
        const elements = this.visit(ctx.triplesSameSubject[0]);

        if (ctx.constructTriples) {
            elements.push(...this.visit(ctx.constructTriples[0]));
        }

        return elements;
    }

    triplesSameSubject(ctx): Term[] {
        const elements: Term[] = [];

        if (ctx.varOrTerm) {
            const subject = this.visit(ctx.varOrTerm[0]);
            this.visit(ctx.propertyListNotEmpty[0], { subject, elements });
        } else if (ctx.triplesNode) {
            const subject = this.visit(ctx.triplesNode[0], elements);

            if (ctx.propertyList) {
                this.visit(ctx.propertyList[0], { subject, elements });
            }
        } else if (ctx.reifiedTripleBlock) {
            return this.visit(ctx.reifiedTripleBlock[0]);
        }

        return elements;
    }

    propertyList(ctx, context: TriplesContext): void {
        if (ctx.propertyListNotEmpty) {
            this.visit(ctx.propertyListNotEmpty[0], context);
        }
    }

    propertyListNotEmpty(ctx, context: TriplesContext): void {
        let predicate: Term | null = null;

        for (const item of getOrderedCstChildren(ctx, ['verb', 'objectList'])) {
            if (item.key === 'objectList') {
                this.visit(item.node, { ...context, predicate });
            } else {
                predicate = this.visit(item.node);
            }
        }
    }

    verb(ctx): Term {
        if (ctx.varOrIri) {
            return this.visit(ctx.varOrIri[0]);
        }

        return RDF_TYPE;
    }

    objectList(ctx, context: TriplesContext): void {
        for (const graphObject of ctx.graphObject ?? []) {
            this.visit(graphObject, context);
        }
    }

    graphObject(ctx, context: TriplesContext): void {
        const object = this.visit(ctx.graphNode[0], context.elements);

        context.elements.push(this.triplePatternNode(context.subject, context.predicate, object));

        if (ctx.annotation) {
            this.visit(ctx.annotation[0], { ...context, object });
        }
    }

    graphNode(ctx, elements: Term[]): Term {
        if (ctx.varOrTerm) {
            return this.visit(ctx.varOrTerm[0]);
        } else if (ctx.triplesNode) {
            return this.visit(ctx.triplesNode[0], elements);
        } else if (ctx.reifiedTriple) {
            return this.visit(ctx.reifiedTriple[0], elements);
        }

        throw new Error('Invalid graph node: ' + JSON.stringify(Object.keys(ctx)));
    }

    triplesNode(ctx, elements: Term[]): Term {
        if (ctx.collection) {
            return this.visit(ctx.collection[0], elements);
        }

        return this.visit(ctx.blankNodePropertyList[0], elements);
    }

    blankNodePropertyList(ctx, elements: Term[]): Term {
        const subject = this.syntacticBlankNode(ctx.LBRACKET?.[0]);

        this.visit(ctx.propertyListNotEmpty[0], { subject, elements });

        return subject;
    }

    collection(ctx, elements: Term[]): Term {
        return this.readCollection(ctx.graphNode ?? [], ctx.LPARENT?.[0], elements);
    }

    // ==========================================
    // Property paths
    // ==========================================

    path(ctx): Term {
        return this.visit(ctx.pathAlternative[0]);
    }

    pathAlternative(ctx): Term {
        const members = (ctx.pathSequence ?? []).map(sequence => this.visit(sequence));

        if (members.length === 1) {
            return members[0];
        }

        const node = this.createNode(sparql.AltPath);
        this.emit(node, sparql.pathElements, this.makeList(members));

        return node;
    }

    pathSequence(ctx): Term {
        const members = (ctx.pathEltOrInverse ?? []).map(element => this.visit(element));

        if (members.length === 1) {
            return members[0];
        }

        const node = this.createNode(sparql.SeqPath);
        this.emit(node, sparql.pathElements, this.makeList(members));

        return node;
    }

    pathEltOrInverse(ctx): Term {
        const path = this.visit(ctx.pathElt[0]);

        if (ctx.CARET) {
            const node = this.createNode(sparql.InversePath);
            this.emit(node, sparql.path, path);
            return node;
        }

        return path;
    }

    pathElt(ctx): Term {
        const path = this.visit(ctx.pathPrimary[0]);

        if (ctx.pathMod) {
            const node = this.createNode(this.visit(ctx.pathMod[0]));
            this.emit(node, sparql.path, path);
            return node;
        }

        return path;
    }

    pathMod(ctx): NamedNode {
        if (ctx.QUESTION_MARK) {
            return sparql.ZeroOrOnePath;
        } else if (ctx.STAR) {
            return sparql.ZeroOrMorePath;
        }

        return sparql.OneOrMorePath;
    }

    pathPrimary(ctx): Term {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.A) {
            return RDF_TYPE;
        } else if (ctx.pathNegatedPropertySet) {
            const node = this.createNode(sparql.NegatedPath);
            this.emit(node, sparql.pathElements, this.makeList(this.visit(ctx.pathNegatedPropertySet[0])));
            return node;
        } else if (ctx.path) {
            return this.visit(ctx.path[0]);
        }

        throw new Error('Invalid path primary: ' + JSON.stringify(Object.keys(ctx)));
    }

    pathNegatedPropertySet(ctx): Term[] {
        return (ctx.pathOneInPropertySet ?? []).map(member => this.visit(member));
    }

    pathOneInPropertySet(ctx): Term {
        const iri = ctx.iri ? this.visit(ctx.iri[0]) : RDF_TYPE;

        if (ctx.CARET) {
            const node = this.createNode(sparql.InversePath);
            this.emit(node, sparql.path, iri);
            return node;
        }

        return iri;
    }

    // ==========================================
    // RDF 1.2 reification, annotations and triple terms
    // ==========================================

    reifiedTripleBlockPath(ctx): Term[] {
        const elements: Term[] = [];
        const subject = this.visit(ctx.reifiedTriple[0], elements);

        if (ctx.propertyListPath) {
            this.visit(ctx.propertyListPath[0], { subject, elements });
        }

        return elements;
    }

    reifiedTripleBlock(ctx): Term[] {
        const elements: Term[] = [];
        const subject = this.visit(ctx.reifiedTriple[0], elements);

        if (ctx.propertyList) {
            this.visit(ctx.propertyList[0], { subject, elements });
        }

        return elements;
    }

    reifiedTriplePathBlock(ctx): Term[] {
        const elements: Term[] = [];
        const subject = this.visit(ctx.reifiedTriplePath[0], elements);

        if (ctx.propertyListPathNotEmpty) {
            this.visit(ctx.propertyListPathNotEmpty[0], { subject, elements });
        }

        return elements;
    }

    reifiedTriple(ctx, elements: Term[]): Term {
        const subject = this.visit(ctx.reifiedTripleSubject[0], elements);
        const predicate = this.visit(ctx.verb[0]);
        const object = this.visit(ctx.reifiedTripleObject[0], elements);

        return this.readReifiedTriple(ctx, subject, predicate, object, elements);
    }

    reifiedTriplePath(ctx, elements: Term[]): Term {
        const subject = this.visit(ctx.reifiedTripleSubject[0], elements);
        const predicate = this.visit(ctx.verbPath[0]);
        const object = this.visit(ctx.reifiedTripleObjectPath[0], elements);

        return this.readReifiedTriple(ctx, subject, predicate, object, elements);
    }

    /**
     * Desugar a reified triple << s p o ~ r >> into the triple pattern
     * (r, rdf:reifies, triple term) and return the reifier as focus node.
     */
    protected readReifiedTriple(ctx, subject: Term, predicate: Term, object: Term, elements: Term[]): Term {
        const tripleTerm = this.tripleTermNode(subject, predicate, object);

        let reifier: Term;

        if (ctx.reifier) {
            reifier = this.visit(ctx.reifier[0]);
        } else {
            reifier = this.syntacticBlankNode(ctx.OPEN_REIFIED_TRIPLE?.[0]);
        }

        elements.push(this.triplePatternNode(reifier, RDF_REIFIES, tripleTerm));

        return reifier;
    }

    reifiedTripleSubject(ctx, elements: Term[]): Term {
        return this.readReifiedTripleTerm(ctx, elements);
    }

    reifiedTripleObject(ctx, elements: Term[]): Term {
        return this.readReifiedTripleTerm(ctx, elements);
    }

    reifiedTripleObjectPath(ctx, elements: Term[]): Term {
        return this.readReifiedTripleTerm(ctx, elements);
    }

    protected readReifiedTripleTerm(ctx, elements: Term[]): Term {
        const context = getCstChildren(ctx);

        if (context.reifiedTriple) {
            return this.visit(context.reifiedTriple[0], elements);
        } else if (context.reifiedTriplePath) {
            return this.visit(context.reifiedTriplePath[0], elements);
        } else if (context.tripleTerm) {
            return this.visit(context.tripleTerm[0]);
        } else if (context.var) {
            return this.visit(context.var[0]);
        } else if (context.iri) {
            return this.visit(context.iri[0]);
        } else if (context.rdfLiteral) {
            return this.visit(context.rdfLiteral[0]);
        } else if (context.numericLiteral) {
            return this.visit(context.numericLiteral[0]);
        } else if (context.booleanLiteral) {
            return this.visit(context.booleanLiteral[0]);
        } else if (context.blankNode) {
            return this.visit(context.blankNode[0]);
        }

        throw new Error('Invalid reified triple term: ' + JSON.stringify(Object.keys(context)));
    }

    annotationPath(ctx, context: TriplesContext): void {
        this.readAnnotations(ctx, ['reifier', 'annotationBlockPath'], context);
    }

    annotation(ctx, context: TriplesContext): void {
        this.readAnnotations(ctx, ['reifier', 'annotationBlock'], context);
    }

    /**
     * Process the reifier and annotation block sequence that follows an
     * object. Each reifier asserts (r, rdf:reifies, tt); an annotation block
     * applies its property list to the preceding reifier, or to a fresh
     * anonymous one if there is none.
     */
    protected readAnnotations(ctx, keys: string[], context: TriplesContext): void {
        let tripleTerm: Term | null = null;
        let currentReifier: Term | null = null;

        const getTripleTerm = () => {
            if (!tripleTerm) {
                tripleTerm = this.tripleTermNode(context.subject, context.predicate, context.object);
            }
            return tripleTerm;
        };

        for (const item of getOrderedCstChildren(ctx, keys)) {
            if (item.key === 'reifier') {
                currentReifier = this.visit(item.node);
                context.elements.push(this.triplePatternNode(currentReifier, RDF_REIFIES, getTripleTerm()));
            } else {
                if (!currentReifier) {
                    const blockContext = getCstChildren(item.node);
                    currentReifier = this.syntacticBlankNode(blockContext.OPEN_ANNOTATION?.[0]);
                    context.elements.push(this.triplePatternNode(currentReifier, RDF_REIFIES, getTripleTerm()));
                }

                this.visit(item.node, { subject: currentReifier, elements: context.elements });
                currentReifier = null;
            }
        }
    }

    annotationBlockPath(ctx, context: TriplesContext): void {
        this.visit(ctx.propertyListPathNotEmpty[0], context);
    }

    annotationBlock(ctx, context: TriplesContext): void {
        this.visit(ctx.propertyListNotEmpty[0], context);
    }

    reifier(ctx): Term {
        if (ctx.varOrReifierId) {
            return this.visit(ctx.varOrReifierId[0]);
        }

        return this.syntacticBlankNode(ctx.TILDE?.[0]);
    }

    varOrReifierId(ctx): Term {
        if (ctx.var) {
            return this.visit(ctx.var[0]);
        } else if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        }

        throw new Error('Invalid reifier: ' + JSON.stringify(Object.keys(ctx)));
    }

    tripleTerm(ctx): Term {
        const subject = this.visit(ctx.tripleTermSubject[0]);
        const predicate = this.visit(ctx.verb[0]);
        const object = this.visit(ctx.tripleTermObject[0]);

        return this.tripleTermNode(subject, predicate, object);
    }

    tripleTermSubject(ctx): Term {
        return this.readTripleTermComponent(ctx);
    }

    tripleTermObject(ctx): Term {
        return this.readTripleTermComponent(ctx);
    }

    protected readTripleTermComponent(ctx): Term {
        const context = getCstChildren(ctx);

        if (context.var) {
            return this.visit(context.var[0]);
        } else if (context.iri) {
            return this.visit(context.iri[0]);
        } else if (context.rdfLiteral) {
            return this.visit(context.rdfLiteral[0]);
        } else if (context.numericLiteral) {
            return this.visit(context.numericLiteral[0]);
        } else if (context.booleanLiteral) {
            return this.visit(context.booleanLiteral[0]);
        } else if (context.blankNode) {
            return this.visit(context.blankNode[0]);
        } else if (context.tripleTerm) {
            return this.visit(context.tripleTerm[0]);
        } else if (context.tripleTermData) {
            return this.visit(context.tripleTermData[0]);
        } else if (context.exprTripleTerm) {
            return this.visit(context.exprTripleTerm[0]);
        }

        throw new Error('Invalid triple term component: ' + JSON.stringify(Object.keys(context)));
    }

    tripleTermData(ctx): Term {
        const subject = this.visit(ctx.tripleTermDataSubject[0]);
        const predicate = ctx.iri ? this.visit(ctx.iri[0]) : RDF_TYPE;
        const object = this.visit(ctx.tripleTermDataObject[0]);

        return this.tripleTermNode(subject, predicate, object);
    }

    tripleTermDataSubject(ctx): Term {
        return this.visit(ctx.iri[0]);
    }

    tripleTermDataObject(ctx): Term {
        return this.readTripleTermComponent(ctx);
    }

    exprTripleTerm(ctx): Term {
        const subject = this.visit(ctx.exprTripleTermSubject[0]);
        const predicate = this.visit(ctx.verb[0]);
        const object = this.visit(ctx.exprTripleTermObject[0]);

        return this.tripleTermNode(subject, predicate, object);
    }

    exprTripleTermSubject(ctx): Term {
        return this.readTripleTermComponent(ctx);
    }

    exprTripleTermObject(ctx): Term {
        return this.readTripleTermComponent(ctx);
    }

    // ==========================================
    // Expressions
    // ==========================================

    expression(ctx): Term {
        return this.visit(ctx.conditionalOrExpression[0]);
    }

    conditionalOrExpression(ctx): Term {
        return this.foldBinary(ctx.conditionalAndExpression ?? [], sparql.Or);
    }

    conditionalAndExpression(ctx): Term {
        return this.foldBinary(ctx.valueLogical ?? [], sparql.And);
    }

    /**
     * Left-fold a list of operand nodes with a single binary operator.
     */
    protected foldBinary(operands: CstNode[], type: NamedNode): Term {
        let result = this.visit(operands[0]);

        for (let i = 1; i < operands.length; i++) {
            result = this.binaryNode(type, result, this.visit(operands[i]));
        }

        return result;
    }

    valueLogical(ctx): Term {
        return this.visit(ctx.relationalExpression[0]);
    }

    relationalExpression(ctx): Term {
        const lhs = this.visit(ctx.numericExpression[0]);

        const operators: [string, NamedNode][] = [
            ['EQ', sparql.Eq],
            ['NEQ', sparql.Neq],
            ['LTE', sparql.Leq],
            ['GTE', sparql.Geq],
            ['LT', sparql.Lt],
            ['GT', sparql.Gt]
        ];

        for (const [token, type] of operators) {
            if (ctx[token]) {
                return this.binaryNode(type, lhs, this.visit(ctx.numericExpression[1]));
            }
        }

        if (ctx.IN) {
            const node = this.createNode(ctx.NOT ? sparql.NotIn : sparql.In);
            this.emit(node, sparql.arg1, lhs);
            this.emit(node, sparql.args, this.makeList(this.visit(ctx.expressionList[0])));
            return node;
        }

        return lhs;
    }

    numericExpression(ctx): Term {
        return this.visit(ctx.additiveExpression[0]);
    }

    additiveExpression(ctx): Term {
        const items = getOrderedCstChildren(ctx, [
            'multiplicativeExpression', 'PLUS_SIGN', 'MINUS_SIGN',
            'numericLiteralPositive', 'numericLiteralNegative', 'STAR', 'SLASH', 'unaryExpression'
        ]);

        let result = this.visit(items[0].node);
        let i = 1;

        while (i < items.length) {
            const item = items[i];

            if (item.key === 'PLUS_SIGN' && i + 1 < items.length) {
                result = this.binaryNode(sparql.Addition, result, this.visit(items[i + 1].node));
                i += 2;
            } else if (item.key === 'MINUS_SIGN' && i + 1 < items.length) {
                result = this.binaryNode(sparql.Subtraction, result, this.visit(items[i + 1].node));
                i += 2;
            } else if (item.key === 'numericLiteralPositive' || item.key === 'numericLiteralNegative') {
                // Signed numeric literal shorthand: '?x +3' means ?x + (+3),
                // optionally followed by '*'/'/' binding tighter: ?x +3*?y.
                let rhs = this.visit(item.node);
                i += 1;

                if (i + 1 < items.length && (items[i].key === 'STAR' || items[i].key === 'SLASH')) {
                    const type = items[i].key === 'STAR' ? sparql.Multiplication : sparql.Division;
                    rhs = this.binaryNode(type, rhs, this.visit(items[i + 1].node));
                    i += 2;
                }

                result = this.binaryNode(sparql.Addition, result, rhs);
            } else {
                // Tolerate unexpected shapes from error-recovered syntax trees.
                i += 1;
            }
        }

        return result;
    }

    multiplicativeExpression(ctx): Term {
        const items = getOrderedCstChildren(ctx, ['unaryExpression', 'STAR', 'SLASH']);

        let result = this.visit(items[0].node);
        let i = 1;

        while (i + 1 < items.length) {
            const type = items[i].key === 'STAR' ? sparql.Multiplication : sparql.Division;
            result = this.binaryNode(type, result, this.visit(items[i + 1].node));
            i += 2;
        }

        return result;
    }

    unaryExpression(ctx): Term {
        if (ctx.BANG) {
            return this.unaryNode(sparql.UnaryNot, this.visit(ctx.unaryExpression[0]));
        } else if (ctx.PLUS_SIGN) {
            return this.unaryNode(sparql.UnaryPlus, this.visit(ctx.primaryExpression[0]));
        } else if (ctx.MINUS_SIGN) {
            return this.unaryNode(sparql.UnaryMinus, this.visit(ctx.primaryExpression[0]));
        }

        return this.visit(ctx.primaryExpression[0]);
    }

    primaryExpression(ctx): Term {
        if (ctx.brackettedExpression) {
            return this.visit(ctx.brackettedExpression[0]);
        } else if (ctx.builtInCall) {
            return this.visit(ctx.builtInCall[0]);
        } else if (ctx.iriOrFunction) {
            return this.visit(ctx.iriOrFunction[0]);
        } else if (ctx.rdfLiteral) {
            return this.visit(ctx.rdfLiteral[0]);
        } else if (ctx.numericLiteral) {
            return this.visit(ctx.numericLiteral[0]);
        } else if (ctx.booleanLiteral) {
            return this.visit(ctx.booleanLiteral[0]);
        } else if (ctx.var) {
            return this.visit(ctx.var[0]);
        } else if (ctx.exprTripleTerm) {
            return this.visit(ctx.exprTripleTerm[0]);
        }

        throw new Error('Invalid primary expression: ' + JSON.stringify(Object.keys(ctx)));
    }

    brackettedExpression(ctx): Term {
        return this.visit(ctx.expression[0]);
    }

    iriOrFunction(ctx): Term {
        const iri = this.visit(ctx.iri[0]);

        if (ctx.argList) {
            const node = this.createNode(sparql.FunctionCall);
            this.emit(node, sparql.function, iri);

            const { distinct, args } = this.visit(ctx.argList[0]);

            if (distinct) {
                this.emit(node, sparql.distinct, TRUE);
            }

            this.emit(node, sparql.args, this.makeList(args));

            return node;
        }

        return iri;
    }

    // ==========================================
    // Built-in calls
    // ==========================================

    builtInCall(ctx): Term {
        const context = getCstChildren(ctx);

        for (const key in context) {
            const value = context[key];

            if (Array.isArray(value) && value.length > 0) {
                return this.visit(value[0]);
            }
        }

        throw new Error('Invalid built-in call: ' + JSON.stringify(Object.keys(ctx)));
    }

    /**
     * Generic handler for the built-in call group rules: identifies the
     * keyword token, collects the arguments in source order and builds a
     * sparql:BuiltInCall node.
     */
    protected readBuiltInCallGroup(ctx): Term {
        const context = getCstChildren(ctx);

        // Nested group dispatch (string functions are split across rules).
        if (context.builtInCallStringFuncs2) {
            return this.visit(context.builtInCallStringFuncs2[0]);
        } else if (context.builtInCallStringFuncs3) {
            return this.visit(context.builtInCallStringFuncs3[0]);
        }

        let fn: NamedNode | undefined;

        for (const key in context) {
            if (BUILT_IN_FUNCTIONS[key]) {
                fn = BUILT_IN_FUNCTIONS[key];
                break;
            }
        }

        if (!fn) {
            throw new Error('Unknown built-in function: ' + JSON.stringify(Object.keys(context)));
        }

        let args: Term[];

        if (context.expressionList) {
            args = this.visit(context.expressionList[0]);
        } else {
            args = getOrderedCstChildren(ctx, ['expression', 'var']).map(item => this.visit(item.node));
        }

        return this.builtInCallNode(fn, args);
    }

    builtInCallTermAccessors(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallStringFuncs(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallStringFuncs2(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallStringFuncs3(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallNumericFuncs(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallDateTimeFuncs(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallHashFuncs(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallTestFuncs(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallMiscFuncs(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    builtInCallRdf12Funcs(ctx): Term {
        return this.readBuiltInCallGroup(ctx);
    }

    regexExpression(ctx): Term {
        return this.builtInCallNode(sparql.REGEX, (ctx.expression ?? []).map(e => this.visit(e)));
    }

    substringExpression(ctx): Term {
        return this.builtInCallNode(sparql.SUBSTR, (ctx.expression ?? []).map(e => this.visit(e)));
    }

    strReplaceExpression(ctx): Term {
        return this.builtInCallNode(sparql.REPLACE, (ctx.expression ?? []).map(e => this.visit(e)));
    }

    existsFunc(ctx): Term {
        const node = this.createNode(sparql.Exists);
        this.emit(node, sparql.elements, this.makeList(this.groupElements(this.visit(ctx.groupGraphPattern[0]))));
        return node;
    }

    notExistsFunc(ctx): Term {
        const node = this.createNode(sparql.NotExists);
        this.emit(node, sparql.elements, this.makeList(this.groupElements(this.visit(ctx.groupGraphPattern[0]))));
        return node;
    }

    aggregate(ctx): Term {
        const types: [string, NamedNode][] = [
            ['COUNT', sparql.Count],
            ['SUM', sparql.Sum],
            ['MIN', sparql.Min],
            ['MAX', sparql.Max],
            ['AVG', sparql.Avg],
            ['SAMPLE', sparql.Sample],
            ['GROUP_CONCAT', sparql.GroupConcat]
        ];

        const type = types.find(([token]) => ctx[token]);

        if (!type) {
            throw new Error('Invalid aggregate: ' + JSON.stringify(Object.keys(ctx)));
        }

        const node = this.createNode(type[1]);

        if (ctx.DISTINCT) {
            this.emit(node, sparql.distinct, TRUE);
        }

        if (ctx.STAR) {
            this.emit(node, sparql.countStar, TRUE);
        } else if (ctx.expression) {
            this.emit(node, sparql.expression, this.visit(ctx.expression[0]));
        }

        if (ctx.string) {
            this.emit(node, sparql.separator, dataFactory.literal(this.visit(ctx.string[0])));
        }

        return node;
    }

    // ==========================================
    // Update operations
    // ==========================================

    update(ctx): Term | null {
        if (ctx.prologue) {
            this.visit(ctx.prologue[0]);
        }

        return ctx.updateBody ? this.visit(ctx.updateBody[0]) : null;
    }

    updateBody(ctx): Term {
        const node = this.createNode(sparql.Update);
        const operations: Term[] = [];

        this.collectUpdateOperations(ctx, operations);

        this.emit(node, sparql.operations, this.makeList(operations));

        return node;
    }

    /**
     * Collect the operations of an update request in source order, following
     * the recursive Update1 (';' Update)? structure and processing the
     * prologues interleaved between operations.
     */
    protected collectUpdateOperations(ctx, operations: Term[]): void {
        const context = getCstChildren(ctx);

        if (context.update1) {
            operations.push(this.visit(context.update1[0]));
        }

        if (context.update) {
            const updateContext = getCstChildren(context.update[0]);

            if (updateContext.prologue) {
                this.visit(updateContext.prologue[0]);
            }

            if (updateContext.updateBody) {
                this.collectUpdateOperations(updateContext.updateBody[0], operations);
            }
        }
    }

    update1(ctx): Term {
        const context = getCstChildren(ctx);

        for (const key in context) {
            const value = context[key];

            if (Array.isArray(value) && value.length > 0) {
                return this.visit(value[0]);
            }
        }

        throw new Error('Invalid update operation: ' + JSON.stringify(Object.keys(ctx)));
    }

    load(ctx): Term {
        const node = this.createNode(sparql.Load);

        if (ctx.SILENT) {
            this.emit(node, sparql.silent, TRUE);
        }

        this.emit(node, sparql.source, this.visit(ctx.iri[0]));

        if (ctx.graphRef) {
            this.emit(node, sparql.into, this.visit(ctx.graphRef[0]));
        }

        return node;
    }

    clear(ctx): Term {
        return this.readClearOrDrop(ctx, sparql.Clear);
    }

    drop(ctx): Term {
        return this.readClearOrDrop(ctx, sparql.Drop);
    }

    protected readClearOrDrop(ctx, type: NamedNode): Term {
        const node = this.createNode(type);

        if (ctx.SILENT) {
            this.emit(node, sparql.silent, TRUE);
        }

        this.emit(node, sparql.graphTarget, this.visit(ctx.graphRefAll[0]));

        return node;
    }

    create(ctx): Term {
        const node = this.createNode(sparql.Create);

        if (ctx.SILENT) {
            this.emit(node, sparql.silent, TRUE);
        }

        this.emit(node, sparql.graph, this.visit(ctx.graphRef[0]));

        return node;
    }

    add(ctx): Term {
        return this.readGraphToGraph(ctx, sparql.Add);
    }

    move(ctx): Term {
        return this.readGraphToGraph(ctx, sparql.Move);
    }

    copy(ctx): Term {
        return this.readGraphToGraph(ctx, sparql.Copy);
    }

    protected readGraphToGraph(ctx, type: NamedNode): Term {
        const node = this.createNode(type);

        if (ctx.SILENT) {
            this.emit(node, sparql.silent, TRUE);
        }

        this.emit(node, sparql.fromGraph, this.visit(ctx.graphOrDefault[0]));
        this.emit(node, sparql.toGraph, this.visit(ctx.graphOrDefault[1]));

        return node;
    }

    insertData(ctx): Term {
        const node = this.createNode(sparql.InsertData);
        this.emit(node, sparql.data, this.makeList(this.visit(ctx.quadData[0])));
        return node;
    }

    deleteData(ctx): Term {
        const node = this.createNode(sparql.DeleteData);
        this.emit(node, sparql.data, this.makeList(this.visit(ctx.quadData[0])));
        return node;
    }

    deleteWhere(ctx): Term {
        const node = this.createNode(sparql.DeleteWhere);
        this.emit(node, sparql.where, this.makeList(this.visit(ctx.quadPattern[0])));
        return node;
    }

    modify(ctx): Term {
        const node = this.createNode(sparql.Modify);

        if (ctx.WITH) {
            this.emit(node, sparql.withGraph, this.visit(ctx.iri[0]));
        }

        if (ctx.deleteClause) {
            this.emit(node, sparql.deleteTemplate, this.makeList(this.visit(ctx.deleteClause[0])));
        }

        if (ctx.insertClause) {
            this.emit(node, sparql.insertTemplate, this.makeList(this.visit(ctx.insertClause[0])));
        }

        for (const clause of ctx.usingClause ?? []) {
            this.visit(clause, node);
        }

        this.emit(node, sparql.where, this.makeList(this.groupElements(this.visit(ctx.groupGraphPattern[0]))));

        return node;
    }

    deleteClause(ctx): Term[] {
        return this.visit(ctx.quadPattern[0]);
    }

    insertClause(ctx): Term[] {
        return this.visit(ctx.quadPattern[0]);
    }

    usingClause(ctx, node: Term): void {
        if (ctx.NAMED) {
            this.emit(node, sparql.usingNamed, this.visit(ctx.iri[0]));
        } else {
            this.emit(node, sparql.using, this.visit(ctx.iri[0]));
        }
    }

    graphOrDefault(ctx): Term {
        if (ctx.DEFAULT) {
            return sparql.DefaultGraph;
        }

        return this.visit(ctx.iri[0]);
    }

    graphRef(ctx): Term {
        return this.visit(ctx.iri[0]);
    }

    graphRefAll(ctx): Term {
        if (ctx.graphRef) {
            return this.visit(ctx.graphRef[0]);
        } else if (ctx.DEFAULT) {
            return sparql.DefaultGraph;
        } else if (ctx.NAMED) {
            return sparql.NamedGraphs;
        } else if (ctx.ALL) {
            return sparql.AllGraphs;
        }

        throw new Error('Invalid graph reference: ' + JSON.stringify(Object.keys(ctx)));
    }

    quadPattern(ctx): Term[] {
        return ctx.quads ? this.visit(ctx.quads[0]) : [];
    }

    quadData(ctx): Term[] {
        return ctx.quads ? this.visit(ctx.quads[0]) : [];
    }

    quads(ctx): Term[] {
        const elements: Term[] = [];

        for (const { node } of getOrderedCstChildren(ctx, ['triplesTemplate', 'quadsNotTriples'])) {
            elements.push(...this.visit(node));
        }

        return elements;
    }

    quadsNotTriples(ctx): Term[] {
        const node = this.createNode(sparql.Graph);

        this.emit(node, sparql.graph, this.visit(ctx.varOrIri[0]));

        const elements = ctx.triplesTemplate ? this.visit(ctx.triplesTemplate[0]) : [];
        this.emit(node, sparql.elements, this.makeList(elements));

        return [node];
    }

    // ==========================================
    // Terms and literals
    // ==========================================

    var(ctx): Term {
        const token = (ctx.VAR1 ?? ctx.VAR2)[0];
        return this.getVariable(token);
    }

    varOrTerm(ctx): Term {
        if (ctx.var) {
            return this.visit(ctx.var[0]);
        }

        return this.visit(ctx.graphTerm[0]);
    }

    varOrIri(ctx): Term {
        if (ctx.var) {
            return this.visit(ctx.var[0]);
        }

        return this.visit(ctx.iri[0]);
    }

    graphTerm(ctx): Term {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.rdfLiteral) {
            return this.visit(ctx.rdfLiteral[0]);
        } else if (ctx.numericLiteral) {
            return this.visit(ctx.numericLiteral[0]);
        } else if (ctx.booleanLiteral) {
            return this.visit(ctx.booleanLiteral[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        } else if (ctx.NIL) {
            return RDF_NIL;
        } else if (ctx.tripleTerm) {
            return this.visit(ctx.tripleTerm[0]);
        }

        throw new Error('Invalid graph term: ' + JSON.stringify(Object.keys(ctx)));
    }

    literal(ctx): Term {
        if (ctx.rdfLiteral) {
            return this.visit(ctx.rdfLiteral[0]);
        } else if (ctx.numericLiteral) {
            return this.visit(ctx.numericLiteral[0]);
        } else if (ctx.booleanLiteral) {
            return this.visit(ctx.booleanLiteral[0]);
        }

        throw new Error('Invalid literal: ' + JSON.stringify(Object.keys(ctx)));
    }

    iri(ctx): NamedNode {
        if (ctx.IRIREF) {
            return this.resolveIri(ctx.IRIREF[0].image.slice(1, -1));
        } else if (ctx.prefixedName) {
            return this.visit(ctx.prefixedName[0]);
        }

        throw new Error('Invalid IRI: ' + JSON.stringify(Object.keys(ctx)));
    }

    prefixedName(ctx): NamedNode {
        const token = ctx.PNAME_LN ? ctx.PNAME_LN[0] : ctx.PNAME_NS[0];
        const { prefix, localName } = splitPrefixedName(token.image);

        const namespaceIri = this.namespaces[prefix];

        if (!namespaceIri) {
            throw new Error(`Undefined prefix: ${prefix}`);
        }

        const unescapedLocalName = localName.replace(/\\([_~.\-!$&'()*+,;=/?#@%])/g, '$1');

        return dataFactory.namedNode(namespaceIri.value + unescapedLocalName);
    }

    blankNode(ctx): Term {
        if (ctx.BLANK_NODE_LABEL) {
            const token = ctx.BLANK_NODE_LABEL[0];
            const label = token.image.substring(2);
            const id = getBlankNodeIdFromToken(token) ?? label;

            let node = this.blankNodes.get(id);

            if (!node) {
                node = dataFactory.blankNode(id);
                this.blankNodes.set(id, node);
                this.emit(node, RDF_TYPE, sparql.BlankNode);
                this.emit(node, sparql.label, dataFactory.literal(label));
            }

            return node;
        }

        return this.visit(ctx.anon[0]);
    }

    anon(ctx): Term {
        return this.syntacticBlankNode(ctx.LBRACKET?.[0]);
    }

    rdfLiteral(ctx): Literal {
        const value = this.visit(ctx.string[0]);

        if (ctx.LANGTAG) {
            return dataFactory.literal(value, ctx.LANGTAG[0].image.slice(1));
        } else if (ctx.iri) {
            return dataFactory.literal(value, this.visit(ctx.iri[0]));
        }

        return dataFactory.literal(value);
    }

    string(ctx): string {
        const token = findStringTokenInCst(ctx);

        if (!token) {
            throw new Error('Invalid string: ' + JSON.stringify(Object.keys(ctx)));
        }

        const quoteLength = token.tokenType.name.includes('LONG') ? 3 : 1;

        return unescapeRdfString(token.image.slice(quoteLength, -quoteLength));
    }

    numericLiteral(ctx): Literal {
        if (ctx.numericLiteralUnsigned) {
            return this.visit(ctx.numericLiteralUnsigned[0]);
        } else if (ctx.numericLiteralPositive) {
            return this.visit(ctx.numericLiteralPositive[0]);
        } else if (ctx.numericLiteralNegative) {
            return this.visit(ctx.numericLiteralNegative[0]);
        }

        throw new Error('Invalid numeric literal: ' + JSON.stringify(Object.keys(ctx)));
    }

    numericLiteralUnsigned(ctx): Literal {
        return this.readNumericLiteral(ctx);
    }

    numericLiteralPositive(ctx): Literal {
        return this.readNumericLiteral(ctx);
    }

    numericLiteralNegative(ctx): Literal {
        return this.readNumericLiteral(ctx);
    }

    protected readNumericLiteral(ctx): Literal {
        const context = getCstChildren(ctx);
        const token = findFirstTokenInCst(context);

        if (!token) {
            throw new Error('Invalid numeric literal: ' + JSON.stringify(Object.keys(context)));
        }

        const name = token.tokenType.name;

        let datatype: NamedNode;

        if (name.startsWith('INTEGER')) {
            datatype = XSD_INTEGER;
        } else if (name.startsWith('DECIMAL')) {
            datatype = XSD_DECIMAL;
        } else {
            datatype = XSD_DOUBLE;
        }

        return dataFactory.literal(token.image, datatype);
    }

    booleanLiteral(ctx): Literal {
        return dataFactory.literal(ctx['true'] ? 'true' : 'false', XSD_BOOLEAN);
    }
}
