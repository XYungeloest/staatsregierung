#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const CHANGE_SCOPES = ['docs-only', 'portal', 'law', 'shared'];

function isRootDocumentation(path) {
  return /^[^/]+\.md$/u.test(path) || path.startsWith('docs/');
}

function isLawOnly(path) {
  return path.startsWith('apps/recht/')
    || path.startsWith('packages/recht-')
    || path.startsWith('public/assets/recht/')
    || path === 'public/images/social/recht-preview.png';
}

function isPortalOnly(path) {
  return path.startsWith('apps/portal/')
    || path.startsWith('packages/portal-')
    || path.startsWith('content/dashboard/')
    || path.startsWith('content/freistaat/')
    || path.startsWith('content/gesetzgebung/')
    || path.startsWith('content/haushalt/')
    || path.startsWith('content/organisation/')
    || path.startsWith('content/portal/')
    || path.startsWith('content/presse/')
    || path.startsWith('content/regierung/')
    || path.startsWith('content/ressorts/')
    || path.startsWith('content/service/')
    || path.startsWith('content/themen/')
    || path.startsWith('public/data/')
    || (path.startsWith('public/images/')
      && !path.startsWith('public/images/ui/')
      && !path.startsWith('public/images/generated/ui/'));
}

function isShared(path) {
  return path.startsWith('apps/redaktion/')
    || path.startsWith('packages/')
    || path.startsWith('content/normen/')
    || path.startsWith('content/verkuendungen/')
    || path.startsWith('data/recht/')
    || path.startsWith('Gesetze/')
    || path.startsWith('knowledge/')
    || path.startsWith('scripts/')
    || path.startsWith('tests/')
    || path.startsWith('.github/')
    || path.startsWith('public/images/ui/')
    || path.startsWith('public/images/generated/ui/')
    || path === 'public/_headers'
    || path === 'public/favicon.ico'
    || path === 'public/favicon.svg'
    || /^(?:package(?:-lock)?\.json|tsconfig[^/]*|playwright[^/]*)$/u.test(path);
}

const PATH_CLASSIFIERS = [
  [isRootDocumentation, 'docs-only'],
  [isLawOnly, 'law'],
  [isPortalOnly, 'portal'],
  [isShared, 'shared'],
];

export function normalizeChangedPath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//u, '');
}

export function classifyChangedPath(value) {
  const path = normalizeChangedPath(value);
  return PATH_CLASSIFIERS.find(([matches]) => matches(path))?.[1] ?? 'shared';
}

function resultFor(scope, paths) {
  const targets = scope === 'portal' ? ['portal'] : scope === 'law' ? ['law'] : scope === 'shared' ? ['portal', 'law'] : [];
  return {
    scope,
    paths,
    targets,
    deployPortal: targets.includes('portal'),
    deployLaw: targets.includes('law'),
    runUiSmoke: scope !== 'docs-only',
    runFullUiSmoke: scope === 'shared',
  };
}

export function classifyChangeScope(values = []) {
  const paths = values.map(normalizeChangedPath).filter(Boolean);
  if (paths.length === 0) return resultFor('shared', paths);

  const classifications = new Set(paths.map(classifyChangedPath));
  if (classifications.has('shared')) return resultFor('shared', paths);
  if (classifications.has('portal') && classifications.has('law')) return resultFor('shared', paths);
  if (classifications.size === 1 && classifications.has('docs-only')) return resultFor('docs-only', paths);
  if (classifications.has('portal')) return resultFor('portal', paths);
  if (classifications.has('law')) return resultFor('law', paths);
  return resultFor('shared', paths);
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readInput(args) {
  if (args.includes('--manual')) return ['.manual-deploy'];
  if (args.includes('--stdin')) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').split(/\r?\n/u);
  }
  const outputIndex = args.indexOf('--github-output');
  return args.filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    return outputIndex < 0 || index !== outputIndex + 1;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const result = classifyChangeScope(await readInput(args));
  const outputPath = argumentValue(args, '--github-output') ?? process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const lines = [
      `scope=${result.scope}`,
      `deploy_portal=${result.deployPortal}`,
      `deploy_law=${result.deployLaw}`,
      `deploy_targets=${result.targets.join(',')}`,
      `run_ui_smoke=${result.runUiSmoke}`,
      `run_full_ui_smoke=${result.runFullUiSmoke}`,
    ];
    await appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
