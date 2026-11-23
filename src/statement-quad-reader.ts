import type { Quad } from '@rdfjs/types';
import type { IToken, TokenType } from 'chevrotain';
import { RdfToken } from './tokens.js';
import { QuadReaderError } from './quad-reader-error.js';
import type { QuadReadResult } from './quad-read-result.js';

/**
 * The state a statement starts from, which reading returns to when the statement has an error.
 */
export interface ReadCheckpoint {
    /**
     * The list the quads were emitted into when the statement began.
     */
    quads: Quad[];

    /**
     * The number of quads in that list when the statement began.
     */
    length: number;

    /**
     * The index of the first token of the statement.
     */
    index: number;
}

/**
 * Reads RDF/JS quads straight from a token stream, one statement at a time, without building a
 * syntax tree. Subclasses read the statements of their syntax; this class walks the tokens and
 * either stops at the first error ({@link read}) or skips the statements that have errors and
 * reads on ({@link readStatements}).
 *
 * A statement that has an error is dropped as a whole: the quads it emitted before the error are
 * removed again, and reading resumes after it. A declaration takes effect only once it is read
 * completely, so a broken declaration declares nothing.
 */
export abstract class StatementQuadReader {
    /**
     * The tokens being read.
     */
    protected _tokens: IToken[] = [];

    /**
     * The index of the current token.
     */
    protected _index: number = 0;

    /**
     * The list the quads are emitted into.
     */
    protected _quads: Quad[] = [];

    /**
     * The errors of the statements skipped so far.
     */
    private _errors: QuadReaderError[] = [];

    /**
     * Whether statements with errors are skipped instead of ending the read.
     */
    private _recovering: boolean = false;

    /**
     * Reads the quads of a document.
     * @param tokens The tokens of the document, as produced by the lexer of the syntax. Comment tokens are skipped.
     * @returns The quads of the document.
     * @throws {QuadReaderError} At the first syntax error or undefined prefix.
     */
    read(tokens: IToken[]): Quad[] {
        this._begin(tokens, false);

        while (this._index < this._tokens.length) {
            this._readStatement();
        }

        return this._quads;
    }

    /**
     * Reads the quads of a document statement by statement, skipping the statements that have
     * errors: the quads of the other statements are read as if the broken ones were not there.
     * @param tokens The tokens of the document, as produced by the lexer of the syntax. Comment tokens are skipped.
     * @returns The quads of the statements without errors, and the first error of each statement skipped.
     */
    readStatements(tokens: IToken[]): QuadReadResult {
        this._begin(tokens, true);

        while (this._index < this._tokens.length) {
            const checkpoint = this._checkpoint();

            try {
                this._readStatement();
            } catch (error) {
                this._recoverFrom(error, checkpoint, errorIndex => this._resumeIndexAfterError(errorIndex));
            }
        }

        return { quads: this._quads, errors: this._errors };
    }

    /**
     * Prepares a read of new tokens. Subclasses that keep state per read reset it here.
     * @param tokens The tokens to read.
     * @param recovering Whether statements with errors are skipped.
     */
    protected _begin(tokens: IToken[], recovering: boolean): void {
        this._tokens = tokens;
        this._index = 0;
        this._quads = [];
        this._errors = [];
        this._recovering = recovering;

        this._skipComments();
    }

    /**
     * Reads one statement or directive at the current token, including the token that ends it.
     * @throws {QuadReaderError} When the statement has an error.
     */
    protected abstract _readStatement(): void;

    /**
     * The index of the token to resume reading at after a statement had an error: the token after
     * the next period, or the next token that can only begin a statement, whichever comes first.
     * @param errorIndex The index of the token at which the error occurred.
     * @returns The index to resume at; the end of the tokens when nothing follows.
     */
    protected _resumeIndexAfterError(errorIndex: number): number {
        for (let index = errorIndex; index < this._tokens.length; index++) {
            const type = this._tokens[index].tokenType;

            if (type === RdfToken.PERIOD) {
                return index + 1;
            }

            if (this._beginsStatement(type)) {
                return index;
            }
        }

        return this._tokens.length;
    }

    /**
     * Whether a token can only begin a statement, such as the keyword of a directive, so that
     * reading resumes there after an error before it.
     * @param type The type of the token.
     * @returns `true` for a token that begins a statement wherever it occurs.
     */
    protected abstract _beginsStatement(type: TokenType): boolean;

    /**
     * The state to return to if the statement about to be read has an error.
     * @returns The checkpoint.
     */
    protected _checkpoint(): ReadCheckpoint {
        return { quads: this._quads, length: this._quads.length, index: this._index };
    }

    /**
     * Recovers from an error in a statement while reading statement by statement: removes the
     * quads the statement emitted, records the error and moves to where reading resumes. While
     * reading to the first error, or for an error that is no syntax error, the error is thrown on.
     * @param error The error thrown while reading the statement.
     * @param checkpoint The state at the start of the statement.
     * @param resumeIndexOf Gives the index to resume at for the index of the token in error.
     * @throws The error when it is not recovered from.
     */
    protected _recoverFrom(error: unknown, checkpoint: ReadCheckpoint, resumeIndexOf: (errorIndex: number) => number): void {
        if (!this._recovering || !(error instanceof QuadReaderError)) {
            throw error;
        }

        this._quads = checkpoint.quads;
        this._quads.length = checkpoint.length;
        this._errors.push(error);

        // Reading always moves past the start of the broken statement.
        this._index = Math.max(resumeIndexOf(this._errorIndexOf(error, checkpoint.index)), checkpoint.index + 1);

        this._skipComments();
    }

    /**
     * The index of the token an error occurred at.
     * @param error The error.
     * @param fromIndex The index of the first token of the statement.
     * @returns The index of the token, or the end of the tokens for an error at the end of the input.
     */
    private _errorIndexOf(error: QuadReaderError, fromIndex: number): number {
        if (error.token === undefined) {
            return this._tokens.length;
        }

        for (let index = Math.min(this._index, this._tokens.length - 1); index >= fromIndex; index--) {
            if (this._tokens[index] === error.token) {
                return index;
            }
        }

        return this._index;
    }

    /**
     * The type of the token `offset` positions ahead of the current one, ignoring comments.
     * @param offset The number of tokens to look ahead.
     * @returns The type, or `undefined` past the end of the input.
     */
    protected _peekType(offset: number = 0): TokenType | undefined {
        let index = this._index;

        while (offset > 0 && index < this._tokens.length) {
            index = this._nextIndex(index);
            offset--;
        }

        return this._tokens[index]?.tokenType;
    }

    /**
     * Returns the current token and moves to the next one that is not a comment.
     * @returns The current token.
     * @throws {QuadReaderError} At the end of the input.
     */
    protected _advance(): IToken {
        const token = this._tokens[this._index];

        if (token === undefined) {
            throw this._unexpected('more input');
        }

        this._index = this._nextIndex(this._index);

        return token;
    }

    /**
     * Returns the current token after checking its type, and moves on.
     * @param type The type the token must have.
     * @returns The current token.
     * @throws {QuadReaderError} When the token has another type or the input ended.
     */
    protected _consume(type: TokenType): IToken {
        const token = this._tokens[this._index];

        if (token === undefined || token.tokenType !== type) {
            throw this._unexpected(`'${type.name}'`, token);
        }

        this._index = this._nextIndex(this._index);

        return token;
    }

    /**
     * Moves the position to the first token that is not a comment.
     */
    protected _skipComments(): void {
        while (this._tokens[this._index]?.tokenType === RdfToken.COMMENT) {
            this._index++;
        }
    }

    /**
     * The index of the next token after an index that is not a comment.
     * @param index The index.
     * @returns The index of the next token, or the end of the tokens.
     */
    protected _nextIndex(index: number): number {
        index++;

        while (this._tokens[index]?.tokenType === RdfToken.COMMENT) {
            index++;
        }

        return index;
    }

    /**
     * Creates the error for a token that does not fit the grammar at the current position.
     * @param expected What the grammar expected at this point.
     * @param token The token found, or the current token when omitted.
     * @returns The error.
     */
    protected _unexpected(expected: string, token: IToken | undefined = this._tokens[this._index]): QuadReaderError {
        if (token === undefined) {
            return new QuadReaderError(`Unexpected end of input, expected ${expected}`, undefined);
        }

        return new QuadReaderError(`Expected ${expected} but found '${token.image}'`, token);
    }
}
