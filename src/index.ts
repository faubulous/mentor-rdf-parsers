export { IRecognitionException, TokenType } from 'chevrotain';
export { RdfToken } from './tokens.js';
export { TokenMetadata, TOKEN_METADATA, getTokenMetadata, hasTokenFlag } from './token-metadata.js';
export { QuadContext, toQuadContext } from './quad-context.js';
export { RdfSyntax, IParser, ILexer } from './syntax.js';
export { N3Lexer, N3Parser, N3Tokens } from './n3/parser.js';
export { N3Reader } from './n3/reader.js';
export { NQuadsLexer, NQuadsParser, NQuadsTokens } from './nquads/parser.js';
export { NQuadsReader } from './nquads/reader.js';
export { NTriplesLexer, NTriplesParser, NTriplesTokens } from './ntriples/parser.js';
export { NTriplesReader } from './ntriples/reader.js';
export { SparqlLexer, SparqlParser, SparqlVariableParser, SparqlTokens } from './sparql/parser.js';
export { SparqlReader } from './sparql/reader.js';
export { SPARQL_SYNTAX_NS, sps, BUILT_IN_FUNCTIONS } from './sparql/vocabulary.js';
export { TrigLexer, TrigParser, TrigTokens } from './trig/parser.js';
export { TrigReader } from './trig/reader.js';
export { TurtleLexer, TurtleParser, TurtleTokens } from './turtle/parser.js';
export { TurtleReader } from './turtle/reader.js';
export { TriplateToken } from './triplate/tokens.js';
export { tokenizeWithTriplate, type TriplateLexingResult } from './triplate/overlay.js';
export { tokenizeTemplateForFormatting, type TemplateFormatTokens } from './triplate/formatting.js';
export {
    getNextToken,
    getPreviousToken,
    getFirstTokenOfType,
    getLastTokenOfType,
    getTokenAtOffset,
    isVariableToken,
    isUpperCaseToken,
    assignBlankNodeIds,
    getBlankNodeIdFromToken,
    defaultBlankNodeIdGenerator,
    createFileBlankNodeIdGenerator,
    extractFromClauseGraphUris,
    BLANK_NODE_TOKEN_NAMES,
    type BlankNodeIdGenerator,
} from './utils.js';

import { IToken as ITokenBase, TokenType } from 'chevrotain';
import { TokenMetadata } from './token-metadata.js';

export interface IToken extends ITokenBase {
    tokenType: TokenType & TokenMetadata;
}