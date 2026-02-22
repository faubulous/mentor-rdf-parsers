import { CstNode, ILexingResult, IRecognitionException, IToken } from "chevrotain";

/**
 * Enumerates the RDF syntaxes supported by the Mentor RDF Parsers library.
 */
export enum RdfSyntax {
    N3 = 'n3',
    NTriples = 'ntriples',
    NQuads = 'nquads',
    Turtle = 'turtle',
    TriG = 'trig',
    TriX = 'trix',
    JsonLd = 'jsonld',
    RdfXml = 'rdfxml',
    Sparql = 'sparql'
}

/**
 * A common interface for all lexers in the Mentor RDF Parsers library.
 */
export interface ILexer {
    /**
     * Tokenizes a string input according to the lexer's defined tokens and modes, returning an object 
     * containing the resulting tokens and any lexing errors. Note that this can be called repeatedly 
     * on different strings as this method does not modify the state of the Lexer.
     *
     * @param text - The string to lex
     * @param [initialMode] - The initial Lexer Mode to start with, by default this will be 
     * the first mode in the lexer's definition. If the lexer has no explicit modes it will 
     * be the implicit single 'default_mode' mode.
     */
    tokenize(text: string, initialMode?: string): ILexingResult;
}

/**
 * A common interface for all syntax parsers in the Mentor RDF Parsers library.
 */
export interface IParser {
    /**
     * An array of tokens that were created by the lexer and used as input for the parser. This can be used to inspect the tokens that were processed during parsing, and to identify any issues with the tokenization process.
     */
    input: IToken[];

    /**
     * An array of recognition exceptions that occurred during parsing. This can be used to identify and handle any syntax errors in the input document.
     */
    errors: IRecognitionException[];

    /**
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed document.
     * @param tokens A set of tokens created by the lexer.
     * @param throwOnErrors Whether to throw an error if any parsing errors are detected. Defaults to `true`.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(inputTokens: IToken[], throwOnErrors?: boolean): CstNode;
}