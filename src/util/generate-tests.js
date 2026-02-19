import n3 from 'n3';
import fs from 'fs';
import commandLineArgs from 'command-line-args';

const options = [
    { name: 'manifest', alias: 'v', type: String },
    { name: 'extension', alias: 'e', type: String },
    { name: 'positive-type', alias: 'p', type: String },
    { name: 'negative-type', alias: 'n', type: String }
]

const args = commandLineArgs(options);

console.log(`Reading manifest: ${args.manifest}`);

const store = new n3.Store();
const parser = new n3.Parser();
const manifest = fs.readFileSync(args.manifest, 'utf8');

for (let quad of parser.parse(manifest)) {
    store.addQuad(quad);
}

const RDF = {
    type: n3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
};

const RDFS = {
    label: n3.DataFactory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
    comment: n3.DataFactory.namedNode('http://www.w3.org/2000/01/rdf-schema#comment')
}

const RDFT = {
    TestPositiveSyntax: n3.DataFactory.namedNode('http://www.w3.org/ns/rdftest#' + args['positive-type']),
    TestNegativeSyntax: n3.DataFactory.namedNode('http://www.w3.org/ns/rdftest#' + args['negative-type']),
}

const MF = {
    name: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#name'),
    action: n3.DataFactory.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#action'),
}

const tests = [];

for (let quad of store.match(null, RDF.type, RDFT.TestPositiveSyntax)) {
    const name = store.getObjects(quad.subject, MF.name)[0].value;
    const description = store.getObjects(quad.subject, RDFS.comment)[0].value;

    tests.push({
        file: `${name}${args.extension}`,
        description: `+ ${JSON.stringify(description).slice(1, -1).replaceAll("'", "\\'")}`,
        hasError: false
    });
}

for (let quad of store.match(null, RDF.type, RDFT.TestNegativeSyntax)) {
    const name = store.getObjects(quad.subject, MF.name)[0].value;
    const description = store.getObjects(quad.subject, RDFS.comment)[0].value;

    tests.push({
        file: `${name}${args.extension}`,
        description: `- ${JSON.stringify(description).slice(1, -1).replaceAll("'", "\\'")}`,
        hasError: true
    });
}

for(let test of tests.sort((a, b) => a.description.localeCompare(b.description))) {
    console.log(`it('${test.description}', () => {`);

    if(test.hasError) {
        console.log(`    expect(() => parse(getTestData('file://./tests/${test.file}'))).toThrowError();`);
    } else {
        console.log(`    const result = parse(getTestData('file://./tests/${test.file}'));`);
        console.log(`    expect(result.lexResult.errors.length).toEqual(0);`);
    }
    
    console.log(`});`);
    console.log();
}

console.log(`Generated ${tests.length} tests.`);
