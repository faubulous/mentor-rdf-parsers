# Turtle Parsing

Parse [RDF 1.2 Turtle](https://www.w3.org/TR/rdf12-turtle/) documents with full CST access and RDF/JS quad generation.

## Basic Usage

```typescript
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
const cst = parser.parse(lexResult.tokens);

// 3. Read RDF/JS quads from the CST
const reader = new TurtleReader();
const quads = reader.visit(cst);

console.log(quads);
// Output: [Quad { subject: NamedNode, predicate: NamedNode, object: NamedNode, graph: DefaultGraph }]
```

## Accessing Comment Tokens

Comment tokens are included in the main token stream, making them available for formatters and serializers:

```typescript
import { TurtleLexer } from '@faubulous/mentor-rdf-parsers';

const input = `
  # This is a comment
  @prefix ex: <http://example.org/> .
  ex:Alice ex:knows ex:Bob . # end of line comment
`;

const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

// Filter comment tokens from the token stream
const comments = lexResult.tokens.filter(t => t.tokenType.name === 'COMMENT');

for (const comment of comments) {
    console.log(`Comment at line ${comment.startLine}: ${comment.image}`);
}
```

## Working with Blank Nodes

```typescript
import { TurtleLexer, TurtleParser, TurtleReader, getBlankNodeIdFromToken } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  [ ex:name "Alice" ] ex:knows [ ex:name "Bob" ] .
`;

// Lexer assigns IDs to LBRACKET tokens
const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

// Find blank node tokens and their pre-assigned IDs
const blankNodeTokens = lexResult.tokens.filter(t => t.tokenType.name === 'LBRACKET');
for (const token of blankNodeTokens) {
    console.log(`Token at offset ${token.startOffset}: ${getBlankNodeIdFromToken(token)}`);
    // Output: "Token at offset 37: _:b0"
    //         "Token at offset 62: _:b1"
}

// Reader uses these pre-assigned IDs
const cst = new TurtleParser().parse(lexResult.tokens);
const quads = new TurtleReader().visit(cst);

// Blank nodes in quads match the token IDs
const firstBlankNode = quads[0].subject;
console.log(firstBlankNode.value); // "b0"
```

## Advanced Features

### RDF 1.2 Reified Triples

```typescript
const input = `
  @prefix ex: <http://example.org/> .
  
  ex:Alice ex:said << ex:Bob ex:likes ex:Carol >> .
`;

const lexResult = new TurtleLexer().tokenize(input);
const cst = new TurtleParser().parse(lexResult.tokens);
const quads = new TurtleReader().visit(cst);
```

### Collections (RDF Lists)

```typescript
const input = `
  @prefix ex: <http://example.org/> .
  
  ex:Alice ex:friends ( ex:Bob ex:Carol ex:Dave ) .
`;

const lexResult = new TurtleLexer().tokenize(input);
const cst = new TurtleParser().parse(lexResult.tokens);
const quads = new TurtleReader().visit(cst);
```

### Multiple Objects

```typescript
const input = `
  @prefix ex: <http://example.org/> .
  
  ex:Alice ex:knows ex:Bob, ex:Carol, ex:Dave .
`;

const lexResult = new TurtleLexer().tokenize(input);
const cst = new TurtleParser().parse(lexResult.tokens);
const quads = new TurtleReader().visit(cst);
// Produces 3 quads
```

## QuadInfo: Accessing Source Positions

For IDE features that need to associate positions with triples, use `turtleDocInfo()` to get `QuadInfo` objects. Each `QuadInfo` contains the subject, predicate, and object with their source tokens:

```typescript
import { TurtleLexer, TurtleParser, TurtleReader } from '@faubulous/mentor-rdf-parsers';
import type { QuadInfo } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:Alice ex:knows ex:Bob .
`;

const lexResult = new TurtleLexer().tokenize(input);
const cst = new TurtleParser().parse(lexResult.tokens);
const reader = new TurtleReader();
const quadInfos: QuadInfo[] = reader.turtleDocInfo(cst);

for (const info of quadInfos) {
    console.log(`Subject: ${info.subject.term.value}`);
    console.log(`  Token position: line ${info.subject.token.startLine}, column ${info.subject.token.startColumn}`);
    
    console.log(`Predicate: ${info.predicate.term.value}`);
    console.log(`  Token position: line ${info.predicate.token.startLine}, column ${info.predicate.token.startColumn}`);
    
    console.log(`Object: ${info.object.term.value}`);
    console.log(`  Token position: line ${info.object.token.startLine}, column ${info.object.token.startColumn}`);
}
```

### Token Information

Each `TermToken` in a `QuadInfo` provides:
- `term`: The RDF/JS term (NamedNode, BlankNode, Literal, etc.)
- `token`: The Chevrotain token with position information:
  - `startOffset`, `endOffset`: Character offsets in the input
  - `startLine`, `endLine`: Line numbers (1-based)
  - `startColumn`, `endColumn`: Column numbers (1-based)
  - `image`: The original text of the token

```typescript
const info = quadInfos[0];

// Get the exact text span for highlighting
const subjectSpan = {
    start: info.subject.token.startOffset,
    end: info.subject.token.endOffset,
    text: info.subject.token.image
};

console.log(`Subject "${info.subject.term.value}" spans characters ${subjectSpan.start}-${subjectSpan.end}`);
```
