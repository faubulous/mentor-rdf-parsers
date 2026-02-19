# Mentor RDF Parsers

A set of parsers built using the Chevrotain library.

# Goals:

 - Compliant with W3C Standards and RDF/JS interfaces
    - Clear separation of parsers for N-Triples, N-Quads, Turtle and Trig
 - Focus not on parsing speed but on providing features for IDEs
    - Fault tolerance
    - Separate tokinazition, parsing, reading and formatting steps
    - Fast access to comment tokens for syntax highlighing
 - Provide readers for the Common Syntax Tree objects to transform into RDF/JS Quads
    - Improve performance when loading / interpreting datasets in the IDE
    - No need for separate tokenization and parsing
    - No need to align blank node labels of different libraries

# Why not use Millan or N3?

N3 focuses on performance and is not fault tolerant

Millan does not provide a clear separation for different syntaxes
 - Its all either parsed as Turtle or Trig
 - Algthough N-Triples is a very reduced subset of Turtle
 - No support for N-Quads 
 - No support for N3

# TODO
- Harmonize IRIREF and IRIREF_ABS in CST using a function instead of direct regex pattern
