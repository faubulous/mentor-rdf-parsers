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

## QuadContext: Accessing Source Positions

For IDE features that need to associate positions with quads, use `readQuadContexts()` to get `QuadContext` objects. Each `QuadContext` includes the graph term along with subject, predicate, and object:

```typescript
import { TrigLexer, TrigParser, TrigReader } from '@faubulous/mentor-rdf-parsers';
import type { QuadContext } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:graph1 {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new TrigLexer().tokenize(input);
const cst = new TrigParser().parse(lexResult.tokens);
const reader = new TrigReader();
const quadContexts: QuadContext[] = reader.readQuadContexts(cst);

for (const info of quadContexts) {
  console.log(`Subject: ${info.subject.value}`);
  console.log(`  Line ${info.subjectToken.startLine}, column ${info.subjectToken.startColumn}`);
    
  console.log(`Predicate: ${info.predicate.value}`);
  console.log(`Object: ${info.object.value}`);
    
    // Graph info is available for TriG
  if (info.graphToken) {
    console.log(`Graph: ${info.graph.value}`);
    console.log(`  Line ${info.graphToken.startLine}, column ${info.graphToken.startColumn}`);
    }
}
```

### Token Information

Each `QuadContext` provides RDF terms directly plus token metadata on `subjectToken`, `predicateToken`, `objectToken`, and optionally `graphToken`.

```typescript
const info = quadContexts[0];

// Get the exact text span for highlighting
const graphSpan = info.graphToken ? {
  start: info.graphToken.startOffset,
  end: info.graphToken.endOffset,
  text: info.graphToken.image
} : null;

if (graphSpan) {
  console.log(`Graph "${info.graph.value}" spans characters ${graphSpan.start}-${graphSpan.end}`);
}
```
