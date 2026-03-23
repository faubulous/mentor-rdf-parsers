import type { IToken } from 'chevrotain';

type CstLikeContext = {
    [key: string]: unknown;
    children?: CstLikeContext;
};

/**
 * Extract children from a CstNode or return the context as-is.
 */
export function getCstChildren<T extends CstLikeContext>(ctx: T): T {
    return ctx.children ? (ctx.children as T) : ctx;
}

/**
 * Find the first token in a CST context.
 */
export function findFirstTokenInCst(ctx: CstLikeContext): IToken | undefined {
    const context = getCstChildren(ctx);

    for (const key in context) {
        if (key === 'children') continue;

        const value = context[key];
        if (Array.isArray(value) && value.length > 0) {
            const first = value[0] as CstLikeContext | IToken;

            if (typeof (first as IToken).startOffset === 'number') {
                return first as IToken;
            }

            if (typeof first === 'object' && first !== null) {
                const token = findFirstTokenInCst(first as CstLikeContext);
                if (token) return token;
            }
        }
    }

    return undefined;
}

/**
 * Find the string token in a string context.
 */
export function findStringTokenInCst(ctx: CstLikeContext): IToken | undefined {
    const context = getCstChildren(ctx) as Record<string, IToken[] | unknown>;

    if (context.STRING_LITERAL_QUOTE) return (context.STRING_LITERAL_QUOTE as IToken[])[0];
    if (context.STRING_LITERAL_SINGLE_QUOTE) return (context.STRING_LITERAL_SINGLE_QUOTE as IToken[])[0];
    if (context.STRING_LITERAL_LONG_QUOTE) return (context.STRING_LITERAL_LONG_QUOTE as IToken[])[0];
    if (context.STRING_LITERAL_LONG_SINGLE_QUOTE) return (context.STRING_LITERAL_LONG_SINGLE_QUOTE as IToken[])[0];

    return undefined;
}

/**
 * Interpret escape sequences in an RDF string value.
 */
export function unescapeRdfString(raw: string): string {
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