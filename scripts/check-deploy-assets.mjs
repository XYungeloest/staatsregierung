import { access, glob, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CLOUDFLARE_ASSET_LIMIT_BYTES = 25 * 1024 * 1024;
export const REPOSITORY_ASSET_BUDGET_BYTES = 24 * 1024 * 1024;

const defaultRoots = ['dist/portal/client', 'dist/law/client'];

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

export async function findOversizedDeployAssets({
  roots = defaultRoots,
  budgetBytes = REPOSITORY_ASSET_BUDGET_BYTES,
} = {}) {
  const oversized = [];
  let checkedFiles = 0;

  for (const root of roots) {
    for await (const file of glob(`${root}/**/*`)) {
      const fileStat = await stat(file);
      if (!fileStat.isFile()) continue;
      checkedFiles += 1;
      if (fileStat.size > budgetBytes) oversized.push({ file, bytes: fileStat.size });
    }
  }

  return { checkedFiles, oversized };
}

export async function findMissingPublicationPdfAssets({
  publicationRoot = resolve(process.cwd(), 'content/verkuendungen'),
  assetRoot = resolve(process.cwd(), 'dist/law/client'),
} = {}) {
  const missing = [];
  let linkedPdfs = 0;
  for await (const file of glob(`${publicationRoot}/*.json`)) {
    const publication = JSON.parse(await readFile(file, 'utf8'));
    if (!publication.pdf) continue;
    linkedPdfs += 1;
    const relative = decodeURIComponent(publication.pdf).replace(/^\/+/, '');
    const asset = join(assetRoot, relative);
    try {
      await access(asset);
    } catch {
      missing.push({ publication: publication.slug, pdf: publication.pdf, asset });
    }
  }
  return { linkedPdfs, missing };
}

async function main() {
  const [result, publicationPdfs] = await Promise.all([
    findOversizedDeployAssets(),
    findMissingPublicationPdfAssets(),
  ]);
  if (result.oversized.length > 0) {
    for (const asset of result.oversized) {
      console.error(
        `${asset.file}: ${formatMiB(asset.bytes)} überschreitet das Repository-Budget von `
        + `${formatMiB(REPOSITORY_ASSET_BUDGET_BYTES)} (Cloudflare-Limit: `
        + `${formatMiB(CLOUDFLARE_ASSET_LIMIT_BYTES)}).`,
      );
    }
    process.exitCode = 1;
    return;
  }
  if (publicationPdfs.missing.length > 0) {
    for (const entry of publicationPdfs.missing) {
      console.error(`${entry.publication}: ${entry.pdf} fehlt im Rechtsportal-Build (${entry.asset})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `${result.checkedFiles} Deployment-Assets geprüft; keine Datei überschreitet `
    + `${formatMiB(REPOSITORY_ASSET_BUDGET_BYTES)}; ${publicationPdfs.linkedPdfs} verknüpfte Original-PDFs vorhanden.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
