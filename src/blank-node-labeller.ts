import { IToken } from 'chevrotain';

/**
 * How the statements of a syntax are laid out, which decides what a curly bracket opens: nothing
 * in Turtle, a graph in TriG and a formula in N3.
 */
export type StatementLayout = 'turtle' | 'trig' | 'n3';

/**
 * The part of a statement a frame expects next.
 */
type FrameState = 'subject' | 'predicate' | 'object' | 'afterObject' | 'reifier';

/**
 * What a frame stands for: the document, a graph or formula, or a node written in place.
 */
type FrameKind = 'document' | 'graph' | 'propertyList' | 'collection' | 'annotation' | 'reified' | 'tripleTerm';

/**
 * The statements being read at one level of nesting.
 */
interface Frame {
    /**
     * What the frame stands for.
     */
    kind: FrameKind;

    /**
     * The key of the node or graph the frame belongs to; empty for the document.
     */
    scope: string;

    /**
     * The part of a statement expected next.
     */
    state: FrameState;

    /**
     * The key of the current subject.
     */
    subject?: string;

    /**
     * The key of the current predicate.
     */
    predicate?: string;

    /**
     * The key of the last object.
     */
    object?: string;

    /**
     * The number of items read so far, in a collection.
     */
    item: number;

    /**
     * Whether the node the frame stands for is a term of the frame around it once it is closed,
     * which a TriG graph block is not.
     */
    isTerm: boolean;
}

/**
 * The tokens that close a frame, with the kind of frame they close.
 */
const CLOSING_TOKENS: Record<string, FrameKind> = {
    RBRACKET: 'propertyList',
    RPARENT: 'collection',
    RCURLY: 'graph',
    CLOSE_ANNOTATION: 'annotation',
    CLOSE_REIFIED_TRIPLE: 'reified',
    CLOSE_TRIPLE_TERM: 'tripleTerm'
};

/**
 * The tokens that open a frame, with the kind of frame they open and the part of a statement it
 * expects first.
 */
const OPENING_TOKENS: Record<string, { kind: FrameKind; state: FrameState }> = {
    LBRACKET: { kind: 'propertyList', state: 'predicate' },
    LPARENT: { kind: 'collection', state: 'object' },
    LCURLY: { kind: 'graph', state: 'subject' },
    OPEN_ANNOTATION: { kind: 'annotation', state: 'predicate' },
    OPEN_REIFIED_TRIPLE: { kind: 'reified', state: 'subject' },
    OPEN_TRIPLE_TERM: { kind: 'tripleTerm', state: 'subject' }
};

/**
 * The tokens that name a term in a statement.
 */
const TERM_TOKENS = new Set([
    'IRIREF', 'IRIREF_ABS', 'PNAME_LN', 'PNAME_NS', 'BLANK_NODE_LABEL', 'A', 'QUICK_VAR',
    'STRING_LITERAL_QUOTE', 'STRING_LITERAL_SINGLE_QUOTE', 'STRING_LITERAL_LONG_QUOTE', 'STRING_LITERAL_LONG_SINGLE_QUOTE',
    'INTEGER', 'DECIMAL', 'DOUBLE', 'TRUE', 'FALSE', 'IMPLIES', 'IMPLIED_BY', 'EQUALS_SIGN'
]);

/**
 * The directives, with the number of terms that follow them.
 */
const DIRECTIVE_TOKENS: Record<string, number> = {
    TTL_PREFIX: 2,
    PREFIX: 2,
    TTL_BASE: 1,
    BASE: 1,
    VERSION: 1
};

/**
 * Tells where each anonymous blank node of a document is written, as a key that stays the same
 * when the document changes elsewhere. A node written as the value of a statement is keyed by the
 * subject, the predicate and its place among the anonymous values the subject has under that
 * predicate; a node written as a subject by its place among those of its graph; an item of a
 * collection by the collection and its index; an annotation or a reifier by the statement it is
 * about. Subjects and predicates are keyed by how they are written, within the graph or formula
 * they are written in, and a node written in place by its own key.
 *
 * A node written as a subject is keyed by its place, so adding an anonymous subject, such as an
 * N3 formula, before it changes its key and those of the nodes inside it.
 *
 * The labeller follows the statements token by token, without parsing them, so that the keys
 * are known when the document is tokenized. Where the tokens do not form valid statements the
 * keys are still unique, but may change with edits nearby.
 */
export class BlankNodeLabeller {
    private readonly _keys = new Map<IToken, string>();

    private readonly _occurrences = new Map<string, number>();

    private _frames: Frame[] = [];

    private _directiveTerms = 0;

    private _endsWithPeriod = false;

    private _skipsDatatype = false;

    /**
     * Create a labeller for a syntax.
     * @param _layout How the statements of the syntax are laid out.
     */
    constructor(private readonly _layout: StatementLayout) { }

    /**
     * Key the anonymous blank nodes of a document.
     * @param tokens The tokens of the document.
     * @returns The key of each token that opens an anonymous blank node.
     */
    label(tokens: IToken[]): Map<IToken, string> {
        this._frames = [this._createFrame('document', '', 'subject', false)];

        for (const token of tokens) {
            this._read(token);
        }

        return this._keys;
    }

    /**
     * Follow the statements by one token.
     * @param token The token.
     */
    private _read(token: IToken): void {
        const name = token.tokenType.name;

        if (this._skipsDirective(token)) {
            return;
        }

        if (name in OPENING_TOKENS) {
            this._open(token);
        } else if (name in CLOSING_TOKENS) {
            this._close(CLOSING_TOKENS[name]);
        } else if (TERM_TOKENS.has(name)) {
            this._readTerm(token.image);
        } else {
            this._readPunctuation(token, name);
        }
    }

    /**
     * Skip the tokens of a directive, of a datatype and of comments, which name no part of a
     * statement.
     * @param token The token.
     * @returns Whether the token is skipped.
     */
    private _skipsDirective(token: IToken): boolean {
        const name = token.tokenType.name;

        if (name === 'COMMENT' || name === 'LANGTAG') {
            return true;
        }

        if (name in DIRECTIVE_TOKENS) {
            this._directiveTerms = DIRECTIVE_TOKENS[name];
            this._endsWithPeriod = token.image.startsWith('@');

            return true;
        }

        if (this._directiveTerms > 0) {
            this._directiveTerms--;

            return true;
        }

        if (this._endsWithPeriod && name === 'PERIOD') {
            this._endsWithPeriod = false;

            return true;
        }

        return this._skipsDatatypeTerm(name);
    }

    /**
     * Skip the datatype of a literal: the term after `^^`.
     * @param name The name of the token.
     * @returns Whether the token is skipped.
     */
    private _skipsDatatypeTerm(name: string): boolean {
        if (name === 'DCARET') {
            this._skipsDatatype = true;

            return true;
        }

        if (this._skipsDatatype) {
            this._skipsDatatype = false;

            return true;
        }

        return false;
    }

    /**
     * Follow a token that separates or ends statements, or marks a reifier.
     * @param token The token.
     * @param name The name of the token.
     */
    private _readPunctuation(token: IToken, name: string): void {
        const frame = this._current();

        if (name === 'COMMA' && frame.state === 'afterObject') {
            frame.state = 'object';
        } else if (name === 'SEMICOLON') {
            frame.state = 'predicate';
        } else if (name === 'PERIOD') {
            this._endStatement();
        } else if (name === 'TILDE') {
            this._keys.set(token, this._occurrence('reifier', frame.scope, frame.subject, frame.predicate, frame.object));
            frame.state = 'reifier';
        }
    }

    /**
     * Follow a term written in the current frame.
     * @param key The key of the term.
     */
    private _readTerm(key: string): void {
        const frame = this._current();

        switch (frame.state) {
            case 'subject': {
                frame.subject = key;
                frame.state = 'predicate';
                break;
            }
            case 'predicate': {
                frame.predicate = key;
                frame.state = 'object';
                break;
            }
            case 'object': {
                this._readObject(frame, key);
                break;
            }
            case 'reifier': {
                frame.state = 'afterObject';
                break;
            }
            default: {
                frame.object = key;
            }
        }
    }

    /**
     * Follow an object written in a frame, or an item of a collection.
     * @param frame The frame.
     * @param key The key of the object.
     */
    private _readObject(frame: Frame, key: string): void {
        if (frame.kind === 'collection') {
            frame.item++;

            return;
        }

        frame.object = key;
        frame.state = 'afterObject';
    }

    /**
     * Follow a token that opens a node written in place, a collection, a graph or a formula.
     * @param token The token.
     */
    private _open(token: IToken): void {
        const frame = this._current();
        const name = token.tokenType.name;

        if (name === 'LCURLY' && this._opensGraph(frame)) {
            this._openGraph(token, frame);

            return;
        }

        const key = name === 'OPEN_ANNOTATION'
            ? this._occurrence('annotation', frame.scope, frame.subject, frame.predicate, frame.object)
            : this._placeOf(frame);

        if (name !== 'OPEN_TRIPLE_TERM') {
            this._keys.set(token, key);
        }

        const opened = OPENING_TOKENS[name];
        const next = this._createFrame(opened.kind, key, opened.state, name !== 'OPEN_ANNOTATION');

        next.subject = opened.kind === 'propertyList' || opened.kind === 'annotation' ? key : undefined;
        this._frames.push(next);
    }

    /**
     * Tell whether a curly bracket opens a graph block of TriG rather than a node written in place.
     * @param frame The frame the bracket is written in.
     * @returns Whether it opens a graph block.
     */
    private _opensGraph(frame: Frame): boolean {
        return this._layout !== 'n3' && (frame.state === 'subject' || frame.state === 'predicate');
    }

    /**
     * Open a graph block of TriG, named by the subject before it or unnamed.
     * @param token The curly bracket.
     * @param frame The frame the bracket is written in.
     */
    private _openGraph(token: IToken, frame: Frame): void {
        const key = this._occurrence('graph', frame.scope, frame.state === 'predicate' ? frame.subject : undefined);

        this._keys.set(token, key);
        this._frames.push(this._createFrame('graph', key, 'subject', false));
    }

    /**
     * Key a node written in place by where it is written in a frame.
     * @param frame The frame.
     * @returns The key.
     */
    private _placeOf(frame: Frame): string {
        if (frame.kind === 'collection') {
            return this._occurrence('item', frame.scope, String(frame.item));
        }

        if (frame.state === 'subject') {
            return this._occurrence('subject', frame.scope);
        }

        return this._occurrence('value', frame.scope, frame.subject, frame.predicate);
    }

    /**
     * Follow a token that closes a frame. Frames left open inside it, as in text that does not
     * parse, are closed with it.
     * @param kind The kind of frame the token closes.
     */
    private _close(kind: FrameKind): void {
        const index = this._frames.map(frame => frame.kind).lastIndexOf(kind);

        if (index < 1) {
            return;
        }

        const closed = this._frames[index];

        this._frames.length = index;

        const outer = this._current();

        if (closed.kind === 'annotation') {
            outer.state = 'afterObject';
        } else if (closed.isTerm) {
            this._readTerm(closed.scope);
        } else {
            this._resetStatement(outer);
        }
    }

    /**
     * Follow the end of a statement: back to the graph or document it is written in.
     */
    private _endStatement(): void {
        while (this._frames.length > 1 && this._current().kind !== 'graph') {
            this._frames.pop();
        }

        this._resetStatement(this._current());
    }

    /**
     * Expect a new statement in a frame.
     * @param frame The frame.
     */
    private _resetStatement(frame: Frame): void {
        frame.state = 'subject';
        frame.subject = undefined;
        frame.predicate = undefined;
        frame.object = undefined;
    }

    /**
     * Build a key from its parts, counting how often the same parts occurred before. The parts are
     * joined, not escaped, so that the key of a deeply nested node grows with its depth only;
     * two keys that coincide all the same are told apart by `assignBlankNodeIds`.
     * @param parts The parts.
     * @returns The key.
     */
    private _occurrence(...parts: (string | undefined)[]): string {
        const base = parts.map(part => part ?? '').join('\u0000');
        const count = this._occurrences.get(base) ?? 0;

        this._occurrences.set(base, count + 1);

        return `${base}\u0001${count}`;
    }

    /**
     * Create a frame.
     * @param kind What the frame stands for.
     * @param scope The key of the node or graph the frame belongs to.
     * @param state The part of a statement expected first.
     * @param isTerm Whether the node is a term of the frame around it.
     * @returns The frame.
     */
    private _createFrame(kind: FrameKind, scope: string, state: FrameState, isTerm: boolean): Frame {
        return { kind, scope, state, item: 0, isTerm };
    }

    /**
     * Get the innermost frame.
     * @returns The frame.
     */
    private _current(): Frame {
        return this._frames[this._frames.length - 1];
    }
}
