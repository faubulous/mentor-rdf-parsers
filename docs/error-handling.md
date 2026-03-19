# Error Handling

All parsers are fault-tolerant and collect errors rather than throwing immediately. This allows you to parse invalid documents and still get a partial CST — essential for IDE use cases where users are actively editing.

## Error Types

There are three categories of errors:

| Type | Source | Examples |
|------|--------|----------|
| **Lexer errors** | Invalid tokens | Malformed IRIs, illegal characters |
| **Parser errors** | Invalid token sequences | Missing period, invalid structure |
| **Semantic errors** | Valid syntax, invalid semantics | Undefined namespace prefixes |

## Accessing Lexer Errors

Lexer errors occur when the input contains invalid tokens:

```typescript
import { TurtleLexer } from '@faubulous/mentor-rdf-parsers';

const input = '<invalid iri> <http://example.org/p> "value" .';

const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

// Check for lexing errors
if (lexResult.errors.length > 0) {
    for (const error of lexResult.errors) {
        console.log(`Lexer error at offset ${error.offset}: ${error.message}`);
    }
}
```

### Lexer Error Properties

```typescript
interface ILexingError {
    offset: number;      // Character offset in input
    line: number;        // Line number (1-based)
    column: number;      // Column number (1-based)
    length: number;      // Length of problematic text
    message: string;     // Human-readable error message
}
```

## Accessing Parser Errors

Parser errors occur when the token sequence doesn't match the grammar:

```typescript
import { TurtleLexer, TurtleParser } from '@faubulous/mentor-rdf-parsers';

const input = `
  @prefix ex: <http://example.org/> .
  ex:Alice ex:knows ex:Bob
  ex:Charlie ex:knows ex:Dave .
`;

const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

const parser = new TurtleParser();

// Parse with throwOnErrors=false to collect errors instead of throwing
const cst = parser.parse(lexResult.tokens, false);

// Check for parsing errors
if (parser.errors.length > 0) {
    for (const error of parser.errors) {
        console.log(`Parser error: ${error.message}`);
        
        // Access token position information
        if (error.token) {
            console.log(`  at line ${error.token.startLine}, column ${error.token.startColumn}`);
        }
    }
}

// CST is still available (partial result)
console.log('CST:', cst);
```

### Parser Error Properties

```typescript
interface IRecognitionException {
    name: string;        // Error type (e.g., 'MismatchedTokenException')
    message: string;     // Human-readable error message
    token: IToken;       // The token where error occurred
    resyncedTokens: IToken[];  // Tokens skipped during recovery
    context: {
        ruleStack: string[];      // Grammar rules being parsed
        ruleOccurrenceStack: number[];
    };
}
```

## Semantic Errors

Semantic errors like undefined namespace prefixes can be collected instead of thrown:

```typescript
import { TurtleLexer, TurtleParser } from '@faubulous/mentor-rdf-parsers';

const input = `foo:subject bar:predicate baz:object .`; // No prefixes defined!

const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

const parser = new TurtleParser();

// Pass false to collect errors instead of throwing
const cst = parser.parse(lexResult.tokens, false);

// Check for semantic errors (like undefined prefixes)
if (parser.semanticErrors.length > 0) {
    for (const error of parser.semanticErrors) {
        console.log(`${error.name}: ${error.message}`);
        console.log(`  at line ${error.token.startLine}, column ${error.token.startColumn}`);
    }
}

// CST is still available (partial result)
console.log('CST:', cst);
```

### Semantic Error Properties

```typescript
interface SemanticError {
    name: string;        // Error type (e.g., 'UndefinedNamespacePrefixError')
    message: string;     // Human-readable error message
    token: IToken;       // The token where error occurred
    ruleStack: number[]; // Grammar rules being parsed when error occurred
}
```

## Strict Mode (Throw on Errors)

By default, `parse()` throws on errors. Use `throwOnErrors=false` to collect errors instead:

```typescript
import { TurtleLexer, TurtleParser, TurtleReader } from '@faubulous/mentor-rdf-parsers';

const input = `@prefix ex: <http://example.org/> .
ex:Alice ex:knows ex:Bob .`;

const lexer = new TurtleLexer();
const lexResult = lexer.tokenize(input);

// Check lexer errors first
if (lexResult.errors.length > 0) {
    throw new Error(`Lexing failed: ${lexResult.errors[0].message}`);
}

try {
    // parse() throws if there are parsing or semantic errors
    const parser = new TurtleParser();
    const cst = parser.parse(lexResult.tokens);
    
    const reader = new TurtleReader();
    const quads = reader.visit(cst);
} catch (error) {
    console.error('Parsing failed:', error.message);
}
```

## Combining All Errors

For complete error reporting, check all three error sources:

```typescript
import { TurtleLexer, TurtleParser } from '@faubulous/mentor-rdf-parsers';

function parseWithDiagnostics(input: string) {
    const lexer = new TurtleLexer();
    const lexResult = lexer.tokenize(input);
    
    const parser = new TurtleParser();
    const cst = parser.parse(lexResult.tokens, false);
    
    const diagnostics = [];
    
    // Lexer errors
    for (const error of lexResult.errors) {
        diagnostics.push({
            severity: 'error',
            line: error.line,
            column: error.column,
            message: error.message,
            source: 'lexer'
        });
    }
    
    // Parser errors
    for (const error of parser.errors) {
        diagnostics.push({
            severity: 'error',
            line: error.token?.startLine,
            column: error.token?.startColumn,
            message: error.message,
            source: 'parser'
        });
    }
    
    // Semantic errors
    for (const error of parser.semanticErrors) {
        diagnostics.push({
            severity: 'error',
            line: error.token.startLine,
            column: error.token.startColumn,
            message: error.message,
            source: 'semantic'
        });
    }
    
    return { cst, diagnostics };
}
```
