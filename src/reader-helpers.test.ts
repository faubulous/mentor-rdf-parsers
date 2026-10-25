import { describe, it, expect, vi } from 'vitest';
import { createLazyBaseVisitor } from './reader-helpers.js';
import { TurtleLexer, TurtleParser } from './turtle/parser.js';
import { TurtleReader } from './turtle/reader.js';

describe('createLazyBaseVisitor', () => {
    it('builds the parser only when the first visitor validates itself, and only once', () => {
        const createParser = vi.fn(() => new TurtleParser());
        const BaseVisitor = createLazyBaseVisitor(createParser);

        expect(createParser).not.toHaveBeenCalled();

        const real = new TurtleParser().getBaseCstVisitorConstructor();
        const ruleNames: string[] = (real as any)._RULE_NAMES;

        class CompleteVisitor extends BaseVisitor {
            constructor() {
                super();
                this.validateVisitor();
            }
        }

        for (const name of ruleNames) {
            (CompleteVisitor.prototype as any)[name] = () => undefined;
        }

        new CompleteVisitor();
        new CompleteVisitor();

        expect(createParser).toHaveBeenCalledOnce();
    });

    it('reports missing rule methods like the chevrotain base visitor', () => {
        const BaseVisitor = createLazyBaseVisitor(() => new TurtleParser());
        const ChevrotainBaseVisitor = new TurtleParser().getBaseCstVisitorConstructor();

        class LazyIncomplete extends BaseVisitor {}
        class ChevrotainIncomplete extends ChevrotainBaseVisitor {}

        const lazyError = (() => { try { new LazyIncomplete().validateVisitor(); } catch (e) { return (e as Error).message; } })();
        const chevrotainError = (() => { try { new ChevrotainIncomplete().validateVisitor(); } catch (e) { return (e as Error).message; } })();

        expect(lazyError).toBeDefined();
        expect(lazyError!.replaceAll('LazyIncomplete', 'X')).toBe(chevrotainError!.replaceAll('ChevrotainIncomplete', 'X'));
    });

    it('dispatches visit to the method named after the rule, unwrapping single-child arrays and undefined', () => {
        const BaseVisitor = createLazyBaseVisitor(() => new TurtleParser());

        class Visitor extends BaseVisitor {
            iri(children: unknown, param: unknown) {
                return { children, param };
            }
        }

        const visitor = new Visitor();
        const node = { name: 'iri', children: { a: 1 } } as any;

        expect(visitor.visit(node, 'p')).toEqual({ children: { a: 1 }, param: 'p' });
        expect(visitor.visit([node], 'q')).toEqual({ children: { a: 1 }, param: 'q' });
        expect(visitor.visit(undefined as any)).toBeUndefined();
    });

    it('lets a reader read the same quads as before', () => {
        const tokens = new TurtleLexer().tokenize('@prefix ex: <http://example.org/> .\nex:s ex:p ex:o , "x"@en .').tokens;
        const cst = new TurtleParser().parse(tokens);
        const quads = new TurtleReader().visit(cst);

        expect(quads.map((quad: any) => quad.object.value)).toEqual(['http://example.org/o', 'x']);
    });
});
