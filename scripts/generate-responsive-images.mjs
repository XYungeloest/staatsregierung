import { mkdir, readdir } from 'node:fs/promises';
import { extname, join, parse } from 'node:path';

import sharp from 'sharp';

const imageRoot = join(process.cwd(), 'public', 'images');
const outputRoot = join(imageRoot, 'generated');
const groups = [
  { directory: 'regierung', widths: [240, 360, 480] },
  { directory: 'ministerien', widths: [480, 720, 960] },
  { directory: 'jobs', widths: [480, 720, 960, 1280] },
];
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png']);

for (const group of groups) {
  const sourceDirectory = join(imageRoot, group.directory);
  const targetDirectory = join(outputRoot, group.directory);
  await mkdir(targetDirectory, { recursive: true });

  const files = (await readdir(sourceDirectory)).filter((file) =>
    supportedExtensions.has(extname(file).toLocaleLowerCase('de')),
  );

  for (const file of files) {
    const source = join(sourceDirectory, file);
    const basename = parse(file).name;

    for (const width of group.widths) {
      const pipeline = sharp(source).rotate().resize({ width, withoutEnlargement: false });
      await Promise.all([
        pipeline.clone().avif({ quality: 55, effort: 5 }).toFile(join(targetDirectory, `${basename}-${width}.avif`)),
        pipeline.clone().webp({ quality: 74, effort: 5 }).toFile(join(targetDirectory, `${basename}-${width}.webp`)),
        pipeline.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(join(targetDirectory, `${basename}-${width}.jpg`)),
      ]);
    }
  }
}

const socialDirectory = join(imageRoot, 'social');
await mkdir(socialDirectory, { recursive: true });
const socialPreview = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f7f9fc" />
        <stop offset="1" stop-color="#e6eef6" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#background)" />
    <rect width="1200" height="22" fill="#173b6b" />
    <rect x="0" y="22" width="1200" height="8" fill="#2f7d62" />
    <rect x="78" y="90" width="1044" height="450" rx="18" fill="#fff" stroke="#b9c7d6" stroke-width="2" />
    <rect x="78" y="90" width="12" height="450" rx="6" fill="#173b6b" />
    <circle cx="180" cy="190" r="55" fill="#173b6b" />
    <path d="M146 190h68M180 156v68" stroke="#fff" stroke-width="10" stroke-linecap="round" />
    <text x="270" y="175" fill="#173b6b" font-family="Jost, Arial, sans-serif" font-size="34" font-weight="700">FREISTAAT OSTDEUTSCHLAND</text>
    <text x="270" y="220" fill="#45596f" font-family="Jost, Arial, sans-serif" font-size="25">Fiktives Regierungsportal · Politiksimulation</text>
    <text x="145" y="350" fill="#12263d" font-family="Jost, Arial, sans-serif" font-size="58" font-weight="700">Gesetze, Reformen und Services</text>
    <text x="145" y="418" fill="#12263d" font-family="Jost, Arial, sans-serif" font-size="58" font-weight="700">auf einen Blick</text>
    <text x="145" y="485" fill="#2f7d62" font-family="Jost, Arial, sans-serif" font-size="26">freistaat-ostdeutschland.de</text>
  </svg>`;
await sharp(Buffer.from(socialPreview)).png({ compressionLevel: 9 }).toFile(join(socialDirectory, 'portal-preview.png'));

console.log('Responsive Bildvarianten wurden erzeugt.');
