import { IToken } from "chevrotain";
import { RdfToken } from "./tokens.js";
import { SparqlLexer } from './sparql/parser.js';

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
    'BLANK_NODE_LABEL', // Explicitly named blank nodes _:foo
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
 * Generates IDs in the format 'b0', 'b1', 'b2', etc. for anonymous blank nodes.
 * For named blank nodes (_:foo), strips the '_:' prefix and returns the label as-is.
 */
export const defaultBlankNodeIdGenerator: BlankNodeIdGenerator = (counter: number, token: IToken) => {
    if (token.tokenType.name === 'BLANK_NODE_LABEL') {
        return token.image.substring(2);
    }
    return `b${counter}`;
};

/**
 * Assigns pre-generated blank node IDs to tokens that can generate blank nodes.
 * The IDs are stored in the token's payload field as { blankNodeId: string }.
 * 
 * @param tokens The array of tokens to process.
 * @param generator Optional custom ID generator function. Defaults to generating 'b0', 'b1', etc.
 * @returns The same array of tokens with blank node IDs assigned.
 */
export function assignBlankNodeIds(tokens: IToken[], generator: BlankNodeIdGenerator = defaultBlankNodeIdGenerator): IToken[] {
    let counter = 0;
    const labelMap = new Map<string, string>();

    for (const token of tokens) {
        if (BLANK_NODE_TOKEN_NAMES.has(token.tokenType.name)) {
            let id: string;
            if (token.tokenType.name === 'BLANK_NODE_LABEL') {
                // Reuse the same ID for repeated occurrences of the same label within one file.
                const label = token.image;
                if (labelMap.has(label)) {
                    id = labelMap.get(label)!;
                } else {
                    id = generator(counter++, token);
                    labelMap.set(label, id);
                }
            } else {
                id = generator(counter++, token);
            }
            token.payload = { ...token.payload, blankNodeId: id };
        }
    }

    return tokens;
}

/**
 * Creates a blank node ID generator scoped to a specific file URI.
 * All blank node IDs produced by this generator are prefixed with a short
 * deterministic hash of the URI, preventing collisions across files.
 *
 * @param fileUri The URI of the file (used to derive the prefix).
 * @returns A BlankNodeIdGenerator that produces file-scoped blank node IDs.
 */
export function createFileBlankNodeIdGenerator(fileUri: string): BlankNodeIdGenerator {
    let h = 5381;
    for (let i = 0; i < fileUri.length; i++) {
        h = (h * 33 ^ fileUri.charCodeAt(i)) | 0;
    }
    const prefix = (h >>> 0).toString(36);
    return (counter: number, token: IToken) => {
        if (token.tokenType.name === 'BLANK_NODE_LABEL') {
            return `${prefix}_${token.image.substring(2)}`;
        }
        return `${prefix}_b${counter}`;
    };
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
 * Split a prefixed name into prefix and local name parts.
 *
 * Examples:
 * - "ex:foo" => { prefix: "ex", localName: "foo" }
 * - ":foo" => { prefix: "", localName: "foo" }
 */
export function splitPrefixedName(
    pname: string,
    useWholeAsPrefixWhenMissingColon: boolean = false,
): { prefix: string; localName: string } {
    const colonIndex = pname.indexOf(':');

    if (colonIndex > -1) {
        return {
            prefix: pname.slice(0, colonIndex),
            localName: pname.slice(colonIndex + 1),
        };
    }

    return {
        prefix: useWholeAsPrefixWhenMissingColon ? pname : '',
        localName: '',
    };
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
 * Gets the source position from a token.
 */
export function getTokenPosition(token: IToken): {
    startOffset: number;
    endOffset: number;
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
} {
    return {
        startOffset: token.startOffset,
        endOffset: token.endOffset ?? token.startOffset + token.image.length - 1,
        startLine: token.startLine,
        startColumn: token.startColumn,
        endLine: token.endLine,
        endColumn: token.endColumn
    };
}

/**
 * Indicates whether the token is a variable.
 * @param token A token.
 * @returns `true` if the token is a variable, `false` otherwise.
 */
export function isVariableToken(token: IToken) {
    switch (token.tokenType.name) {
        case RdfToken.VAR1.name:
        case RdfToken.VAR2.name:
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
    return token ? token.image === token.image.toUpperCase() : false;
}

/**
 * Get the prefix name from a prefixed name token.
 */
export function getPrefixFromToken(token: IToken): string {
    if (token.tokenType.name === RdfToken.PNAME_LN.name) {
        return token.image.split(':')[0];
    } else if (token.tokenType.name === RdfToken.PNAME_NS.name) {
        return token.image.substring(0, token.image.length - 1);
    } else {
        throw new Error("Cannot get prefix from token type: " + token.tokenType.name);
    }
}

/**
 * Extracts the graph IRIs declared in FROM and FROM NAMED dataset clauses
 * of a SPARQL query by walking the token stream produced by {@link SparqlLexer}.
 *
 * Dataset clauses appear at the top of every SPARQL query form and satisfy
 * the grammar productions:
 *
 *   DatasetClause ::= FROM ( DefaultGraphClause | NamedGraphClause )
 *   DefaultGraphClause ::= SourceSelector
 *   NamedGraphClause ::= NAMED SourceSelector
 *   SourceSelector ::= iri
 *
 * The function:
 * - Handles both `FROM <iri>` and `FROM NAMED <iri>` forms.
 * - Strips the surrounding angle brackets from IRIREF tokens.
 * - Deduplicates the returned list while preserving order of first occurrence.
 * - Returns an empty array for `undefined` / empty input or when no clauses exist.
 *
 * @param query - The raw SPARQL query text.
 * @returns An ordered, deduplicated array of graph IRI strings.
 */
export function extractFromClauseGraphUris(query?: string): string[] {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const lexer = new SparqlLexer(null);
    const { tokens } = lexer.tokenize(query);

    // Strip whitespace and comment tokens so we only walk meaningful tokens.
    const meaningful: IToken[] = tokens.filter(
        t => t.tokenType.name !== 'WS' && t.tokenType.name !== 'COMMENT'
    );

    const uris: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < meaningful.length; i++) {
        const token = meaningful[i];

        if (token.tokenType.name !== 'FROM') {
            continue;
        }

        let j = i + 1;

        if (j >= meaningful.length) {
            break;
        }

        // Skip optional NAMED keyword.
        if (meaningful[j].tokenType.name === 'NAMED') {
            j++;
        }

        if (j >= meaningful.length) {
            break;
        }

        const iriToken = meaningful[j];

        if (iriToken.tokenType.name === 'IRIREF' || iriToken.tokenType.name === 'IRIREF_ABS') {
            // IRIREF image is always wrapped in angle brackets: <...>
            const iri = iriToken.image.slice(1, -1);

            if (iri.length > 0 && !seen.has(iri)) {
                seen.add(iri);
                uris.push(iri);
            }
        }
    }

    return uris;
}
