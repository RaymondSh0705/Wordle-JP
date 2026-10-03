import dictionary from '../server/data/dictionary.json' with { type: 'json' };
import { createWorker } from './handler.js';

// Wrangler bundles this generated dictionary; no filesystem access is needed.
export default createWorker(dictionary);
