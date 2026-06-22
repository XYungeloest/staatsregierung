import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const outputRoot = resolve(process.cwd(), 'dist/client');
const htmlFiles = [];
const problems = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectHtmlFiles(path);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(path);
    }
  }
}

function getLocalPath(href, sourceFile) {
  const path = href.replace(/[?#].*$/u, '');
  if (!path || /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/iu.test(path)) {
    return undefined;
  }

  return path.startsWith('/')
    ? resolve(outputRoot, `.${path}`)
    : resolve(dirname(sourceFile), path);
}

async function validateHtmlFile(file) {
  const html = (await readFile(file, 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/giu)) {
    const href = match[1];
    const path = getLocalPath(href, file);
    if (!path) {
      continue;
    }

    const candidates = [path, `${path}.html`, join(path, 'index.html')];
    if (!(await Promise.all(candidates.map(exists))).some(Boolean)) {
      problems.push(`${relative(outputRoot, file)}: ${href}`);
    }
  }
}

await collectHtmlFiles(outputRoot);
await Promise.all(htmlFiles.map(validateHtmlFile));

if (problems.length > 0) {
  console.error(`Defekte interne Verweise (${problems.length}):\n${problems.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Interne Linkprüfung erfolgreich (${htmlFiles.length} HTML-Dateien).`);
}
