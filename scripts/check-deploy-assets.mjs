import { glob, stat } from 'node:fs/promises';
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

async function main() {
  const result = await findOversizedDeployAssets();
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

  console.log(
    `${result.checkedFiles} Deployment-Assets geprüft; keine Datei überschreitet `
    + `${formatMiB(REPOSITORY_ASSET_BUDGET_BYTES)}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
