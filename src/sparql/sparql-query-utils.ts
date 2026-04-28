import type { IToken } from 'chevrotain';
import { SparqlLexer } from './parser.js';

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
