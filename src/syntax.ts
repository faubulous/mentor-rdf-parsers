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
     * An array of recognition exceptions that occurred during semantic analysis. This can be used to identify and handle any semantic errors in the input document, such as undefined prefixes or invalid IRIs.
     */
    semanticErrors: ISemanticError[];

    /**
     * Parses a set of tokens created by the lexer into a concrete syntax tree (CST) representing the parsed document.
     * @param tokens A set of tokens created by the lexer.
     * @param throwOnErrors Whether to throw an error if any parsing errors are detected. Defaults to `true`.
     * @returns A concrete syntax tree (CST) object.
     */
    parse(inputTokens: IToken[], throwOnErrors?: boolean): CstNode;
}

/**
 * An interface representing a semantic error that can occur during parsing. This includes the name of the error, a human-readable message describing the error, and the token that caused the error. This can be used to identify and handle semantic errors in the input document, such as undefined prefixes or invalid IRIs.
 */
export interface ISemanticError extends Error {
    /**
     * The name of the error, which can be used to identify the type of semantic error that occurred. This can be useful for handling different types of errors in different ways, or for providing more specific error messages to users.
     */
    name: string;

    /**
     * A human-readable message describing the error, which can be used to provide more information about the nature of the error and how to fix it. This can be useful for debugging and for providing feedback to users about issues in their input documents.
     */
    message: string;

    /**
     * The token that caused the error, which can be used to identify the specific location in the input document where the error occurred. This can be useful for debugging and for providing feedback to users about issues in their input documents.
     */
    token: IToken;

    /**
     * The stack of grammar rules that were being parsed when the error occurred. This can be useful for debugging and understanding the context in which the error happened.
     */
    ruleStack?: any[];
}