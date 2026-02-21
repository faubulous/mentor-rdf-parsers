# Mentor RDF Parsers

Standards-compliant, fault-tolerant parsers for RDF languages, built with [Chevrotain](https://chevrotain.io/). Designed for use in IDEs and language tools where error recovery and concrete syntax tree (CST) access are more important than raw parsing speed.

## Supported Languages

| Language | Lexer | Parser | Reader | W3C Specification |
|----------|-------|--------|--------|--------------------|
| **N-Triples** | `NTriplesLexer` | `NTriplesParser` | `NTriplesReader` | [RDF 1.2 N-Triples](https://www.w3.org/TR/rdf12-n-triples/) |
| **N-Quads** | `NQuadsLexer` | `NQuadsParser` | `NQuadsReader` | [RDF 1.2 N-Quads](https://www.w3.org/TR/rdf12-n-quads/) |
| **Turtle** | `TurtleLexer` | `TurtleParser` | `TurtleReader` | [RDF 1.2 Turtle](https://www.w3.org/TR/rdf12-turtle/) |
| **TriG** | `TrigLexer` | `TrigParser` | — | [RDF 1.2 TriG](https://www.w3.org/TR/rdf12-trig/) |
| **N3 (Notation3)** | `N3Lexer` | `N3Parser` | `N3Reader` | [W3C N3](https://w3c.github.io/N3/spec/) |
| **SPARQL 1.2** | `SparqlLexer` | `SparqlParser` | — | [SPARQL 1.2 Query](https://www.w3.org/TR/sparql12-query/) |

## Features

### Standards Compliance

Every parser implements the grammar productions from the corresponding W3C specification. The parsers are validated against the official W3C test suites:

- **Turtle** — W3C RDF Test Suite for Turtle
- **TriG** — W3C RDF Test Suite for TriG
- **N-Triples** — W3C RDF Test Suite for N-Triples
- **N-Quads** — W3C RDF Test Suite for N-Quads
- **SPARQL 1.2** — W3C SPARQL 1.2 Test Suite (syntax tests)

### Fault Tolerance

All parsers run with Chevrotain's `recoveryEnabled: true`, which means they can recover from syntax errors and continue parsing the rest of the document. This is essential for IDE use cases where users are actively editing and the document is frequently in an invalid state.

### Concrete Syntax Trees

The parsers produce Chevrotain CST nodes, giving you full access to every token including its position, image, and type. This makes the parsers suitable for:

- Syntax highlighting (comment tokens are preserved)
- Code navigation and symbol extraction
- Refactoring and formatting tools
- Diagnostics and error reporting with precise source locations

### RDF/JS Quad Readers

Reader classes traverse the CST and produce [RDF/JS](https://rdf.js.org/data-model-spec/)-compliant Quad objects (via `@rdfjs/data-model`). Available for N-Triples, N-Quads, Turtle, and N3.

## Installation

```bash
npm install @faubulous/mentor-rdf-parsers
```

## Usage

Each parser follows the same three-step pattern: **tokenize → parse → (optionally) read**.

### Parsing Turtle

```js
import { TurtleLexer, TurtleParser, TurtleReader } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:Alice ex:knows ex:Bob .
`;

// 1. Tokenize
const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

// 2. Parse into a CST
const parser = new TurtleParser();
const cst = parser.parse('http://example.org/', lexResult.tokens);

// 3. Read RDF/JS quads from the CST
const reader = new TurtleReader();
const quads = reader.visit(cst);
```

### Parsing N-Triples

```js
import { NTriplesLexer, NTriplesParser, NTriplesReader } from '@faubulous/mentor-rdf-parsers';

const input = '<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> .\n';

const lexResult = new NTriplesLexer().tokenize(input);
const cst = new NTriplesParser().parse(lexResult.tokens);
const quads = new NTriplesReader().visit(cst);
```

### Parsing N-Quads

```js
import { NQuadsLexer, NQuadsParser, NQuadsReader } from '@faubulous/mentor-rdf-parsers';

const input = '<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> <http://example.org/graph1> .\n';

const lexResult = new NQuadsLexer().tokenize(input);
const cst = new NQuadsParser().parse(lexResult.tokens);
const quads = new NQuadsReader().visit(cst);
```

### Parsing SPARQL 1.2

```js
import { SparqlLexer, SparqlParser, resolveCodepointEscapes } from '@faubulous/mentor-rdf-parsers';

const input = 'SELECT ?name WHERE { ?person <http://example.org/name> ?name }';

// Pre-process codepoint escapes (per SPARQL spec section 19.2)
const processed = resolveCodepointEscapes(input);

const lexResult = new SparqlLexer().tokenize(processed);
const cst = new SparqlParser().parse(lexResult.tokens);
```

### Parsing N3 (Notation3)

```js
import { N3Lexer, N3Parser, N3Reader } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  { ex:Alice ex:knows ex:Bob } => { ex:Bob ex:knows ex:Alice } .
`;

const lexResult = new N3Lexer().tokenize(input);
const cst = new N3Parser().parse('http://example.org/', lexResult.tokens);
const quads = new N3Reader().visit(cst);
```

### Parsing TriG

```js
import { TrigLexer, TrigParser } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:graph1 {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const parser = new TrigParser();
parser.input = lexResult.tokens;
const cst = parser.trigDoc();
```

### Error Recovery

Because the parsers are fault-tolerant, you can inspect errors without the parse failing:

```js
const parser = new TurtleParser();
parser.input = lexResult.tokens;
const cst = parser.turtleDoc();

// Errors are collected, not thrown
for (const error of parser.errors) {
    console.log(error.message);
}
```

## Architecture

```
Input string
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Lexer   │────▶│  Parser  │────▶│  Reader  │
│ (tokens) │     │  (CST)   │     │ (quads)  │
└──────────┘     └──────────┘     └──────────┘
```

- **Lexer** — Tokenizes the input string using token definitions from `src/tokens.mjs`.
- **Parser** — Produces a concrete syntax tree (CST) from the token stream using Chevrotain's grammar rules.
- **Reader** — Walks the CST and produces RDF/JS Quad objects. Available for N-Triples, N-Quads, Turtle, and N3.

## Testing

```bash
npm test
```

The test suite includes over 1,200 tests covering all supported languages, including the official W3C conformance test suites.

## License

[LGPL-2.1-or-later](LICENSE)
