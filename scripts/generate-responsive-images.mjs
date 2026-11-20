import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const groups = {
  jobs: [480, 720, 960, 1280],
  ministerien: [480, 720, 960],
  regierung: [240, 360, 480],
  ui: [480, 720, 960],
};
const formats = {
  avif: ['avif', { quality: 55, effort: 5 }],
  webp: ['webp', { quality: 74, effort: 5 }],
  jpg: ['jpeg', { quality: 80, mozjpeg: true }],
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Die Encoderparameter und die gebündelte Version bleiben auch für die lesende Prüfung
// eindeutig. Bereits geprüfte Varianten aus früheren Encodern behalten ihre eigenen Hashes.
const toolchain = { sharp: '0.35.5', vips: '8.18.7' };
const imageRecipe = digest(JSON.stringify({ ...toolchain, rotate: true, formats }));

async function atomicWrite(file, bytes) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, bytes);
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

async function fileDigest(file) {
  try {
    return digest(await readFile(file));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function processImages({ imageRoot, manifestPath, source, check }) {
  const manifestText = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const problems = [];
  const originals = new Set();
  let written = 0;

  for (const [group, widths] of Object.entries(groups)) {
    const files = (await readdir(join(imageRoot, group))).filter((file) => /\.(?:jpe?g|png)$/iu.test(file)).sort();
    const names = files.map((file) => parse(file).name.toLowerCase());
    if (new Set(names).size !== names.length) throw new Error('Mehrdeutiger Bildname in ' + group);
    const targetDir = join(imageRoot, 'generated', group);
    const expected = new Set();
    for (const file of files) {
      const key = group + '/' + file;
      originals.add(key);
      if (source && key !== source) continue;
      const bytes = await readFile(join(imageRoot, key));
      const hash = digest(bytes);
      const old = manifest[key];
      const current = old?.source === hash && old.recipe === imageRecipe;
      const variants = {};
      for (const width of widths) {
        for (const [extension, [encoder, options]] of Object.entries(formats)) {
          const suffix = width + '.' + extension;
          const name = parse(file).name + '-' + suffix;
          expected.add(name);
          const target = join(targetDir, name);
          const actual = await fileDigest(target);
          if (current && actual && old.variants?.[suffix] === actual) {
            variants[suffix] = actual;
          } else if (check) {
            problems.push(key + ' → ' + suffix + (actual ? ' veraltet oder verändert' : ' fehlt'));
          } else {
            if (Object.keys(toolchain).some((key) => sharp.versions[key] !== toolchain[key])) {
              throw new Error(`Bilderzeugung benötigt sharp ${toolchain.sharp} mit libvips ${toolchain.vips} (npm ci).`);
            }
            const output = await sharp(bytes).rotate().resize({ width })[encoder](options).toBuffer();
            variants[suffix] = digest(output);
            if (actual !== variants[suffix]) {
              await mkdir(targetDir, { recursive: true });
              await atomicWrite(target, output);
              written++;
            }
          }
        }
      }
      if (!check) manifest[key] = { recipe: imageRecipe, source: hash, variants };
    }
    if (!source) {
      const outputs = await readdir(targetDir).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      for (const name of outputs.sort()) {
        if (/\.(?:avif|webp|jpg)$/iu.test(name) && !expected.has(name)) problems.push('Verwaiste Variante: ' + group + '/' + name);
      }
    }
  }
  if (source && !originals.has(source)) throw new Error('Unbekanntes Original: ' + source);
  for (const key of Object.keys(manifest)) {
    if ((!source || source === key) && !originals.has(key)) {
      if (check) problems.push('Original entfernt: ' + key);
      else delete manifest[key];
    }
  }
  if (!check) {
    const sorted = Object.fromEntries(Object.keys(manifest).sort().map((key) => [key, manifest[key]]));
    const updated = JSON.stringify(sorted, null, 2) + '\n';
    if (manifestText !== updated) await atomicWrite(manifestPath, updated);
  }
  return { problems, written };
}

export async function responsiveImages(options) {
  if (options.check) return processImages(options);
  const lock = options.manifestPath + '.lock';
  await mkdir(lock);
  try {
    return await processImages(options);
  } finally {
    await rm(lock, { recursive: true });
  }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { check: { type: 'boolean' }, source: { type: 'string' } } });
  const result = await responsiveImages({
    imageRoot: join(process.cwd(), 'public/images'), manifestPath: join(process.cwd(), 'data/responsive-images.json'),
    source: values.source, check: values.check,
  });
  if (result.problems.length) {
    console.error(result.problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Bildvarianten geprüft. Geschriebene Bilddateien: ' + result.written);
  }
}
