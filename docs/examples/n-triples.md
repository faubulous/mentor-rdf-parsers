# N-Triples Parsing

Parse [RDF 1.2 N-Triples](https://www.w3.org/TR/rdf12-n-triples/) documents with full CST access and RDF/JS quad generation.

## Basic Usage

```typescript
import { NTriplesLexer, NTriplesParser, NTriplesReader } from '@faubulous/mentor-rdf-parsers';

const input = '<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> .\n';

const lexResult = new NTriplesLexer().tokenize(input);
const cst = new NTriplesParser().parse(lexResult.tokens);
const quads = new NTriplesReader().visit(cst);

console.log(quads[0].subject.value);  // "http://example.org/Alice"
console.log(quads[0].predicate.value); // "http://example.org/knows"
console.log(quads[0].object.value);   // "http://example.org/Bob"
```

## Multiple Triples

```typescript
import { NTriplesLexer, NTriplesParser, NTriplesReader } from '@faubulous/mentor-rdf-parsers';

const input = `
<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> .
<http://example.org/Bob> <http://example.org/knows> <http://example.org/Carol> .
<http://example.org/Alice> <http://example.org/name> "Alice" .
`;

const lexResult = new NTriplesLexer().tokenize(input);
const cst = new NTriplesParser().parse(lexResult.tokens);
const quads = new NTriplesReader().visit(cst);

console.log(`Parsed ${quads.length} triples`); // "Parsed 3 triples"
```

## Literals with Language Tags

```typescript
const input = `
<http://example.org/Alice> <http://example.org/name> "Alice"@en .
<http://example.org/Alice> <http://example.org/name> "Alicia"@es .
`;

const lexResult = new NTriplesLexer().tokenize(input);
const cst = new NTriplesParser().parse(lexResult.tokens);
const quads = new NTriplesReader().visit(cst);

const englishName = quads[0].object;
console.log(englishName.value);    // "Alice"
console.log(englishName.language); // "en"
```

## Typed Literals

```typescript
const input = `
<http://example.org/Alice> <http://example.org/age> "30"^^<http://www.w3.org/2001/XMLSchema#integer> .
`;

const lexResult = new NTriplesLexer().tokenize(input);
const cst = new NTriplesParser().parse(lexResult.tokens);
const quads = new NTriplesReader().visit(cst);

const age = quads[0].object;
console.log(age.value);    // "30"
console.log(age.datatype.value); // "http://www.w3.org/2001/XMLSchema#integer"
```

## Blank Nodes

```typescript
const input = `
_:b0 <http://example.org/name> "Alice" .
_:b0 <http://example.org/knows> _:b1 .
_:b1 <http://example.org/name> "Bob" .
`;

const lexResult = new NTriplesLexer().tokenize(input);
const cst = new NTriplesParser().parse(lexResult.tokens);
const quads = new NTriplesReader().visit(cst);

console.log(quads[0].subject.termType); // "BlankNode"
console.log(quads[0].subject.value);    // "b0"
```
