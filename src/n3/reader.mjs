import dataFactory from '@rdfjs/data-model';
import { N3Parser } from './parser.mjs';

const BaseVisitor = new N3Parser().getBaseCstVisitorConstructor();

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
    namespaces = {};

    /**
     * The base IRI of the document.
     */
    baseIri = null;

    /**
     * Counter for generating path-related blank nodes.
     */
    _pathBlankNodeCounter = 0;

    constructor() {
        super();

        this.validateVisitor();
    }

    // ── Top-level ──────────────────────────────────────────────────────────

    n3Doc(ctx) {
        const quads = [];

        // Process sparql directives
        if (ctx.sparqlDirective) {
            for (const directive of ctx.sparqlDirective) {
                this._processDirectiveResult(this.visit(directive));
            }
        }

        // Process n3Statements
        if (ctx.n3Statement) {
            for (const stmt of ctx.n3Statement) {
                this.visit(stmt, quads);
            }
        }

        return quads;
    }

    n3Statement(ctx, quads) {
        if (ctx.n3Directive) {
            const result = this.visit(ctx.n3Directive[0]);
            this._processDirectiveResult(result);
        } else if (ctx.triples) {
            this.visit(ctx.triples[0], quads);
        }
    }

    n3Directive(ctx) {
        if (ctx.prefix) {
            return this.visit(ctx.prefix[0]);
        } else if (ctx.base) {
            return this.visit(ctx.base[0]);
        } else if (ctx.forAll) {
            return this.visit(ctx.forAll[0]);
        } else if (ctx.forSome) {
            return this.visit(ctx.forSome[0]);
        }
        return {};
    }

    sparqlDirective(ctx) {
        if (ctx.sparqlPrefix) {
            return this.visit(ctx.sparqlPrefix[0]);
        } else if (ctx.sparqlBase) {
            return this.visit(ctx.sparqlBase[0]);
        }
        return {};
    }

    _processDirectiveResult(result) {
        if (!result) return;

        if (result.prefix !== undefined && result.namespaceIri !== undefined) {
            this.namespaces[result.prefix] = result.namespaceIri;
        } else if (result.baseIri !== undefined) {
            this.baseIri = result.baseIri;
        }
    }

    // ── Directives ─────────────────────────────────────────────────────────

    prefix(ctx) {
        const prefix = ctx.PNAME_NS[0].image.slice(0, -1);
        const namespaceIri = this.getNamedNode(ctx);

        return { prefix, namespaceIri };
    }

    base(ctx) {
        return this.getBaseIri(ctx);
    }

    sparqlPrefix(ctx) {
        const prefix = ctx.PNAME_NS[0].image.slice(0, -1);
        const namespaceIri = this.getNamedNode(ctx);

        return { prefix, namespaceIri };
    }

    sparqlBase(ctx) {
        return this.getBaseIri(ctx);
    }

    forAll(ctx) {
        // @forAll declarations are quantifier hints; we don't emit quads for them.
        return {};
    }

    forSome(ctx) {
        // @forSome declarations are quantifier hints; we don't emit quads for them.
        return {};
    }

    // ── Triples ────────────────────────────────────────────────────────────

    triples(ctx, quads) {
        const subject = this.visit(ctx.subject[0], quads);

        if (ctx.predicateObjectList) {
            for (const { predicate, object, inversePredicate } of this.visit(ctx.predicateObjectList[0], quads)) {
                if (inversePredicate) {
                    // For `<- pred`, the object becomes the subject and vice versa
                    quads.push(dataFactory.quad(object, predicate, subject));
                } else {
                    quads.push(dataFactory.quad(subject, predicate, object));
                }
            }
        }
    }

    subject(ctx, quads) {
        return this.visit(ctx.expression[0], quads);
    }

    predicateObjectList(ctx, quads) {
        const result = [];

        if (!ctx.verb) return result;

        for (let i = 0; i < ctx.verb.length; i++) {
            const verbResult = this.visit(ctx.verb[i], quads);

            if (ctx.objectList && ctx.objectList[i]) {
                const objects = this.visit(ctx.objectList[i], quads);

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

    verb(ctx, quads) {
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
            const predicate = this.visit(ctx.expression[0], quads);
            return { predicate };
        } else if (ctx.IS) {
            // `is expr of` means use the expression as predicate but swap subject/object
            const predicate = this.visit(ctx.expression[0], quads);
            return { predicate, inversePredicate: true };
        } else if (ctx.predicate) {
            return this.visit(ctx.predicate[0], quads);
        }

        throw new Error('Invalid verb: ' + JSON.stringify(ctx));
    }

    predicate(ctx, quads) {
        if (ctx.INVERSE_OF) {
            // `<- expr` means the expression is the predicate but subject/object are swapped
            const predicate = this.visit(ctx.expression[0], quads);
            return { predicate, inversePredicate: true };
        }
        // Regular predicate
        const predicate = this.visit(ctx.expression[0], quads);
        return { predicate };
    }

    objectList(ctx, quads) {
        const results = [];

        if (ctx.object) {
            for (const obj of ctx.object) {
                results.push(this.visit(obj, quads));
            }
        }

        return results;
    }

    object(ctx, quads) {
        return this.visit(ctx.expression[0], quads);
    }

    // ── Expressions & Paths ────────────────────────────────────────────────

    expression(ctx, quads) {
        return this.visit(ctx.path[0], quads);
    }

    path(ctx, quads) {
        let node = this.visit(ctx.pathItem[0], quads);

        // Handle path operators: ! (forward) and ^ (reverse)
        if (ctx.EXCL && ctx.path) {
            // a!b means: create a blank node _:x, emit a b _:x, return _:x
            const property = this.visit(ctx.path[0], quads);
            const blank = dataFactory.blankNode(`_path${this._pathBlankNodeCounter++}`);
            quads.push(dataFactory.quad(node, property, blank));
            return blank;
        } else if (ctx.CARET && ctx.path) {
            // a^b means: create a blank node _:x, emit _:x b a, return _:x
            const property = this.visit(ctx.path[0], quads);
            const blank = dataFactory.blankNode(`_path${this._pathBlankNodeCounter++}`);
            quads.push(dataFactory.quad(blank, property, node));
            return blank;
        }

        return node;
    }

    pathItem(ctx, quads) {
        if (ctx.formula) {
            return this.visit(ctx.formula[0], quads);
        } else if (ctx.collection) {
            return this.visit(ctx.collection[0], quads);
        } else if (ctx.blankNodePropertyList) {
            return this.visit(ctx.blankNodePropertyList[0], quads);
        } else if (ctx.quickVar) {
            return this.visit(ctx.quickVar[0]);
        } else if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else if (ctx.blankNode) {
            return this.visit(ctx.blankNode[0]);
        } else if (ctx.literal) {
            return this.visit(ctx.literal[0]);
        }

        throw new Error('Invalid pathItem: ' + JSON.stringify(ctx));
    }

    // ── Formula ────────────────────────────────────────────────────────────

    formula(ctx, parentQuads) {
        const formulaQuads = [];

        if (ctx.formulaContent) {
            this.visit(ctx.formulaContent[0], formulaQuads);
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

    formulaContent(ctx, quads) {
        if (ctx.sparqlDirective) {
            const result = this.visit(ctx.sparqlDirective[0]);
            this._processDirectiveResult(result);
        }

        if (ctx.n3Statement) {
            this.visit(ctx.n3Statement[0], quads);
        }

        if (ctx.formulaContent) {
            for (const fc of ctx.formulaContent) {
                this.visit(fc, quads);
            }
        }
    }

    // ── Quick Variables ────────────────────────────────────────────────────

    quickVar(ctx) {
        // Quick variables are represented as N3 variables — we use blank nodes
        // following the convention of other N3 implementations.
        const name = ctx.QUICK_VAR[0].image.slice(1); // Remove leading '?'
        return dataFactory.variable(name);
    }

    // ── Collections ────────────────────────────────────────────────────────

    collection(ctx, quads) {
        const objectNodes = ctx.object ?? [];

        if (objectNodes.length === 0) {
            return RDF_NIL;
        }

        let head = dataFactory.blankNode();
        let current = head;

        for (let i = 0; i < objectNodes.length; i++) {
            const element = this.visit(objectNodes[i], quads);

            quads.push(dataFactory.quad(current, RDF_FIRST, element));

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

    blankNodePropertyList(ctx, quads) {
        const subject = dataFactory.blankNode();

        if (ctx.predicateObjectList) {
            for (const { predicate, object, inversePredicate } of this.visit(ctx.predicateObjectList[0], quads)) {
                if (inversePredicate) {
                    quads.push(dataFactory.quad(object, predicate, subject));
                } else {
                    quads.push(dataFactory.quad(subject, predicate, object));
                }
            }
        }

        return subject;
    }

    // ── IRIs ───────────────────────────────────────────────────────────────

    iri(ctx) {
        if (ctx.prefixedName) {
            return this.visit(ctx.prefixedName[0]);
        } else if (ctx.IRIREF) {
            return this.getNamedNode(ctx);
        } else {
            throw new Error('Invalid IRI: ' + JSON.stringify(ctx));
        }
    }

    prefixedName(ctx) {
        const pname = ctx.PNAME_LN ? ctx.PNAME_LN[0].image : ctx.PNAME_NS[0].image;
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

    blankNode(ctx) {
        if (ctx.BLANK_NODE_LABEL) {
            return this.getBlankNode(ctx);
        } else if (ctx.anon) {
            return this.visit(ctx.anon);
        } else {
            throw new Error('Invalid blank node: ' + JSON.stringify(ctx));
        }
    }

    anon(ctx) {
        return dataFactory.blankNode();
    }

    // ── Literals ───────────────────────────────────────────────────────────

    literal(ctx) {
        if (ctx.stringLiteral) {
            return this.visit(ctx.stringLiteral[0]);
        } else if (ctx.numericLiteral) {
            return this.visit(ctx.numericLiteral[0]);
        } else if (ctx.booleanLiteral) {
            return this.visit(ctx.booleanLiteral[0]);
        } else {
            throw new Error('Invalid literal: ' + JSON.stringify(ctx));
        }
    }

    numericLiteral(ctx) {
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

    booleanLiteral(ctx) {
        if (ctx.true) {
            return dataFactory.literal('true', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else if (ctx.false) {
            return dataFactory.literal('false', dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
        } else {
            throw new Error('Invalid boolean literal: ' + JSON.stringify(ctx));
        }
    }

    stringLiteral(ctx) {
        const value = this.visit(ctx.string[0]);

        if (ctx.datatype) {
            const datatype = this.visit(ctx.datatype[0]);
            return dataFactory.literal(value, datatype);
        } else if (ctx.LANGTAG) {
            const langtag = ctx.LANGTAG[0].image.slice(1);
            return dataFactory.literal(value, langtag);
        } else {
            return dataFactory.literal(value);
        }
    }

    string(ctx) {
        let raw;

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

    datatype(ctx) {
        if (ctx.iri) {
            return this.visit(ctx.iri[0]);
        } else {
            throw new Error('Invalid datatype: ' + ctx);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * Interpret escape sequences in an N3 string value.
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

    getBaseIri(ctx) {
        const value = this.getNamedNode(ctx);

        this.baseIri = value;

        return { baseIri: value };
    }

    getNamedNode(ctx) {
        let value = ctx.IRIREF[0].image.slice(1, -1);

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

    getBlankNode(ctx) {
        if (ctx.BLANK_NODE_LABEL !== undefined) {
            const value = ctx.BLANK_NODE_LABEL[0].image;
            return dataFactory.blankNode(value);
        } else {
            return dataFactory.blankNode();
        }
    }
}
