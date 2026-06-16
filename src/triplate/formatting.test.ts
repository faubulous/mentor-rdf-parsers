import { TurtleLexer } from '../turtle/parser.js';
import { SparqlLexer } from '../sparql/parser.js';
import { tokenizeTemplateForFormatting } from './formatting.js';

describe('tokenizeTemplateForFormatting', () => {
    it('returns null for a non-template document', () => {
        expect(tokenizeTemplateForFormatting(new TurtleLexer(), '<urn:s> <urn:p> <urn:o> .')).toBeNull();
    });

    it('returns body tokens with interpolations as TRIPLATE_INTERPOLATION and no frontmatter tokens', () => {
        const text = '---\nparams { type: iri }\nexample x {\n  type: schema:Person\n}\n---\n@prefix ex: <http://ex/> .\n${type} a ex:Thing .\n';
        const result = tokenizeTemplateForFormatting(new TurtleLexer(), text)!;

        expect(result).not.toBeNull();
        expect(result.hasDirectives).toBe(false);

        const names = result.bodyTokens.map(t => t.tokenType.name);
        // Body host tokens are present…
        expect(names).toContain('TTL_PREFIX');
        expect(names).toContain('A');
        // …the interpolation is a real term token…
        const interp = result.bodyTokens.find(t => t.tokenType.name === 'TRIPLATE_INTERPOLATION');
        expect(interp?.image).toBe('${type}');
        // …and nothing from the frontmatter leaks in (schema:Person is only in the frontmatter).
        expect(result.bodyTokens.some(t => t.image === 'schema:Person')).toBe(false);
    });

    it('preserves inline body comments as COMMENT tokens', () => {
        const text = '---\nparams { n: int }\n---\n# leading\n<urn:s> <urn:p> <urn:o> . # trailing\n';
        const result = tokenizeTemplateForFormatting(new TurtleLexer(), text)!;

        const comments = result.bodyTokens.filter(t => t.tokenType.name === 'COMMENT').map(t => t.image);
        expect(comments).toContain('# leading');
        expect(comments.some(c => c.startsWith('# trailing'))).toBe(true);
    });

    it('flags control directives so the caller can skip', () => {
        const text = '---\nparams { limit: int }\n---\nSELECT * WHERE { ?s ?p ?o }\n{% if limit %}LIMIT ${limit}{% endif %}\n';
        const result = tokenizeTemplateForFormatting(new SparqlLexer(), text)!;

        expect(result.hasDirectives).toBe(true);
    });
});
