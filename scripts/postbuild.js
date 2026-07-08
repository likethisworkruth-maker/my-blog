import { renameSync, rmdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const src = join(process.cwd(), 'dist', '403', 'index.html');
const dest = join(process.cwd(), 'dist', '403.html');
const dir = join(process.cwd(), 'dist', '403');

if (existsSync(src)) {
    renameSync(src, dest);
    rmdirSync(dir);
    console.log('Moved dist/403/index.html to dist/403.html');
}
