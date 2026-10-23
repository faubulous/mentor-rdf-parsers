import type { IToken } from 'chevrotain';

/**
 * The first error a token-driven quad reader meets: a token that does not fit the grammar,
 * an unexpected end of input, or a prefixed name whose prefix was not declared.
 */
export class QuadReaderError extends Error {
    /**
     * The token at which reading stopped, or `undefined` when the input ended early.
     */
    readonly token: IToken | undefined;

    /**
     * @param message A description of the error.
     * @param token The token at which reading stopped, or `undefined` at the end of the input.
     */
    constructor(message: string, token: IToken | undefined) {
        super(message);

        this.name = 'QuadReaderError';
        this.token = token;
    }
}
