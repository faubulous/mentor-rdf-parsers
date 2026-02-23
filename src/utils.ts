import { IToken } from "chevrotain";
import { TOKENS } from "./index.js";

/**
 * Get the next token.
 * @param token A token.
 * @returns The next token or undefined.
 */
export function getNextToken(tokens: IToken[], token: IToken): IToken | undefined {
    const index = tokens.indexOf(token);

    if (index > -1 && index < tokens.length - 1) {
        return tokens[index + 1];
    }
}

/**
 * Get the previous token.
 * @param token A token.
 * @returns The previous token or undefined.
 */
export function getPreviousToken(tokens: IToken[], token: IToken): IToken | undefined {
    const index = tokens.indexOf(token);

    if (index > 0) {
        return tokens[index - 1];
    }
}

/**
 * Get the first token of a given type.
 * @param tokens A list of tokens.
 * @param type The type name of the token.
 * @returns The last token of the given type, if it exists, undefined otherwise.
 */
export function getFirstTokenOfType(tokens: IToken[], type: string): IToken | undefined {
    const n = tokens.findIndex(t => t.tokenType.name === type);

    if (n > -1) {
        return tokens[n];
    }
}

/**
 * Get the last token of a given type.
 * @param tokens A list of tokens.
 * @param types The type name of the token.
 * @returns The last token of the given type, if it exists, undefined otherwise.
 */
export function getLastTokenOfType(tokens: IToken[], types: Iterable<string>): IToken | undefined {
    const set = new Set([...types]);
    const result = tokens.filter(t => set.has(t.tokenType.name));

    if (result.length > 0) {
        return result[result.length - 1];
    }
}

/*
 * Get the token at a given offset.
 * @param tokens A list of tokens.
 * @param offset An offset.
 * @returns The token at the given offset.
 */
export function getTokenAtOffset(tokens: IToken[], offset: number): IToken[] {
    return tokens.filter(t => t.startOffset <= offset && offset <= t.startOffset + t.image.length);
}

/**
 * Indicates whether the token is a variable.
 * @param token A token.
 * @returns `true` if the token is a variable, `false` otherwise.
 */
export function isVariableToken(token: IToken) {
    switch (token.tokenType.name) {
        case TOKENS.VAR1.name:
        case TOKENS.VAR2.name:
            return true;
        default:
            return false;
    }
}

/**
 * Indicates whether a token is upper case.
 * @param token A token.
 * @returns `true` if the token is upper case. `false` otherwise.
 */
export function isUpperCaseToken(token?: IToken): boolean {
    return token ?
        token.image === token.image.toUpperCase() : false;
}

/**
 * Get the prefix name from a prefixed name token.
 */
export function getPrefixFromToken(token: IToken): string {
    if (token.tokenType.name === TOKENS.PNAME_LN.name) {
        return token.image.split(':')[0];
    } else if (token.tokenType.name === TOKENS.PNAME_NS.name) {
        return token.image.substring(0, token.image.length - 1);
    } else {
        throw new Error("Cannot get prefix from token type: " + token.tokenType.name);
    }
}