import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Keep every browser and home-screen icon derived from the same editable mark.
const publicURL = new URL('../public/', import.meta.url);
const svg = await readFile(new URL('favicon.svg', publicURL), 'utf8');
const squareSvg = svg.replace('rx="112"', 'rx="0"');

for (const [name, size, square] of [
  ['apple-touch-icon.png', 180, true],
  ['pwa-192x192.png', 192, false],
  ['pwa-512x512.png', 512, false],
  ['pwa-maskable-512x512.png', 512, true],
]) {
  await sharp(Buffer.from(square ? squareSvg : svg))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, publicURL)));
}

// ICO directory entries can contain PNGs, preserving crisp edges at each size.
const sizes = [16, 32, 48, 64];
const images = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  header.writeUInt8(sizes[index], entry);
  header.writeUInt8(sizes[index], entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL('favicon.ico', publicURL), Buffer.concat([header, ...images]));
console.log('Generated browser, Apple, and PWA icons from public/favicon.svg.');
