import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const picomatch = nodeRequire('picomatch');

export default picomatch;
