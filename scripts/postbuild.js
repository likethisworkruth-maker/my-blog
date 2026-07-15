import { renameSync, rmdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateSW } from 'workbox-build';

const src = join(process.cwd(), 'dist', '403', 'index.html');
const dest = join(process.cwd(), 'dist', '403.html');
const dir = join(process.cwd(), 'dist', '403');

if (existsSync(src)) {
    renameSync(src, dest);
    rmdirSync(dir);
    console.log('Moved dist/403/index.html to dist/403.html');
}

const { count, size, warnings } = await generateSW({
    globDirectory: join(process.cwd(), 'dist'),
    globPatterns: ['**/*.{css,js,html,ico,png,svg,woff,woff2,json,xml,webmanifest}'],
    globIgnores: ['sw.js', 'workbox-*.js'],
    swDest: join(process.cwd(), 'dist', 'sw.js'),
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    sourcemap: false,
    inlineWorkboxRuntime: true,
    directoryIndex: 'index.html',
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^gclid$/],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});

for (const warning of warnings) console.warn(warning);
console.log(`Generated dist/sw.js (${count} files, ${Math.round(size / 1024)} KiB precached)`);
