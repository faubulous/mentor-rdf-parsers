# Blank Node ID Pre-assignment

All lexers automatically assign stable identifiers to tokens that produce blank nodes during parsing. This enables mapping blank node identifiers back to their source positions in the document — essential for IDE features like "go to definition" and symbol tracking.

## How It Works

During lexing, tokens that will generate blank nodes receive a pre-assigned ID stored in `token.payload.blankNodeId`. When the Reader processes the CST, it uses these pre-assigned IDs to create blank nodes with stable identifiers.

## Tokens That Receive IDs

| Token | Syntax | Purpose |
|-------|--------|---------|
| `LBRACKET` | `[` | Anonymous blank nodes |
| `LPARENT` | `(` | Collection heads (RDF lists) |
| `OPEN_REIFIED_TRIPLE` | `<<` | Anonymous reifiers (RDF 1.2) |
| `OPEN_ANNOTATION` | `{\|` | Annotation blank nodes |
| `LCURLY` | `{` | N3 formulas |
| `TILDE` | `~` | N3 quick variables |

## Basic Usage

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

## Custom ID Generator

Provide a custom ID generator function to the lexer:

```typescript
import { TurtleLexer } from '@faubulous/mentor-rdf-parsers';

// Custom format: "node-0", "node-1", etc.
const lexer = new TurtleLexer((counter) => `node-${counter}`);
const lexResult = lexer.tokenize('[] a <http://example.org/Thing> .');

// First blank node token gets ID "node-0"
```

### Generator Function Signature

```typescript
type BlankNodeIdGenerator = (counter: number) => string;
```

The function receives an incrementing counter and should return a unique identifier string.

## Disabling ID Assignment

Pass `null` to disable automatic ID assignment:

```typescript
const lexer = new TurtleLexer(null);
// Tokens will not have blankNodeId in their payload
```

## Use Cases

### IDE "Go to Definition"

Map blank node identifiers in quads back to source positions:

```typescript
import { TurtleLexer, TurtleParser, TurtleReader, getBlankNodeIdFromToken } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  [ ex:name "Alice" ] ex:knows ex:Bob .
`;

const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);
const parser = new TurtleParser();
const cst = parser.parse(lexResult.tokens);
const reader = new TurtleReader();
const quads = reader.visit(cst);

// Build a map from blank node ID to source position
const blankNodePositions = new Map();
for (const token of lexResult.tokens) {
    const id = getBlankNodeIdFromToken(token);
    if (id) {
        blankNodePositions.set(id, {
            line: token.startLine,
            column: token.startColumn,
            offset: token.startOffset
        });
    }
}

// Given a blank node from a quad, find its source position
const subjectId = `_:${quads[0].subject.value}`;
const position = blankNodePositions.get(subjectId);
console.log(`Blank node defined at line ${position.line}, column ${position.column}`);
```

### Consistent Blank Node References

Ensure blank nodes maintain identity across multiple parses:

```typescript
import { TurtleLexer, TurtleParser, TurtleReader } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  [ ex:name "Alice" ; ex:age 30 ] ex:knows ex:Bob .
`;

// Parse multiple times
const parse = () => {
    const lexer = new TurtleLexer();
    const lexResult = lexer.tokenize(input);
    const cst = new TurtleParser().parse(lexResult.tokens);
    return new TurtleReader().visit(cst);
};

const quads1 = parse();
const quads2 = parse();

// Same blank node ID each time
console.log(quads1[0].subject.value); // "_:b0"
console.log(quads2[0].subject.value); // "_:b0"
```

### Collections

Collection tokens also receive pre-assigned IDs:

```typescript
import { TurtleLexer, getBlankNodeIdFromToken } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:Alice ex:friends ( ex:Bob ex:Carol ) .
`;

const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

// Find collection start token
const collectionToken = lexResult.tokens.find(t => t.tokenType.name === 'LPARENT');
console.log(`Collection starts at: ${getBlankNodeIdFromToken(collectionToken)}`);
```
