import { createTokenInstance, IToken, TokenType } from 'chevrotain';
import { TriplateToken } from './tokens.js';

/** A neutralised Triplate construct and the kind it stands for. */
export interface Replacement {
    start: number;
    end: number;
    kind: 'frontmatter' | 'directive' | 'iri' | 'string' | 'value';
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/;
const DIRECTIVE_LINE_RE = /^[^\r\n]*\{%[^\r\n]*%\}[^\r\n]*/gm;
const IRI_TEMPLATE_RE = /\$<[^>]*>/g;
const STRING_TEMPLATE_RE = /\$"(?:[^"\\]|\\.)*"(?:@[A-Za-z][A-Za-z0-9-]*)?/g;
const VALUE_INTERP_RE = /\$\{[^}]*\}/g;

function blank(s: string): string {
    return s.replace(/[^\r\n]/g, ' ');
}

function iriPlaceholder(m: string): string {
    return '<' + '_'.repeat(Math.max(0, m.length - 2)) + '>';
}

function stringPlaceholder(m: string): string {
    return '"' + '_'.repeat(Math.max(0, m.length - 2)) + '"';
}

/**
 * Produces the host-parseable placeholder rendering of `text` and records the span
 * of every Triplate construct it neutralised. All replacements are length-preserving,
 * so the recorded spans line up byte-for-byte with both `text` and the rendering.
 */
export function renderForHost(text: string): { rendering: string; replacements: Replacement[] } {
    const replacements: Replacement[] = [];

    // Frontmatter first — blanked entirely; later passes never see its contents.
    let rendering = text.replace(FRONTMATTER_RE, (m, _nl, offset: number) => {
        const trimmed = m.replace(/\r?\n$/, '');
        replacements.push({ start: offset, end: offset + trimmed.length, kind: 'frontmatter' });
        return blank(m);
    });

    // Whole directive lines next — a conditional must disappear as a unit.
    rendering = rendering.replace(DIRECTIVE_LINE_RE, (m, offset: number) => {
        replacements.push({ start: offset, end: offset + m.length, kind: 'directive' });
        return blank(m);
    });

    // Inline interpolations, replaced with same-length term/literal placeholders.
    rendering = rendering.replace(IRI_TEMPLATE_RE, (m, offset: number) => {
        replacements.push({ start: offset, end: offset + m.length, kind: 'iri' });
        return iriPlaceholder(m);
    });

    rendering = rendering.replace(STRING_TEMPLATE_RE, (m, offset: number) => {
        replacements.push({ start: offset, end: offset + m.length, kind: 'string' });
        return stringPlaceholder(m);
    });

    rendering = rendering.replace(VALUE_INTERP_RE, (m, offset: number) => {
        replacements.push({ start: offset, end: offset + m.length, kind: 'value' });
        return iriPlaceholder(m);
    });

    return { rendering, replacements };
}

/** The Triplate token type each inline interpolation kind maps to in the public stream. */
export const INLINE_TOKEN: Record<'iri' | 'string' | 'value', TokenType> = {
    iri: TriplateToken.TRIPLATE_IRI_TEMPLATE,
    string: TriplateToken.TRIPLATE_STRING_TEMPLATE,
    value: TriplateToken.TRIPLATE_INTERPOLATION,
};

/** Computes the 1-based line/column of a character offset in `text` (Chevrotain convention). */
function positionAt(text: string, offset: number): { line: number; column: number } {
    let line = 1;
    let lineStart = 0;

    for (let i = 0; i < offset; i++) {
        if (text.charCodeAt(i) === 10 /* \n */) {
            line++;
            lineStart = i + 1;
        }
    }

    return { line, column: offset - lineStart + 1 };
}

/** Creates a Triplate token instance spanning `[start, end)` of `text`. */
export function makeToken(tokenType: TokenType, text: string, start: number, end: number): IToken {
    const image = text.slice(start, end);
    const startPos = positionAt(text, start);
    const endPos = positionAt(text, Math.max(start, end - 1));

    return createTokenInstance(tokenType, image, start, end - 1, startPos.line, endPos.line, startPos.column, endPos.column);
}
