import { IToken } from "chevrotain";
import { TOKENS } from "./tokens.js";

/**
 * Token names that can generate blank nodes during parsing.
 * These tokens will receive pre-assigned blank node IDs.
 */
export const BLANK_NODE_TOKEN_NAMES = new Set([
    'LBRACKET',      // Blank node property lists and anonymous blank nodes
    'LPARENT',       // Collections (list head)
    'OPEN_ANNOTATION', // Annotation blocks {| ... |}
    'TILDE',         // Anonymous reifier marker ~
    'OPEN_REIFIED_TRIPLE', // Anonymous reified triples <<
    'LCURLY',        // Formulas in N3 syntax { ... }
]);

/**
 * A function that generates a blank node ID.
 * @param counter The current counter value (incremented for each call).
 * @param token The token for which the ID is being generated.
 * @returns The blank node ID string (without the _: prefix).
 */
export type BlankNodeIdGenerator = (counter: number, token: IToken) => string;

/**
 * The default blank node ID generator.
 * Generates IDs in the format 'b0', 'b1', 'b2', etc.
 */
export const defaultBlankNodeIdGenerator: BlankNodeIdGenerator = (counter: number) => `b${counter}`;

/**
 * Assigns pre-generated blank node IDs to tokens that can generate blank nodes.
 * The IDs are stored in the token's payload field as { blankNodeId: string }.
 * 
 * @param tokens The array of tokens to process.
 * @param generator Optional custom ID generator function. Defaults to generating 'b0', 'b1', etc.
 * @returns The same array of tokens with blank node IDs assigned.
 */
export function assignBlankNodeIds(
    tokens: IToken[],
    generator: BlankNodeIdGenerator = defaultBlankNodeIdGenerator
): IToken[] {
    let counter = 0;

    for (const token of tokens) {
        if (BLANK_NODE_TOKEN_NAMES.has(token.tokenType.name)) {
            const id = generator(counter++, token);
            token.payload = { ...token.payload, blankNodeId: id };
        }
    }

    return tokens;
}

/**
 * Gets the pre-assigned blank node ID from a token's payload.
 * @param token The token to get the ID from.
 * @returns The blank node ID string, or undefined if not assigned.
 */
export function getBlankNodeIdFromToken(token: IToken): string | undefined {
    return token.payload?.blankNodeId;
}

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