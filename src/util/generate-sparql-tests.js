import n3 from 'n3';
import fs from 'fs';

const MF = {
    name: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#name'),
    action: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#action'),
    PositiveSyntaxTest: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#PositiveSyntaxTest'),
    NegativeSyntaxTest: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#NegativeSyntaxTest'),
    PositiveUpdateSyntaxTest: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#PositiveUpdateSyntaxTest'),
    NegativeUpdateSyntaxTest: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#NegativeUpdateSyntaxTest'),
};
const RDF = {
    type: n3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
};

const categories = [
    { dir: 'syntax-triple-terms-positive', label: 'W3C Positive Syntax: Triple Terms' },
    { dir: 'syntax-triple-terms-negative', label: 'W3C Negative Syntax: Triple Terms' },
    { dir: 'syntax', label: 'W3C Negative Syntax: General' },
    { dir: 'version', label: 'W3C Syntax: VERSION Declaration' },
    { dir: 'codepoint-escapes', label: 'W3C Syntax: Codepoint Escapes' },
];

for (const cat of categories) {
    const manifestPath = `src/sparql/tests/w3c/${cat.dir}/manifest.ttl`;
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const store = new n3.Store();
    const parser = new n3.Parser();
    for (const quad of parser.parse(manifest)) {
        store.addQuad(quad);
    }

    const tests = [];

    // Positive syntax tests
    for (const type of [MF.PositiveSyntaxTest, MF.PositiveUpdateSyntaxTest]) {
        for (const quad of store.match(null, RDF.type, type)) {
            const nameQuads = store.getObjects(quad.subject, MF.name);
            const actionQuads = store.getObjects(quad.subject, MF.action);
            if (nameQuads.length === 0 || actionQuads.length === 0) continue;
            const name = nameQuads[0].value;
            const action = actionQuads[0].value;
            // Extract just the filename from the action URI
            const file = action.split('/').pop();
            tests.push({ name, file, positive: true });
        }
    }

    // Negative syntax tests
    for (const type of [MF.NegativeSyntaxTest, MF.NegativeUpdateSyntaxTest]) {
        for (const quad of store.match(null, RDF.type, type)) {
            const nameQuads = store.getObjects(quad.subject, MF.name);
            const actionQuads = store.getObjects(quad.subject, MF.action);
            if (nameQuads.length === 0 || actionQuads.length === 0) continue;
            const name = nameQuads[0].value;
            const action = actionQuads[0].value;
            const file = action.split('/').pop();
            tests.push({ name, file, positive: false });
        }
    }

    tests.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`    // ==========================================`);
    console.log(`    // ${cat.label} (${tests.length} tests)`);
    console.log(`    // ==========================================`);
    console.log();
    
    for (const test of tests) {
        const prefix = test.positive ? '+' : '-';
        const escapedName = test.name.replace(/'/g, "\\'");
        console.log(`    it('${prefix} W3C: ${escapedName}', () => {`);
        if (test.positive) {
            console.log(`        expect(() => parse('file://./tests/w3c/${cat.dir}/${test.file}')).not.toThrowError();`);
        } else {
            console.log(`        expect(() => parse('file://./tests/w3c/${cat.dir}/${test.file}')).toThrowError();`);
        }
        console.log(`    });`);
        console.log();
    }
}
