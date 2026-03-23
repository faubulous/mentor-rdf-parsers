import type { IToken, TokenType } from 'chevrotain';

/**
 * Remove COMMENT tokens from a token stream while preserving order.
 */
export function withoutCommentTokens(tokens: IToken[], commentTokenType?: TokenType): IToken[] {
    if (commentTokenType) {
        return tokens.filter(t => t.tokenType !== commentTokenType);
    } else {
        return tokens.filter(t => t.tokenType.name !== 'COMMENT');
    }
}