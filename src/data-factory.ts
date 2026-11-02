import { DataFactory } from 'rdf-data-factory';

/**
 * The RDF/JS data factory the readers create their terms with. It is the factory of
 * `rdf-data-factory`, which the RDF/JS stores use as well, so terms read by the parsers compare
 * equal to the terms of a store.
 */
export const RdfDataFactory = new DataFactory();
