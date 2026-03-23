# N-Quads Parsing

Parse [RDF 1.2 N-Quads](https://www.w3.org/TR/rdf12-n-quads/) documents with full CST access and RDF/JS quad generation.

## Basic Usage

```typescript
import { NQuadsLexer, NQuadsParser, NQuadsReader } from '@faubulous/mentor-rdf-parsers';

const input = '<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> <http://example.org/graph1> .\n';

const lexResult = new NQuadsLexer().tokenize(input);
const cst = new NQuadsParser().parse(lexResult.tokens);
const quads = new NQuadsReader().visit(cst);

console.log(quads[0].subject.value);  // "http://example.org/Alice"
console.log(quads[0].predicate.value); // "http://example.org/knows"
console.log(quads[0].object.value);   // "http://example.org/Bob"
console.log(quads[0].graph.value);    // "http://example.org/graph1"
```

## Multiple Named Graphs

```typescript
import { NQuadsLexer, NQuadsParser, NQuadsReader } from '@faubulous/mentor-rdf-parsers';

const input = `
<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> <http://example.org/graph1> .
<http://example.org/Carol> <http://example.org/knows> <http://example.org/Dave> <http://example.org/graph2> .
<http://example.org/Eve> <http://example.org/knows> <http://example.org/Frank> .
`;

const lexResult = new NQuadsLexer().tokenize(input);
const cst = new NQuadsParser().parse(lexResult.tokens);
const quads = new NQuadsReader().visit(cst);

// Group quads by graph
const byGraph = new Map();
for (const quad of quads) {
    const graphName = quad.graph.value || 'default';
    if (!byGraph.has(graphName)) {
        byGraph.set(graphName, []);
    }
    byGraph.get(graphName).push(quad);
}

console.log(`Found ${byGraph.size} graphs`);
```

## Default Graph

Quads without an explicit graph are in the default graph:

```typescript
const input = `
<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> .
`;

const lexResult = new NQuadsLexer().tokenize(input);
const cst = new NQuadsParser().parse(lexResult.tokens);
const quads = new NQuadsReader().visit(cst);

console.log(quads[0].graph.termType); // "DefaultGraph"
console.log(quads[0].graph.value);    // ""
```

## Blank Node Graphs

```typescript
const input = `
<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> _:g1 .
<http://example.org/Carol> <http://example.org/knows> <http://example.org/Dave> _:g1 .
`;

const lexResult = new NQuadsLexer().tokenize(input);
const cst = new NQuadsParser().parse(lexResult.tokens);
const quads = new NQuadsReader().visit(cst);

console.log(quads[0].graph.termType); // "BlankNode"
console.log(quads[0].graph.value);    // "g1"
```

## QuadContext: Accessing Source Positions

For IDE features that need to associate positions with quads, use `readQuadContexts()` to get `QuadContext` objects. Each `QuadContext` contains the subject, predicate, object, and graph with their source tokens:

```typescript
import { NQuadsLexer, NQuadsParser, NQuadsReader } from '@faubulous/mentor-rdf-parsers';
import type { QuadContext } from '@faubulous/mentor-rdf-parsers';

const input = '<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> <http://example.org/graph1> .\n';

const lexResult = new NQuadsLexer().tokenize(input);
const cst = new NQuadsParser().parse(lexResult.tokens);
const reader = new NQuadsReader();
const quadContexts: QuadContext[] = reader.readQuadContexts(cst);

for (const info of quadContexts) {
    console.log(`Subject: ${info.subject.value}`);
    console.log(`  Token position: line ${info.subjectToken.startLine}, column ${info.subjectToken.startColumn}`);
    
    console.log(`Predicate: ${info.predicate.value}`);
    console.log(`Object: ${info.object.value}`);
    
    // Graph info is available for N-Quads
    if (info.graphToken) {
        console.log(`Graph: ${info.graph.value}`);
        console.log(`  Token position: line ${info.graphToken.startLine}, column ${info.graphToken.startColumn}`);
    }
}
```

### Token Information

Each `QuadContext` provides RDF terms directly plus token metadata on `subjectToken`, `predicateToken`, `objectToken`, and optionally `graphToken`.

```typescript
const info = quadContexts[0];

// Get the exact text span for highlighting
if (info.graphToken) {
    const graphSpan = {
        start: info.graphToken.startOffset,
        end: info.graphToken.endOffset,
        text: info.graphToken.image
    };
    
    console.log(`Graph "${info.graph.value}" spans characters ${graphSpan.start}-${graphSpan.end}`);
}
```
