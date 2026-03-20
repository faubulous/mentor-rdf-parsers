# TriG Parsing

Parse [RDF 1.2 TriG](https://www.w3.org/TR/rdf12-trig/) documents with full CST access and RDF/JS quad generation.

## Basic Usage

```typescript
import { TrigLexer, TrigParser, TrigReader } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:graph1 {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const quads = new TrigReader().visit(cst);

console.log(quads[0].graph.value); // "http://example.org/graph1"
```

## Multiple Named Graphs

```typescript
import { TrigLexer, TrigParser, TrigReader } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  
  ex:graph1 {
    ex:Alice ex:knows ex:Bob .
    ex:Alice ex:name "Alice" .
  }
  
  ex:graph2 {
    ex:Carol ex:knows ex:Dave .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const quads = new TrigReader().visit(cst);

// Group by graph
const graph1Quads = quads.filter(q => q.graph.value === 'http://example.org/graph1');
const graph2Quads = quads.filter(q => q.graph.value === 'http://example.org/graph2');

console.log(`Graph1: ${graph1Quads.length} quads`); // "Graph1: 2 quads"
console.log(`Graph2: ${graph2Quads.length} quads`); // "Graph2: 1 quads"
```

## Default Graph Statements

```typescript
const input = `
  @prefix ex: <http://example.org/> .
  
  # Statements in the default graph
  ex:Alice ex:knows ex:Bob .
  
  # Statements in a named graph
  ex:graph1 {
    ex:Carol ex:knows ex:Dave .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const quads = new TrigReader().visit(cst);

const defaultGraphQuads = quads.filter(q => q.graph.termType === 'DefaultGraph');
const namedGraphQuads = quads.filter(q => q.graph.termType === 'NamedNode');

console.log(`Default graph: ${defaultGraphQuads.length} quads`);
console.log(`Named graphs: ${namedGraphQuads.length} quads`);
```

## Blank Node Graphs

```typescript
const input = `
  @prefix ex: <http://example.org/> .
  
  [] {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const quads = new TrigReader().visit(cst);

console.log(quads[0].graph.termType); // "BlankNode"
```

## GRAPH Keyword Syntax

```typescript
const input = `
  @prefix ex: <http://example.org/> .
  
  GRAPH ex:graph1 {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const quads = new TrigReader().visit(cst);

console.log(quads[0].graph.value); // "http://example.org/graph1"
```

## Combining Turtle Features

TriG supports all Turtle features within graph blocks:

```typescript
const input = `
  @prefix ex: <http://example.org/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  
  ex:graph1 {
    # Blank nodes
    [ ex:name "Alice" ] ex:knows [ ex:name "Bob" ] .
    
    # Collections
    ex:Carol ex:friends ( ex:Dave ex:Eve ) .
    
    # Multiple predicates and objects
    ex:Frank 
      ex:name "Frank" ;
      ex:age "30"^^xsd:integer ;
      ex:knows ex:Grace, ex:Henry .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const quads = new TrigReader().visit(cst);
```

## QuadTokens: Accessing Source Positions

For IDE features that need to associate positions with quads, use `readQuadTokens()` to get `QuadTokens` objects. Each `QuadTokens` includes the graph term along with subject, predicate, and object:

```typescript
import { TrigLexer, TrigParser, TrigReader } from '@faubulous/mentor-rdf-parsers';
import type { QuadTokens } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:graph1 {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const reader = new TrigReader();
const quadTokens: QuadTokens[] = reader.readQuadTokens(cst);

for (const info of quadTokens) {
    console.log(`Subject: ${info.subject.term.value}`);
    console.log(`  Line ${info.subject.token.startLine}, column ${info.subject.token.startColumn}`);
    
    console.log(`Predicate: ${info.predicate.term.value}`);
    console.log(`Object: ${info.object.term.value}`);
    
    // Graph info is available for TriG
    if (info.graph) {
        console.log(`Graph: ${info.graph.term.value}`);
        console.log(`  Line ${info.graph.token.startLine}, column ${info.graph.token.startColumn}`);
    }
}
```

### Token Information

Each `TermToken` in a `QuadTokens` provides:
- `term`: The RDF/JS term (NamedNode, BlankNode, Literal, DefaultGraph, etc.)
- `token`: The Chevrotain token with position information:
  - `startOffset`, `endOffset`: Character offsets in the input
  - `startLine`, `endLine`: Line numbers (1-based)
  - `startColumn`, `endColumn`: Column numbers (1-based)
  - `image`: The original text of the token

```typescript
const info = quadTokens[0];

// Get the exact text span for highlighting
const graphSpan = info.graph ? {
    start: info.graph.token.startOffset,
    end: info.graph.token.endOffset,
    text: info.graph.token.image
} : null;

if (graphSpan) {
    console.log(`Graph "${info.graph.term.value}" spans characters ${graphSpan.start}-${graphSpan.end}`);
}
```
