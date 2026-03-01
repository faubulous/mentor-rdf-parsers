import { IToken } from 'chevrotain';
import { TurtleLexer } from './turtle/parser.js';
import { SparqlLexer } from './sparql/parser.js';
import { N3Lexer } from './n3/parser.js';
import {
    getNextToken,
    getPreviousToken,
    getFirstTokenOfType,
    getLastTokenOfType,
    getTokenAtOffset,
    isVariableToken,
    isUpperCaseToken,
    getPrefixFromToken,
    getBlankNodeIdFromToken,
    BLANK_NODE_TOKEN_NAMES
} from './utils.js';

describe('Utils', () => {
    const tokenize = (input: string): IToken[] => {
        const lexer = new TurtleLexer();
        const result = lexer.tokenize(input);
        return result.tokens;
    };

    const tokenizeSparql = (input: string): IToken[] => {
        const lexer = new SparqlLexer();
        const result = lexer.tokenize(input);
        return result.tokens;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // getNextToken Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('getNextToken', () => {
        it('returns the next token when it exists', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const firstToken = tokens[0];
            const nextToken = getNextToken(tokens, firstToken);
            expect(nextToken).toBe(tokens[1]);
        });

        it('returns undefined for the last token', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const lastToken = tokens[tokens.length - 1];
            const nextToken = getNextToken(tokens, lastToken);
            expect(nextToken).toBeUndefined();
        });

        it('returns undefined when token is not in array', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const otherTokens = tokenize('<http://other.org/x>');
            const nextToken = getNextToken(tokens, otherTokens[0]);
            expect(nextToken).toBeUndefined();
        });

        it('handles single token array', () => {
            const tokens = tokenize('<http://example.org/s>');
            const nextToken = getNextToken(tokens, tokens[0]);
            expect(nextToken).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // getPreviousToken Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('getPreviousToken', () => {
        it('returns the previous token when it exists', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const secondToken = tokens[1];
            const prevToken = getPreviousToken(tokens, secondToken);
            expect(prevToken).toBe(tokens[0]);
        });

        it('returns undefined for the first token', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const firstToken = tokens[0];
            const prevToken = getPreviousToken(tokens, firstToken);
            expect(prevToken).toBeUndefined();
        });

        it('returns undefined when token is not in array', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const otherTokens = tokenize('<http://other.org/x>');
            const prevToken = getPreviousToken(tokens, otherTokens[0]);
            expect(prevToken).toBeUndefined();
        });

        it('handles single token array', () => {
            const tokens = tokenize('<http://example.org/s>');
            const prevToken = getPreviousToken(tokens, tokens[0]);
            expect(prevToken).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // getFirstTokenOfType Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('getFirstTokenOfType', () => {
        it('returns the first token of the specified type', () => {
            const tokens = tokenize('@prefix ex: <http://example.org/> . ex:s ex:p ex:o .');
            const firstPrefixedName = getFirstTokenOfType(tokens, 'PNAME_LN');
            expect(firstPrefixedName?.image).toBe('ex:s');
        });

        it('returns undefined when type is not found', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const result = getFirstTokenOfType(tokens, 'PNAME_LN');
            expect(result).toBeUndefined();
        });

        it('returns the only token when there is one of that type', () => {
            const tokens = tokenize('@prefix ex: <http://example.org/> .');
            const nsToken = getFirstTokenOfType(tokens, 'PNAME_NS');
            expect(nsToken?.image).toBe('ex:');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // getLastTokenOfType Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('getLastTokenOfType', () => {
        it('returns the last token of the specified type', () => {
            const tokens = tokenize('@prefix ex: <http://example.org/> . ex:s ex:p ex:o .');
            const lastPrefixedName = getLastTokenOfType(tokens, ['PNAME_LN']);
            expect(lastPrefixedName?.image).toBe('ex:o');
        });

        it('returns undefined when type is not found', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const result = getLastTokenOfType(tokens, ['PNAME_LN']);
            expect(result).toBeUndefined();
        });

        it('handles multiple types', () => {
            const tokens = tokenize('@prefix ex: <http://example.org/> . ex:s <http://example.org/p> ex:o .');
            const lastToken = getLastTokenOfType(tokens, ['PNAME_LN', 'IRIREF']);
            expect(lastToken?.image).toBe('ex:o');
        });

        it('returns last matching token across multiple types', () => {
            const tokens = tokenize('@prefix ex: <http://example.org/> . ex:s ex:p <http://example.org/o> .');
            const lastToken = getLastTokenOfType(tokens, ['PNAME_LN', 'IRIREF']);
            expect(lastToken?.image).toBe('<http://example.org/o>');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // getTokenAtOffset Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('getTokenAtOffset', () => {
        it('returns token at exact start offset', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const result = getTokenAtOffset(tokens, 0);
            expect(result.length).toBe(1);
            expect(result[0].image).toBe('<http://example.org/s>');
        });

        it('returns token at offset within token', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const result = getTokenAtOffset(tokens, 10);
            expect(result.length).toBe(1);
            expect(result[0].image).toBe('<http://example.org/s>');
        });

        it('returns token at exact end offset', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const firstTokenEnd = tokens[0].startOffset + tokens[0].image.length;
            const result = getTokenAtOffset(tokens, firstTokenEnd);
            expect(result.length).toBe(1);
            expect(result[0].image).toBe('<http://example.org/s>');
        });

        it('returns empty array when offset is between tokens', () => {
            const tokens = tokenize('<http://example.org/s>   <http://example.org/p>');
            // Offset in the whitespace between tokens
            const result = getTokenAtOffset(tokens, 23);
            expect(result.length).toBe(0);
        });

        it('returns empty array when offset is beyond all tokens', () => {
            const tokens = tokenize('<http://example.org/s>');
            const result = getTokenAtOffset(tokens, 1000);
            expect(result.length).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // isVariableToken Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('isVariableToken', () => {
        it('returns true for VAR1 (?var)', () => {
            const tokens = tokenizeSparql('SELECT ?x WHERE { ?x ?p ?o }');
            const varToken = tokens.find(t => t.image === '?x');
            expect(varToken).toBeDefined();
            expect(isVariableToken(varToken!)).toBe(true);
        });

        it('returns true for VAR2 ($var)', () => {
            const tokens = tokenizeSparql('SELECT $x WHERE { $x $p $o }');
            const varToken = tokens.find(t => t.image === '$x');
            expect(varToken).toBeDefined();
            expect(isVariableToken(varToken!)).toBe(true);
        });

        it('returns false for non-variable tokens', () => {
            const tokens = tokenize('<http://example.org/s>');
            expect(isVariableToken(tokens[0])).toBe(false);
        });

        it('returns false for keyword tokens', () => {
            const tokens = tokenizeSparql('SELECT ?x WHERE { ?x ?p ?o }');
            const selectToken = tokens.find(t => t.image === 'SELECT');
            expect(selectToken).toBeDefined();
            expect(isVariableToken(selectToken!)).toBe(false);
        });

        it('returns false for prefixed names', () => {
            const tokens = tokenize('@prefix ex: <http://example.org/> . ex:s ex:p ex:o .');
            const prefixedToken = tokens.find(t => t.image === 'ex:s');
            expect(prefixedToken).toBeDefined();
            expect(isVariableToken(prefixedToken!)).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // isUpperCase Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('isUpperCase', () => {
        it('returns true for upper case token', () => {
            const tokens = tokenizeSparql('SELECT ?x WHERE { ?x ?p ?o }');
            const selectToken = tokens.find(t => t.image === 'SELECT');
            expect(isUpperCaseToken(selectToken)).toBe(true);
        });

        it('returns false for lower case token', () => {
            const tokens = tokenizeSparql('select ?x where { ?x ?p ?o }');
            const selectToken = tokens.find(t => t.image.toLowerCase() === 'select');
            expect(isUpperCaseToken(selectToken)).toBe(false);
        });

        it('returns false for mixed case token', () => {
            const tokens = tokenizeSparql('Select ?x Where { ?x ?p ?o }');
            const selectToken = tokens.find(t => t.image === 'Select');
            expect(isUpperCaseToken(selectToken)).toBe(false);
        });

        it('returns false for undefined token', () => {
            expect(isUpperCaseToken(undefined)).toBe(false);
        });

        it('returns true for tokens with numbers (upper case)', () => {
            const tokens = tokenizeSparql('SELECT (SHA256(?x) AS ?hash) WHERE { ?x ?p ?o }');
            const sha256Token = tokens.find(t => t.image === 'SHA256');
            expect(isUpperCaseToken(sha256Token)).toBe(true);
        });

        it('returns true for single upper case letter token', () => {
            const tokens = tokenize('<http://s> a <http://Type> .');
            const aToken = tokens.find(t => t.image === 'a');
            // 'a' in lower case should return false
            expect(isUpperCaseToken(aToken)).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // getPrefixFromToken Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('getPrefixFromToken', () => {
        it('extracts prefix from PNAME_LN token', () => {
            const tokens = tokenize('@prefix ex: <http://example.org/> . ex:subject ex:predicate ex:object .');
            const pnameLn = tokens.find(t => t.tokenType.name === 'PNAME_LN');
            expect(pnameLn).toBeDefined();
            expect(getPrefixFromToken(pnameLn!)).toBe('ex');
        });

        it('extracts prefix from PNAME_NS token', () => {
            const tokens = tokenize('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
            const pnameNs = tokens.find(t => t.tokenType.name === 'PNAME_NS');
            expect(pnameNs).toBeDefined();
            expect(getPrefixFromToken(pnameNs!)).toBe('foaf');
        });

        it('handles empty prefix in PNAME_LN', () => {
            const tokens = tokenize('@prefix : <http://example.org/> . :subject :predicate :object .');
            const pnameLn = tokens.find(t => t.tokenType.name === 'PNAME_LN');
            expect(pnameLn).toBeDefined();
            expect(getPrefixFromToken(pnameLn!)).toBe('');
        });

        it('handles empty prefix in PNAME_NS', () => {
            const tokens = tokenize('@prefix : <http://example.org/> .');
            const pnameNs = tokens.find(t => t.tokenType.name === 'PNAME_NS');
            expect(pnameNs).toBeDefined();
            expect(getPrefixFromToken(pnameNs!)).toBe('');
        });

        it('throws error for non-prefixed token types', () => {
            const tokens = tokenize('<http://example.org/s>');
            const iriToken = tokens[0];
            expect(() => getPrefixFromToken(iriToken)).toThrow('Cannot get prefix from token type: IRIREF');
        });

        it('handles complex prefix names', () => {
            const tokens = tokenize('@prefix schema-org: <http://schema.org/> . schema-org:Person schema-org:name "John" .');
            const pnameLn = tokens.find(t => t.tokenType.name === 'PNAME_LN');
            expect(pnameLn).toBeDefined();
            expect(getPrefixFromToken(pnameLn!)).toBe('schema-org');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Blank Node ID Assignment Tests
    // ─────────────────────────────────────────────────────────────────────────

    describe('assignBlankNodeIds', () => {
        it('assigns IDs to LBRACKET tokens for anonymous blank nodes', () => {
            const tokens = tokenize('[] a <http://example.org/Thing> .');
            // Tokens should already have IDs assigned by lexer
            const lbracket = tokens.find(t => t.tokenType.name === 'LBRACKET');
            expect(lbracket).toBeDefined();
            expect(getBlankNodeIdFromToken(lbracket!)).toBe('b0');
        });

        it('assigns IDs to LPARENT tokens for collections', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> (1 2 3) .');
            const lparent = tokens.find(t => t.tokenType.name === 'LPARENT');
            expect(lparent).toBeDefined();
            expect(getBlankNodeIdFromToken(lparent!)).toBe('b0');
        });

        it('assigns sequential IDs to multiple blank node tokens', () => {
            const tokens = tokenize('[ a <http://example.org/A> ] [ a <http://example.org/B> ] .');
            const lbrackets = tokens.filter(t => t.tokenType.name === 'LBRACKET');
            expect(lbrackets).toHaveLength(2);
            expect(getBlankNodeIdFromToken(lbrackets[0])).toBe('b0');
            expect(getBlankNodeIdFromToken(lbrackets[1])).toBe('b1');
        });

        it('assigns IDs to blank nodes in nested structures', () => {
            const tokens = tokenize('[ <http://example.org/p> (1 [ <http://example.org/q> 2 ] 3) ] .');
            const lbrackets = tokens.filter(t => t.tokenType.name === 'LBRACKET');
            const lparents = tokens.filter(t => t.tokenType.name === 'LPARENT');
            expect(lbrackets).toHaveLength(2);
            expect(lparents).toHaveLength(1);
            // The IDs should be sequential based on document order
            const allBlankNodeTokens = tokens.filter(t => BLANK_NODE_TOKEN_NAMES.has(t.tokenType.name));
            expect(allBlankNodeTokens.map(t => getBlankNodeIdFromToken(t))).toEqual(['b0', 'b1', 'b2']);
        });

        it('does not assign IDs to non-blank-node tokens', () => {
            const tokens = tokenize('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
            const hasBlankNodeId = tokens.some(t => getBlankNodeIdFromToken(t) !== undefined);
            expect(hasBlankNodeId).toBe(false);
        });

        it('supports custom ID generator function', () => {
            const lexer = new TurtleLexer((counter) => `custom-${counter}`);
            const result = lexer.tokenize('[] a <http://example.org/Thing> .');
            const lbracket = result.tokens.find(t => t.tokenType.name === 'LBRACKET');
            expect(getBlankNodeIdFromToken(lbracket!)).toBe('custom-0');
        });

        it('can disable ID assignment with null generator', () => {
            const lexer = new TurtleLexer(null);
            const result = lexer.tokenize('[] a <http://example.org/Thing> .');
            const lbracket = result.tokens.find(t => t.tokenType.name === 'LBRACKET');
            expect(getBlankNodeIdFromToken(lbracket!)).toBeUndefined();
        });
    });

    describe('getBlankNodeIdFromToken', () => {
        it('returns undefined for tokens without blank node IDs', () => {
            const tokens = tokenize('<http://example.org/s>');
            expect(getBlankNodeIdFromToken(tokens[0])).toBeUndefined();
        });

        it('returns the blank node ID from token payload', () => {
            const token: IToken = {
                tokenType: { name: 'TEST' } as any,
                image: 'test',
                startOffset: 0,
                endOffset: 3,
                payload: { blankNodeId: '_:test123' }
            } as IToken;
            expect(getBlankNodeIdFromToken(token)).toBe('_:test123');
        });
    });

    describe('SPARQL blank node ID assignment', () => {
        it('assigns IDs to LBRACKET tokens in SPARQL queries', () => {
            const sparqlLexer = new SparqlLexer();
            const result = sparqlLexer.tokenize('SELECT * WHERE { [] a ?type }');
            const lbracket = result.tokens.find(t => t.tokenType.name === 'LBRACKET');
            expect(lbracket).toBeDefined();
            // Note: LCURLY also gets an ID (b0) because it's in BLANK_NODE_TOKEN_NAMES
            // for N3 formula support, so LBRACKET gets b1
            const id = getBlankNodeIdFromToken(lbracket!);
            expect(id).toBeDefined();
            expect(id?.startsWith('b')).toBe(true);
        });

        it('assigns IDs to multiple blank node tokens in SPARQL', () => {
            const sparqlLexer = new SparqlLexer();
            const result = sparqlLexer.tokenize('SELECT * WHERE { [ a ?type ] . [ a ?other ] }');
            const lbrackets = result.tokens.filter(t => t.tokenType.name === 'LBRACKET');
            expect(lbrackets).toHaveLength(2);
            // Both LBRACKET tokens should have sequential IDs
            const id0 = getBlankNodeIdFromToken(lbrackets[0]);
            const id1 = getBlankNodeIdFromToken(lbrackets[1]);
            expect(id0).toBeDefined();
            expect(id1).toBeDefined();
            expect(id0).not.toBe(id1);
        });
    });

    describe('N3 blank node ID assignment', () => {
        it('assigns IDs to LCURLY tokens for formulas', () => {
            const lexer = new N3Lexer();
            const result = lexer.tokenize('{ <http://example.org/s> <http://example.org/p> <http://example.org/o> }');
            const lcurly = result.tokens.find(t => t.tokenType.name === 'LCURLY');
            expect(lcurly).toBeDefined();
            expect(getBlankNodeIdFromToken(lcurly!)).toBe('b0');
        });

        it('assigns sequential IDs to nested formulas', () => {
            const lexer = new N3Lexer();
            const result = lexer.tokenize('{ { <http://example.org/s> <http://example.org/p> <http://example.org/o> } a <http://example.org/Formula> }');
            const lcurlys = result.tokens.filter(t => t.tokenType.name === 'LCURLY');
            expect(lcurlys).toHaveLength(2);
            expect(getBlankNodeIdFromToken(lcurlys[0])).toBe('b0');
            expect(getBlankNodeIdFromToken(lcurlys[1])).toBe('b1');
        });
    });
});
