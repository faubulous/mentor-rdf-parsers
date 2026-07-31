import { TurtleLexer, TurtleParser, TurtleTokens } from '../turtle/parser.js';
import { SparqlLexer, SparqlParser, SparqlTokens } from '../sparql/parser.js';
import { tokenizeWithTriplate } from './overlay.js';

const TURTLE_TEMPLATE = `---
params {
  type: iri
}
example person {
  type: schema:Person
}
---
@prefix schema: <http://schema.org/> .
\${type} a schema:Thing .
`;

const SPARQL_TEMPLATE = `---
params {
  type: iri
}
---
SELECT * WHERE { ?s a \${type} }
`;

const SPARQL_PAGINATION_TEMPLATE = `---
params {
  limit: int
  offset: int
}
---
SELECT * WHERE { ?s ?p ?o }
LIMIT \${limit}
OFFSET \${offset}
`;

const SPARQL_LOWERCASE_PAGINATION_TEMPLATE = `---
params {
  count: int
}
---
SELECT * WHERE { ?s ?p ?o }
limit \${count}
offset \${count}
`;

const SPARQL_OFFSET_FIRST_TEMPLATE = `---
params {
  limit: int
  offset: int
}
---
SELECT * WHERE { ?s ?p ?o }
OFFSET \${offset}
LIMIT \${limit}
`;

const SPARQL_DIRECTIVE_PAGINATION_TEMPLATE = `---
params {
  limit: int
}
---
SELECT * WHERE { ?s ?p ?o }
{% if limit %}
LIMIT \${limit}
{% endif %}
`;

describe('tokenizeWithTriplate', () => {
    const names = (tokens: { tokenType: { name: string } }[]) => tokens.map(t => t.tokenType.name);

    describe('standards-compliant default', () => {
        it('passes a non-template document through the host lexer unchanged', () => {
            const text = '@prefix ex: <http://example.org/> .\nex:s ex:p ex:o .';
            const expected = new TurtleLexer().tokenize(text).tokens;
            const result = tokenizeWithTriplate(new TurtleLexer(), text);

            expect(result.template).toBe(false);
            expect(result.tokens).toBe(result.parseTokens);
            expect(names(result.tokens)).toEqual(names(expected));
        });

        it('never adds Triplate token types to the host token lists', () => {
            const hasTriplate = (list: { name: string }[]) => list.some(t => t.name.startsWith('TRIPLATE'));

            expect(hasTriplate(TurtleTokens)).toBe(false);
            expect(hasTriplate(SparqlTokens)).toBe(false);
        });
    });

    describe('Turtle template', () => {
        const result = tokenizeWithTriplate(new TurtleLexer(), TURTLE_TEMPLATE);

        it('detects the template', () => {
            expect(result.template).toBe(true);
        });

        it('emits a real interpolation token (not a fake IRIREF) for ${type}', () => {
            const interp = result.tokens.find(t => t.tokenType.name === 'TRIPLATE_INTERPOLATION');

            expect(interp).toBeDefined();
            expect(interp!.image).toBe('${type}');
            expect((interp!.tokenType as { isInterpolation?: boolean }).isInterpolation).toBe(true);
        });

        it('makes the frontmatter non-opaque (no block token)', () => {
            expect(result.tokens.some(t => t.tokenType.name === 'TRIPLATE_FRONTMATTER')).toBe(false);
        });

        it('emits a real PNAME token for the frontmatter example value', () => {
            // schema:Person lives in the frontmatter; schema:Thing in the body. Both are real PNAMEs.
            const pnames = result.tokens.filter(t => t.tokenType.name === 'PNAME_LN').map(t => t.image);

            expect(pnames).toContain('schema:Thing');
            expect(pnames).toContain('schema:Person');

            // The frontmatter PNAME sits at its true source offset.
            const person = result.tokens.find(t => t.tokenType.name === 'PNAME_LN' && t.image === 'schema:Person')!;
            expect(TURTLE_TEMPLATE.slice(person.startOffset, person.endOffset + 1)).toBe('schema:Person');
            expect(person.startOffset).toBe(TURTLE_TEMPLATE.indexOf('schema:Person'));
        });

        it('preserves source offsets for every public token', () => {
            for (const token of result.tokens) {
                expect(TURTLE_TEMPLATE.slice(token.startOffset, token.endOffset + 1)).toBe(token.image);
            }
        });

        it('produces parse tokens that the host parser accepts without errors', () => {
            const parser = new TurtleParser();
            parser.parse(result.parseTokens, false);

            expect(parser.errors).toHaveLength(0);
        });
    });

    describe('SPARQL template', () => {
        const result = tokenizeWithTriplate(new SparqlLexer(), SPARQL_TEMPLATE);

        it('emits a real interpolation token for ${type}', () => {
            const interp = result.tokens.find(t => t.tokenType.name === 'TRIPLATE_INTERPOLATION');

            expect(interp).toBeDefined();
            expect(interp!.image).toBe('${type}');
        });

        it('produces parse tokens that the host parser accepts without errors', () => {
            const parser = new SparqlParser();
            parser.parse(result.parseTokens, false);

            expect(parser.errors).toHaveLength(0);
        });

        it('preserves source offsets for every public token', () => {
            for (const token of result.tokens) {
                expect(SPARQL_TEMPLATE.slice(token.startOffset, token.endOffset + 1)).toBe(token.image);
            }
        });
    });

    describe('SPARQL numeric slots', () => {
        const parseErrors = (text: string) => {
            const parser = new SparqlParser();
            parser.parse(tokenizeWithTriplate(new SparqlLexer(), text).parseTokens, false);

            return parser.errors;
        };

        const result = tokenizeWithTriplate(new SparqlLexer(), SPARQL_PAGINATION_TEMPLATE);

        it('accepts bare LIMIT/OFFSET interpolations without parser errors', () => {
            expect(parseErrors(SPARQL_PAGINATION_TEMPLATE)).toHaveLength(0);
        });

        it('emits real interpolation tokens for the LIMIT and OFFSET arguments', () => {
            const images = result.tokens.filter(t => t.tokenType.name === 'TRIPLATE_INTERPOLATION').map(t => t.image);

            expect(images).toEqual(['${limit}', '${offset}']);
        });

        it('preserves source offsets for every public token', () => {
            for (const token of result.tokens) {
                expect(SPARQL_PAGINATION_TEMPLATE.slice(token.startOffset, token.endOffset + 1)).toBe(token.image);
            }
        });

        it('matches the keywords case-insensitively', () => {
            expect(parseErrors(SPARQL_LOWERCASE_PAGINATION_TEMPLATE)).toHaveLength(0);
        });

        it('accepts OFFSET before LIMIT', () => {
            expect(parseErrors(SPARQL_OFFSET_FIRST_TEMPLATE)).toHaveLength(0);
        });

        it('accepts a LIMIT wrapped in directive lines of its own', () => {
            expect(parseErrors(SPARQL_DIRECTIVE_PAGINATION_TEMPLATE)).toHaveLength(0);
        });
    });

    describe('frontmatter RDF fidelity', () => {
        it('emits a real IRIREF token for a full IRI example value', () => {
            const text = '---\nparams { home: iri }\nexample x {\n  home: <http://example.org/p>\n}\n---\n${home} a ?o .\n';
            const result = tokenizeWithTriplate(new TurtleLexer(), text);

            const iri = result.tokens.find(t => t.tokenType.name === 'IRIREF' && t.image === '<http://example.org/p>');
            expect(iri).toBeDefined();
            expect(text.slice(iri!.startOffset, iri!.endOffset + 1)).toBe('<http://example.org/p>');
        });

        it('does not throw and still tokenizes the body when the frontmatter is malformed', () => {
            const text = '---\nparams {\n  type: iri\n  oops @#$ broken\n---\n<urn:s> a <urn:o> .\n';

            expect(() => tokenizeWithTriplate(new TurtleLexer(), text)).not.toThrow();

            const result = tokenizeWithTriplate(new TurtleLexer(), text);
            expect(result.template).toBe(true);
            // The body still produces tokens despite the malformed header.
            expect(result.tokens.length).toBeGreaterThan(0);
        });
    });
});
