import { ILexingError, IToken, TokenType } from 'chevrotain';
import { isTemplate, symbols as templateSymbols, type TemplateSymbol } from 'triplate';
import { ILexer } from '../syntax.js';
import { RdfToken } from '../tokens.js';
import { TriplateToken } from './tokens.js';
import { INLINE_TOKEN, makeToken, renderForHost, Replacement } from './constructs.js';

/**
 * The result of tokenizing a (possibly Triplate-templated) document.
 */
export interface TriplateLexingResult {
    /**
     * The faithful, public token stream: ordinary host tokens for the body, plus
     * real {@link TriplateToken} tokens for the template constructs (interpolations,
     * directives, and a single opaque frontmatter block). This is what IDE features
     * (highlighting, reference indexing, tooltips, linting) should consume.
     */
    tokens: IToken[];
    /**
     * Host-only tokens with every Triplate construct replaced by a length-preserving,
     * syntactically neutral placeholder (frontmatter blanked, `${…}`/`$<…>` → `<…>`,
     * `$"…"` → `"…"`). Feed these to the host parser so its CST and error recovery
     * stay correct. Identical to {@link tokens} when the document is not a template.
     */
    parseTokens: IToken[];
    /** Lexing errors reported by the host lexer over the placeholder rendering. */
    errors: ILexingError[];
    /** Whether the document opens with a Triplate frontmatter header. */
    template: boolean;
}

/** Picks the host string-literal token type matching the quoting of `image`. */
function literalTokenType(image: string): TokenType {
    if (image.startsWith('"""')) return RdfToken.STRING_LITERAL_LONG_QUOTE;
    if (image.startsWith("'''")) return RdfToken.STRING_LITERAL_LONG_SINGLE_QUOTE;
    if (image.startsWith("'")) return RdfToken.STRING_LITERAL_SINGLE_QUOTE;
    return RdfToken.STRING_LITERAL_QUOTE;
}

/**
 * Emits real RDF tokens (`PNAME_LN`/`PNAME_NS`/`IRIREF`/string literal) for the prefixed-name, IRI
 * and literal values that `triplate` reports inside the frontmatter block, so that token-driven IDE
 * features (tooltips, prefix rename) see them. Falls back to a single opaque `TRIPLATE_FRONTMATTER`
 * block token if `triplate` reports nothing usable (or throws). Param/binding/ref symbols are not RDF
 * tokens — they are consumed directly from `triplate` by the parameter-rename feature.
 */
function frontmatterRdfTokens(text: string, block: Replacement): IToken[] {
    let symbols: TemplateSymbol[];

    try {
        // The tolerant top-level reader returns symbols up to the first syntax error,
        // so frontmatter tokens still appear while the template is mid-edit.
        symbols = templateSymbols(text);
    } catch {
        return [makeToken(TriplateToken.TRIPLATE_FRONTMATTER, text, block.start, block.end)];
    }

    const tokens: IToken[] = [];

    for (const symbol of symbols) {
        // Only RDF-bearing terms within this frontmatter block become tokens.
        if (symbol.start < block.start || symbol.end > block.end) {
            continue;
        }

        switch (symbol.kind) {
            case 'pname':
                tokens.push(makeToken(symbol.local ? RdfToken.PNAME_LN : RdfToken.PNAME_NS, text, symbol.start, symbol.end));
                break;
            case 'iri':
                tokens.push(makeToken(RdfToken.IRIREF, text, symbol.start, symbol.end));
                break;
            case 'literal':
                tokens.push(makeToken(literalTokenType(text.slice(symbol.start, symbol.end)), text, symbol.start, symbol.end));
                break;
        }
    }

    return tokens;
}

/**
 * Tokenizes a document that may use Triplate templating, opt-in. Default host lexing
 * is unaffected: a non-template document is tokenized exactly as `lexer.tokenize(text)`
 * would, and Triplate token types never appear in any host token list.
 *
 * For a template, the host parser should consume {@link TriplateLexingResult.parseTokens}
 * (placeholders) while every other consumer uses {@link TriplateLexingResult.tokens}
 * (the faithful stream). The frontmatter's prefixed-name/IRI/literal values are surfaced as real RDF
 * tokens (via `triplate`'s positioned symbols) so tooltips and prefix rename work inside it; if
 * `triplate` reports nothing usable it falls back to a single opaque `TRIPLATE_FRONTMATTER` block.
 *
 * @param lexer The host lexer (e.g. `TurtleLexer`, `SparqlLexer`).
 * @param text The original document text.
 * @param initialMode Optional initial lexer mode, forwarded to the host lexer.
 */
export function tokenizeWithTriplate(lexer: ILexer, text: string, initialMode?: string): TriplateLexingResult {
    if (!isTemplate(text)) {
        const result = lexer.tokenize(text, initialMode);

        return { tokens: result.tokens, parseTokens: result.tokens, errors: result.errors, template: false };
    }

    const { rendering, replacements } = renderForHost(text);
    const lexResult = lexer.tokenize(rendering, initialMode);
    const parseTokens = lexResult.tokens;

    // Inline replacements are recovered by swapping the placeholder token in place;
    // because placeholders are length-preserving, offsets line up by start position.
    const inlineByStart = new Map<number, Replacement>();
    const blocks: Replacement[] = [];

    for (const replacement of replacements) {
        if (replacement.kind === 'iri' || replacement.kind === 'string' || replacement.kind === 'value') {
            inlineByStart.set(replacement.start, replacement);
        } else {
            blocks.push(replacement);
        }
    }

    const tokens: IToken[] = parseTokens.map(token => {
        const replacement = inlineByStart.get(token.startOffset);

        if (replacement && replacement.kind !== 'frontmatter' && replacement.kind !== 'directive') {
            return makeToken(INLINE_TOKEN[replacement.kind], text, replacement.start, replacement.end);
        }

        return token;
    });

    // Frontmatter and directive blocks have no placeholder tokens (they are blanked to
    // whitespace), so insert them and re-sort the stream by start offset. The frontmatter
    // is made non-opaque: its prefixed-name/IRI/literal values become real RDF tokens.
    for (const block of blocks) {
        if (block.kind === 'frontmatter') {
            tokens.push(...frontmatterRdfTokens(text, block));
        } else {
            tokens.push(makeToken(TriplateToken.TRIPLATE_DIRECTIVE, text, block.start, block.end));
        }
    }

    tokens.sort((a, b) => a.startOffset - b.startOffset);

    return { tokens, parseTokens, errors: lexResult.errors, template: true };
}
