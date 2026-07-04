import type { CstNode, IToken } from 'chevrotain';
import { SparqlLexer, SparqlParser } from './parser.js';

/**
 * A positioned SPARQL variable occurrence, identified by the absolute, 0-based
 * UTF-16 offsets of its `?x` / `$x` token (the sigil is included; `end` is
 * exclusive). Occurrences that co-refer share a `binding` id, so grouping a
 * symbol list by `binding` yields every rename site of one variable — the same
 * shape Triplate's `symbols()` provides for template parameters and loop variables.
 */
export interface SparqlVariableSymbol {
    /** The variable name without its leading `?`/`$` sigil. */
    name: string;
    start: number;
    end: number;
    /** Co-reference class id (stable within one result, assigned in source order). */
    binding: number;
}

interface ScopedOccurrence {
    name: string;
    start: number;
    end: number;
    scope: number;
}

interface SubSelectScope {
    scope: number;
    parent: number;
    selectClause: CstNode | undefined;
}

function isToken(node: CstNode | IToken): node is IToken {
    return (node as IToken).tokenType !== undefined;
}

function firstChildNode(node: CstNode, name: string): CstNode | undefined {
    const first = node.children?.[name]?.[0];

    return first && !isToken(first) ? first : undefined;
}

function varTokenName(varNode: CstNode): string | undefined {
    const token = (varNode.children?.VAR1?.[0] ?? varNode.children?.VAR2?.[0]) as IToken | undefined;

    return token ? token.image.slice(1) : undefined;
}

/**
 * The variable names a sub-SELECT projects to its parent: the `var` children of
 * its `selectClause`, or — for `SELECT *` — every variable occurring in that scope.
 */
function projectedNames(sub: SubSelectScope, occurrences: ScopedOccurrence[]): string[] {
    const selectClause = sub.selectClause;

    if (!selectClause?.children) {
        return [];
    }

    if (selectClause.children.STAR) {
        return [...new Set(occurrences.filter(o => o.scope === sub.scope).map(o => o.name))];
    }

    const vars = (selectClause.children.var ?? []) as CstNode[];

    return vars
        .map(v => varTokenName(v))
        .filter((name): name is string => name !== undefined);
}

/**
 * Computes the co-reference binding for every SPARQL variable occurrence in `cst`.
 *
 * A sub-SELECT (`{ SELECT … }`) is the only construct that opens a new variable
 * scope; OPTIONAL / UNION / MINUS / FILTER / EXISTS / GRAPH / SERVICE / BIND /
 * VALUES all share the enclosing scope (their variables join). A variable a
 * sub-SELECT *projects* (`SELECT ?x`, `(expr AS ?x)`, and — under `SELECT *` —
 * every in-scope variable) co-refers with the same-named variable in the parent
 * scope. Non-projected inner variables stay isolated. `?x` and `$x` are the same
 * variable.
 */
function variableSymbolsFromCst(cst: CstNode): SparqlVariableSymbol[] {
    const occurrences: ScopedOccurrence[] = [];
    const subScopes: SubSelectScope[] = [];
    let nextScope = 0; // the root query is scope 0; each sub-SELECT gets the next id.

    const walk = (node: CstNode, scope: number): void => {
        const children = node.children;

        if (!children) {
            return;
        }

        for (const key of Object.keys(children)) {
            for (const child of children[key]) {
                if (isToken(child)) {
                    if (child.tokenType.name === 'VAR1' || child.tokenType.name === 'VAR2') {
                        occurrences.push({
                            name: child.image.slice(1),
                            start: child.startOffset,
                            end: (child.endOffset ?? child.startOffset) + 1,
                            scope,
                        });
                    }
                } else if (child.name === 'subSelect') {
                    const childScope = ++nextScope;

                    subScopes.push({ scope: childScope, parent: scope, selectClause: firstChildNode(child, 'selectClause') });
                    walk(child, childScope);
                } else {
                    walk(child, scope);
                }
            }
        }
    };

    walk(cst, 0);

    // Union-find over `(scope, name)` keys: occurrences sharing a root co-refer.
    const parents = new Map<string, string>();
    const key = (scope: number, name: string) => `${scope} ${name}`;

    const find = (k: string): string => {
        const p = parents.get(k);

        if (p === undefined) {
            parents.set(k, k);

            return k;
        }

        if (p === k) {
            return k;
        }

        const root = find(p);
        parents.set(k, root);

        return root;
    };

    const union = (a: string, b: string) => {
        const ra = find(a);
        const rb = find(b);

        if (ra !== rb) {
            parents.set(ra, rb);
        }
    };

    for (const occ of occurrences) {
        find(key(occ.scope, occ.name)); // seed every occurrence's class.
    }

    for (const sub of subScopes) {
        for (const name of projectedNames(sub, occurrences)) {
            union(key(sub.scope, name), key(sub.parent, name));
        }
    }

    // Assign small, stable binding ids in source order.
    const bindings = new Map<string, number>();

    return occurrences
        .sort((a, b) => a.start - b.start)
        .map(occ => {
            const root = find(key(occ.scope, occ.name));
            let binding = bindings.get(root);

            if (binding === undefined) {
                binding = bindings.size;
                bindings.set(root, binding);
            }

            return { name: occ.name, start: occ.start, end: occ.end, binding };
        });
}

/**
 * Returns a flat, positioned, scope-aware list of every SPARQL variable occurrence
 * in `source`, each tagged with a co-reference `binding` id. Tolerant of malformed
 * input: returns `[]` if the source does not lex/parse, so IDE features (variable
 * rename, occurrence highlighting) can fall back gracefully while editing.
 *
 * Group the result by `binding` to get all rename sites of one variable. See
 * {@link variableSymbolsFromCst} for the scoping rules.
 */
export function sparqlVariableSymbols(source: string): SparqlVariableSymbol[] {
    try {
        const tokens = new SparqlLexer().tokenize(source).tokens;
        const cst = new SparqlParser().parse(tokens);

        return variableSymbolsFromCst(cst);
    } catch {
        return [];
    }
}
