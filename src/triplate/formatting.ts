import { IToken } from 'chevrotain';
import { isTemplate } from 'triplate';
import { ILexer } from '../syntax.js';
import { INLINE_TOKEN, makeToken, renderForHost, Replacement } from './constructs.js';

/**
 * The host-body tokens of a Triplate template, ready for token-based formatting.
 */
export interface TemplateFormatTokens {
    /**
     * The body's host tokens — including inline `COMMENT` tokens — with each inline
     * interpolation (`${…}` / `$<…>` / `$"…"`) represented as a real `TRIPLATE_*`
     * token that carries `isTerm` metadata, so a token formatter lays it out as a term
     * and emits its original text. The frontmatter contributes no tokens (it is blanked).
     */
    bodyTokens: IToken[];
    /**
     * `true` when the body contains `{% … %}` control directives. Reflowing host syntax
     * across a directive is unsafe, so callers should skip formatting such templates.
     */
    hasDirectives: boolean;
}

/**
 * Tokenizes the **body** of a Triplate template for token-based formatting, or returns
 * `null` when `text` is not a template (the caller formats it normally). The frontmatter
 * is not RDF and is excluded — it is blanked in the host rendering, so it yields no tokens
 * and must be formatted separately and re-attached by the caller.
 *
 * @param lexer The host lexer (e.g. `TurtleLexer`, `SparqlLexer`).
 * @param text The original document text.
 */
export function tokenizeTemplateForFormatting(lexer: ILexer, text: string): TemplateFormatTokens | null {
    if (!isTemplate(text)) {
        return null;
    }

    const { rendering, replacements } = renderForHost(text);
    const lexResult = lexer.tokenize(rendering);

    const hasDirectives = replacements.some(r => r.kind === 'directive');

    // Recover inline interpolations: their placeholder host token is swapped for a real
    // TRIPLATE_* token at the same offsets (placeholders are length-preserving).
    const inlineByStart = new Map<number, Replacement>();

    for (const replacement of replacements) {
        if (replacement.kind === 'iri' || replacement.kind === 'string' || replacement.kind === 'value') {
            inlineByStart.set(replacement.start, replacement);
        }
    }

    const bodyTokens = lexResult.tokens.map(token => {
        const replacement = inlineByStart.get(token.startOffset);

        return replacement ? makeToken(INLINE_TOKEN[replacement.kind], text, replacement.start, replacement.end) : token;
    });

    return { bodyTokens, hasDirectives };
}
