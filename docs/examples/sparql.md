# SPARQL 1.2 Parsing

Parse [SPARQL 1.2 Query](https://www.w3.org/TR/sparql12-query/) documents with full CST access.

> **Note:** SPARQL parsing produces a CST only. There is no Reader class since SPARQL queries don't produce RDF quads.

## Basic Usage

```typescript
import { SparqlLexer, SparqlParser } from '@faubulous/mentor-rdf-parsers';

const input = 'SELECT ?name WHERE { ?person <http://example.org/name> ?name }';

// Note: Codepoint escapes (\uXXXX, \UXXXXXXXX) are resolved automatically by SparqlLexer
const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## SELECT Queries

```typescript
import { SparqlLexer, SparqlParser } from '@faubulous/mentor-rdf-parsers';

const input = `
  PREFIX ex: <http://example.org/>
  
  SELECT ?name ?age
  WHERE {
    ?person ex:name ?name .
    ?person ex:age ?age .
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## CONSTRUCT Queries

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  CONSTRUCT {
    ?person ex:fullName ?name .
  }
  WHERE {
    ?person ex:firstName ?first .
    ?person ex:lastName ?last .
    BIND(CONCAT(?first, " ", ?last) AS ?name)
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## ASK Queries

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  ASK {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## DESCRIBE Queries

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  DESCRIBE ex:Alice ex:Bob
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## OPTIONAL and FILTER

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  SELECT ?name ?age
  WHERE {
    ?person ex:name ?name .
    OPTIONAL { ?person ex:age ?age }
    FILTER(?age > 18)
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## UNION

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  SELECT ?entity ?name
  WHERE {
    {
      ?entity a ex:Person .
      ?entity ex:name ?name .
    }
    UNION
    {
      ?entity a ex:Organization .
      ?entity ex:title ?name .
    }
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## Subqueries

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  SELECT ?person ?friendCount
  WHERE {
    ?person a ex:Person .
    {
      SELECT ?person (COUNT(?friend) AS ?friendCount)
      WHERE {
        ?person ex:knows ?friend .
      }
      GROUP BY ?person
    }
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## Property Paths

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  SELECT ?ancestor
  WHERE {
    ex:Alice ex:parent+ ?ancestor .
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## SPARQL 1.2 Reified Triples

SPARQL 1.2 supports querying reified triples:

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  SELECT ?who ?said
  WHERE {
    ?who ex:said << ?s ?p ?o >> .
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## UPDATE Operations

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  INSERT DATA {
    ex:Alice ex:knows ex:Bob .
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```

## DELETE/INSERT

```typescript
const input = `
  PREFIX ex: <http://example.org/>
  
  DELETE {
    ?person ex:status "inactive" .
  }
  INSERT {
    ?person ex:status "active" .
  }
  WHERE {
    ?person ex:lastLogin ?date .
    FILTER(?date > "2024-01-01")
  }
`;

const lexResult = new SparqlLexer().tokenize(input);
const cst = new SparqlParser().parse(lexResult.tokens);
```
