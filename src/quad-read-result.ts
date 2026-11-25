import type { Quad } from '@rdfjs/types';
import type { QuadReaderError } from './quad-reader-error.js';

/**
 * What reading a document statement by statement yields: the quads of the statements that read
 * without errors, and the errors of the statements that were skipped.
 */
export interface QuadReadResult {
    /**
     * The quads of the statements that read without errors, in document order.
     */
    quads: Quad[];

    /**
     * The first error of each statement that was skipped, in document order.
     */
    errors: QuadReaderError[];
}
