# N-Triples
```sh
node src/util/generate-tests.js --manifest src/tree-sitter-ntriples/tests/manifest.ttl -p TestNTriplesPositiveSyntax -n TestNTriplesNegativeSyntax -e .nt
```

# N-Quads
```sh
node src/util/generate-tests.js --manifest src/tree-sitter-nquads/tests/manifest.ttl -p TestNQuadsPositiveSyntax -n TestNQuadsNegativeSyntax -e .nq
```

# Turtle
```sh
node src/util/generate-tests.js --manifest src/tree-sitter-turtle/tests/manifest.ttl -p TestTurtlePositiveSyntax -n TestTurtleNegativeSyntax -e .ttl
```