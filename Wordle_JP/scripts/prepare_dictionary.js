import { readFile, writeFile } from 'node:fs/promises';
import { prepareDictionary } from '../server/round-core.js';

// Run once during export, not on a Worker request or isolate startup.
const file = new URL('../server/data/dictionary.json', import.meta.url);
const dictionary = prepareDictionary(JSON.parse(await readFile(file, 'utf8')));
await writeFile(file, JSON.stringify(dictionary) + '\n');
console.log(`Prepared ${Object.values(dictionary).reduce((total, words) => total + words.length, 0).toLocaleString()} unique kana words for Node and Workers.`);
