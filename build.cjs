// build.cjs
// Portable build script for npm package
// Copies all .mjs and .js files from src to dist, excluding test files and tests directories

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

function isIncludedFile(file) {
    return file.endsWith('.mjs') || file.endsWith('.js');
}

function isExcludedFile(file) {
    return (
        file.endsWith('test.mjs') ||
        file.endsWith('test.js') ||
        file.startsWith('generate-')
    );
}

function isExcludedDir(dir) {
    return dir === 'tests';
}

function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            if (isExcludedDir(entry.name)) continue;

            copyRecursive(srcPath, destPath);
        } else if (isIncludedFile(entry.name)) {
            if (isExcludedFile(entry.name)) continue;

            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function cleanDist() {
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
}

cleanDist();
copyRecursive(SRC_DIR, DIST_DIR);
