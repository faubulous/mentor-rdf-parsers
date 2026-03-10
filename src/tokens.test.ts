import { RdfToken } from './tokens.js';
import { TOKEN_METADATA, TokenMetadata } from './token-metadata.js';

/**
 * Type guard to check if a token has TokenMetadata properties
 */
function hasMetadata(token: unknown): token is TokenMetadata {
    return token !== null && typeof token === 'object';
}

describe('Token Metadata', () => {
    describe('metadata is preserved on tokens', () => {
        it('should have isKeyword on keyword tokens', () => {
            // SPARQL keywords
            expect((RdfToken.SELECT as TokenMetadata).isKeyword).toBe(true);
            expect((RdfToken.WHERE as TokenMetadata).isKeyword).toBe(true);
            expect((RdfToken.FROM as TokenMetadata).isKeyword).toBe(true);
            expect((RdfToken.OPTIONAL_KW as TokenMetadata).isKeyword).toBe(true);
            expect((RdfToken.FILTER as TokenMetadata).isKeyword).toBe(true);
            
            // Boolean keywords
            expect((RdfToken.TRUE as TokenMetadata).isKeyword).toBe(true);
            expect((RdfToken.FALSE as TokenMetadata).isKeyword).toBe(true);
            
            // The 'a' keyword
            expect((RdfToken.A as TokenMetadata).isKeyword).toBe(true);
        });

        it('should have isLowercaseOnly on lowercase-only tokens', () => {
            expect((RdfToken.TRUE as TokenMetadata).isLowercaseOnly).toBe(true);
            expect((RdfToken.FALSE as TokenMetadata).isLowercaseOnly).toBe(true);
            expect((RdfToken.A as TokenMetadata).isLowercaseOnly).toBe(true);
            expect((RdfToken.HAS as TokenMetadata).isLowercaseOnly).toBe(true);
            expect((RdfToken.IS as TokenMetadata).isLowercaseOnly).toBe(true);
            expect((RdfToken.OF as TokenMetadata).isLowercaseOnly).toBe(true);
        });

        it('should have isMajorClause on major clause tokens', () => {
            expect((RdfToken.SELECT as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.CONSTRUCT as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.DESCRIBE as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.ASK as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.OPTIONAL_KW as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.ORDER as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.GROUP as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.HAVING as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.LIMIT as TokenMetadata).isMajorClause).toBe(true);
            expect((RdfToken.OFFSET as TokenMetadata).isMajorClause).toBe(true);
        });

        it('should have isFunction on function tokens', () => {
            expect((RdfToken.FILTER as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.BIND_KW as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.EXISTS as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.COUNT as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.SUM as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.AVG as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.STR as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.STRLEN as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.REGEX as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.COALESCE as TokenMetadata).isFunction).toBe(true);
            expect((RdfToken.IF_KW as TokenMetadata).isFunction).toBe(true);
        });

        it('should have isTerm on term tokens', () => {
            expect((RdfToken.IRIREF as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.IRIREF_ABS as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.PNAME_LN as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.PNAME_NS as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.BLANK_NODE_LABEL as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.VAR1 as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.VAR2 as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.STRING_LITERAL_QUOTE as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.INTEGER as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.TRUE as TokenMetadata).isTerm).toBe(true);
            expect((RdfToken.FALSE as TokenMetadata).isTerm).toBe(true);
        });

        it('should have isIri on IRI tokens', () => {
            expect((RdfToken.IRIREF as TokenMetadata).isIri).toBe(true);
            expect((RdfToken.IRIREF_ABS as TokenMetadata).isIri).toBe(true);
            expect((RdfToken.PNAME_LN as TokenMetadata).isIri).toBe(true);
            expect((RdfToken.PNAME_NS as TokenMetadata).isIri).toBe(true);
        });

        it('should have isLiteral on literal tokens', () => {
            expect((RdfToken.STRING_LITERAL_QUOTE as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.STRING_LITERAL_SINGLE_QUOTE as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.STRING_LITERAL_LONG_QUOTE as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.STRING_LITERAL_LONG_SINGLE_QUOTE as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.INTEGER as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.DECIMAL as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.DOUBLE as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.TRUE as TokenMetadata).isLiteral).toBe(true);
            expect((RdfToken.FALSE as TokenMetadata).isLiteral).toBe(true);
        });

        it('should have isPunctuation on punctuation tokens', () => {
            expect((RdfToken.PERIOD as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.SEMICOLON as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.COMMA as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.LBRACKET as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.RBRACKET as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.LPARENT as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.RPARENT as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.LCURLY as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.RCURLY as TokenMetadata).isPunctuation).toBe(true);
            expect((RdfToken.DCARET as TokenMetadata).isPunctuation).toBe(true);
        });

        it('should have isOpeningBracket on opening brackets', () => {
            expect((RdfToken.LBRACKET as TokenMetadata).isOpeningBracket).toBe(true);
            expect((RdfToken.LPARENT as TokenMetadata).isOpeningBracket).toBe(true);
            expect((RdfToken.LCURLY as TokenMetadata).isOpeningBracket).toBe(true);
            expect((RdfToken.OPEN_ANNOTATION as TokenMetadata).isOpeningBracket).toBe(true);
            expect((RdfToken.OPEN_REIFIED_TRIPLE as TokenMetadata).isOpeningBracket).toBe(true);
            expect((RdfToken.OPEN_TRIPLE_TERM as TokenMetadata).isOpeningBracket).toBe(true);
        });

        it('should have isClosingBracket on closing brackets', () => {
            expect((RdfToken.RBRACKET as TokenMetadata).isClosingBracket).toBe(true);
            expect((RdfToken.RPARENT as TokenMetadata).isClosingBracket).toBe(true);
            expect((RdfToken.RCURLY as TokenMetadata).isClosingBracket).toBe(true);
            expect((RdfToken.CLOSE_ANNOTATION as TokenMetadata).isClosingBracket).toBe(true);
            expect((RdfToken.CLOSE_REIFIED_TRIPLE as TokenMetadata).isClosingBracket).toBe(true);
            expect((RdfToken.CLOSE_TRIPLE_TERM as TokenMetadata).isClosingBracket).toBe(true);
        });

        it('should have noSpaceBefore on statement terminators', () => {
            expect((RdfToken.PERIOD as TokenMetadata).noSpaceBefore).toBe(true);
            expect((RdfToken.SEMICOLON as TokenMetadata).noSpaceBefore).toBe(true);
            expect((RdfToken.COMMA as TokenMetadata).noSpaceBefore).toBe(true);
        });

        it('should have isBlankNodeScope on blank node scope tokens', () => {
            expect((RdfToken.LBRACKET as TokenMetadata).isBlankNodeScope).toBe(true);
            expect((RdfToken.LPARENT as TokenMetadata).isBlankNodeScope).toBe(true);
            expect((RdfToken.LCURLY as TokenMetadata).isBlankNodeScope).toBe(true);
            expect((RdfToken.ANON as TokenMetadata).isBlankNodeScope).toBe(true);
            expect((RdfToken.OPEN_REIFIED_TRIPLE as TokenMetadata).isBlankNodeScope).toBe(true);
            expect((RdfToken.OPEN_ANNOTATION as TokenMetadata).isBlankNodeScope).toBe(true);
        });

        it('should have isWhitespace on whitespace token', () => {
            expect((RdfToken.WS as TokenMetadata).isWhitespace).toBe(true);
        });

        it('should have isComment on comment token', () => {
            expect((RdfToken.COMMENT as TokenMetadata).isComment).toBe(true);
        });

        it('should have isNewlineKeyword on newline keyword tokens', () => {
            expect((RdfToken.FROM as TokenMetadata).isNewlineKeyword).toBe(true);
            expect((RdfToken.NAMED as TokenMetadata).isNewlineKeyword).toBe(true);
            expect((RdfToken.WHERE as TokenMetadata).isNewlineKeyword).toBe(true);
        });
    });

    describe('all tokens with metadata in TOKEN_METADATA have that metadata on the token', () => {
        // Get all token keys from RdfToken
        const tokenEntries = Object.entries(RdfToken);

        for (const [tokenKey, token] of tokenEntries) {
            // Find the corresponding metadata key (handle name mismatches like TTL_BASE vs BASE)
            const metadataKey = Object.keys(TOKEN_METADATA).find(key => {
                // Direct match
                if (key === tokenKey) return true;
                // Check for common naming patterns
                if (key === 'TTL_BASE' && tokenKey === 'TTL_BASE') return true;
                if (key === 'TTL_PREFIX' && tokenKey === 'TTL_PREFIX') return true;
                return false;
            }) || tokenKey;

            const metadata = TOKEN_METADATA[metadataKey];
            
            if (metadata) {
                it(`RdfToken.${tokenKey} should have metadata from TOKEN_METADATA.${metadataKey}`, () => {
                    for (const [metaKey, metaValue] of Object.entries(metadata)) {
                        expect((token as unknown as Record<string, unknown>)[metaKey]).toBe(metaValue);
                    }
                });
            }
        }
    });

    describe('metadata matches between token and TOKEN_METADATA', () => {
        it('SELECT token should match TOKEN_METADATA.SELECT', () => {
            const token = RdfToken.SELECT as TokenMetadata;
            const metadata = TOKEN_METADATA.SELECT;
            expect(token.isKeyword).toBe(metadata.isKeyword);
            expect(token.isMajorClause).toBe(metadata.isMajorClause);
        });

        it('IRIREF token should match TOKEN_METADATA.IRIREF', () => {
            const token = RdfToken.IRIREF as TokenMetadata;
            const metadata = TOKEN_METADATA.IRIREF;
            expect(token.isIri).toBe(metadata.isIri);
            expect(token.isTerm).toBe(metadata.isTerm);
        });

        it('PERIOD token should match TOKEN_METADATA.PERIOD', () => {
            const token = RdfToken.PERIOD as TokenMetadata;
            const metadata = TOKEN_METADATA.PERIOD;
            expect(token.isPunctuation).toBe(metadata.isPunctuation);
            expect(token.noSpaceBefore).toBe(metadata.noSpaceBefore);
        });
    });
});
