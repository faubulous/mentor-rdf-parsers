import { createToken, Lexer, TokenType } from 'chevrotain';
import { TokenMetadata } from '../token-metadata.js';

/**
 * Token types for Triplate template constructs.
 *
 * These are never part of any host lexer's token list — the host grammars stay
 * standards-compliant by default. They are only instantiated by the Triplate
 * overlay (see {@link tokenizeWithTriplate}), which assigns them to the spans of
 * template constructs in the faithful (public) token stream. Their pattern is
 * {@link Lexer.NA} so they can never be matched during ordinary tokenization.
 */
function createTriplateToken(name: string, metadata: TokenMetadata): TokenType {
    const token = createToken({ name, pattern: Lexer.NA });

    Object.assign(token, metadata);

    return token;
}

const TEMPLATE: TokenMetadata = { isTemplate: true };
const INTERP: TokenMetadata = { isTemplate: true, isInterpolation: true, isTerm: true };

export const TriplateToken = {
    /** A `---…---` frontmatter header, emitted as a single opaque block token. */
    TRIPLATE_FRONTMATTER: createTriplateToken('TRIPLATE_FRONTMATTER', TEMPLATE),
    /** A `${…}` value interpolation standing in for a term. */
    TRIPLATE_INTERPOLATION: createTriplateToken('TRIPLATE_INTERPOLATION', INTERP),
    /** A `$<…>` IRI template standing in for an IRI. */
    TRIPLATE_IRI_TEMPLATE: createTriplateToken('TRIPLATE_IRI_TEMPLATE', INTERP),
    /** A `$"…"` string template standing in for a literal. */
    TRIPLATE_STRING_TEMPLATE: createTriplateToken('TRIPLATE_STRING_TEMPLATE', INTERP),
    /** A `{% … %}` control directive (e.g. `{% if %}` / `{% for %}`). */
    TRIPLATE_DIRECTIVE: createTriplateToken('TRIPLATE_DIRECTIVE', TEMPLATE),
};
