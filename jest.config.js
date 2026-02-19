export default {
    rootDir: 'src',
    testMatch: [
        '**/?(*.)+(spec|test).(js|mjs|cjs)',
        '!**/node_modules/*'
    ],
    transform: {
        "\\.[jt]sx?$": "babel-jest"
    },
    moduleDirectories: ['node_modules', 'src'],
    moduleFileExtensions: ['js', 'mjs', 'jsx', 'ts', 'tsx', 'json', 'node'],
};