#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/**
 * `scope` remains the compact deployment-facing value used by the workflows.
 * Verification-only changes use `ci-only`; their checks are described by the
 * separate flags below and must never imply a production deployment.
 */
export const CHANGE_SCOPES = ['docs-only', 'ci-only', 'portal', 'law', 'shared'];

const SITE_TARGETS = ['portal', 'law'];

const RUNTIME_BUILD_SCRIPTS = new Set([
  'scripts/prepare-site-public.mjs',
  'scripts/stamp-build.mjs',
  'scripts/lib/build-commit.mjs',
]);

const UI_TEST_SUPPORT_SCRIPTS = new Set([
  'scripts/serve-site.mjs',
  'scripts/lib/site-targets.mjs',
]);

const RELEASE_VALIDATOR_SCRIPTS = new Set([
  'scripts/check-deploy-assets.mjs',
  'scripts/check-links.mjs',
  'scripts/check-seo.mjs',
]);

const CI_ONLY_SCRIPTS = new Set([
  'scripts/classify-change-scope.mjs',
  'scripts/check-deployment.mjs',
]);

function targets(...values) {
  const selected = new Set(values.flat(Infinity));
  return SITE_TARGETS.filter((target) => selected.has(target));
}

function documentationImpact() {
  return {
    documentation: true,
    runtimeTargets: [],
    checkTargets: [],
    buildTargets: [],
    uiTargets: [],
    runContentCheck: false,
    runKnowledgeCheck: false,
    runUnitTests: false,
  };
}

function verificationImpact({
  content = false,
  knowledge = false,
  unit = true,
  build = [],
  ui = [],
} = {}) {
  return {
    documentation: false,
    runtimeTargets: [],
    checkTargets: [],
    buildTargets: targets(build),
    uiTargets: targets(ui),
    runContentCheck: content,
    runKnowledgeCheck: knowledge,
    runUnitTests: unit,
  };
}

function runtimeImpact(runtimeTargets, { content = false } = {}) {
  const selectedTargets = targets(runtimeTargets);
  return {
    documentation: false,
    runtimeTargets: selectedTargets,
    checkTargets: selectedTargets,
    buildTargets: selectedTargets,
    uiTargets: selectedTargets,
    runContentCheck: content,
    runKnowledgeCheck: false,
    runUnitTests: true,
  };
}

function isRootDocumentation(path) {
  return /^[^/]+\.md$/u.test(path) || path.startsWith('docs/');
}

function isKnowledgeDocumentation(path) {
  return path.startsWith('knowledge/')
    && path.endsWith('.md')
    && !path.startsWith('knowledge/generated/');
}

function isLawRuntimePath(path) {
  return path.startsWith('apps/recht/')
    || path.startsWith('packages/recht-')
    || path.startsWith('public/assets/recht/');
}

function isPortalRuntimePath(path) {
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
    || path.startsWith('public/data/');
}

function isSharedRuntimePath(path) {
  return path.startsWith('packages/')
    || path.startsWith('content/normen/')
    || path.startsWith('content/verkuendungen/')
    || RUNTIME_BUILD_SCRIPTS.has(path)
    || path === 'public/_headers'
    || path === 'public/favicon.ico'
    || path === 'public/favicon.svg'
    // These assets are copied into both app-local public directories.
    || path === 'public/images/ui/ost-flagge.png'
    || path === 'public/images/generated/ui/ost-flagge-480.webp'
    || path === 'public/images/social/recht-preview.png'
    || /^(?:package(?:-lock)?\.json|tsconfig[^/]*|astro\.config\.[^/]+)$/u.test(path);
}

function isPortalPublicAsset(path) {
  return path.startsWith('public/');
}

function isContentVerificationPath(path) {
  return path.startsWith('Gesetze/')
    || path.startsWith('data/recht/')
    || path.startsWith('context/')
    || path.startsWith('knowledge/');
}

function isUiSmokeSpec(path) {
  return path === 'tests/accessibility.spec.ts' || path === 'tests/browser-smoke.spec.ts';
}

function isCiOnlyRootPath(path) {
  return path === '.editorconfig'
    || path === '.gitattributes'
    || path === '.gitignore'
    || path === '.npmrc'
    || /^playwright[^/]*\.[^/]+$/u.test(path);
}

function scriptImpact(path) {
  if (RUNTIME_BUILD_SCRIPTS.has(path)) return runtimeImpact(SITE_TARGETS);
  if (UI_TEST_SUPPORT_SCRIPTS.has(path)) {
    return verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS });
  }
  if (RELEASE_VALIDATOR_SCRIPTS.has(path)) {
    // Link-, SEO- and asset validators need generated output, but changing one
    // of them must not publish an otherwise unchanged site.
    return verificationImpact({ build: SITE_TARGETS });
  }
  if (CI_ONLY_SCRIPTS.has(path)) return verificationImpact();

  // Importers, generators, audits and content validators are deliberately
  // verification-only. Their generated canonical files determine deployment
  // impact when they are changed in the same commit.
  return verificationImpact({ content: true });
}

function pathImpact(path) {
  if (isRootDocumentation(path) || isKnowledgeDocumentation(path)) {
    return documentationImpact();
  }

  if (isLawRuntimePath(path)) return runtimeImpact(['law']);
  if (isPortalRuntimePath(path)) return runtimeImpact(['portal'], { content: path.startsWith('content/') });
  if (isSharedRuntimePath(path)) {
    return runtimeImpact(SITE_TARGETS, { content: path.startsWith('content/') });
  }

  if (isPortalPublicAsset(path)) return runtimeImpact(['portal']);

  if (path.startsWith('tests/')) {
    return isUiSmokeSpec(path)
      ? verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS })
      : verificationImpact();
  }

  if (path.startsWith('scripts/')) return scriptImpact(path);

  if (path.startsWith('.github/')) return verificationImpact();
  if (isCiOnlyRootPath(path)) {
    return /^playwright[^/]*\.[^/]+$/u.test(path)
      ? verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS })
      : verificationImpact();
  }

  if (path.startsWith('knowledge/')) {
    return verificationImpact({ content: true, knowledge: true });
  }
  if (isContentVerificationPath(path)) return verificationImpact({ content: true });

  if (path.startsWith('temp-neu/')) return verificationImpact();

  // An unrecognised path may still be picked up by a runtime import or build
  // configuration. Keep the fallback conservative rather than dropping it.
  return runtimeImpact(SITE_TARGETS, { content: true });
}

function scopeForTargets(runtimeTargets, documentation = false) {
  if (runtimeTargets.length === 2) return 'shared';
  if (runtimeTargets[0] === 'portal') return 'portal';
  if (runtimeTargets[0] === 'law') return 'law';
  return documentation ? 'docs-only' : 'ci-only';
}

function resultFor(impacts, paths) {
  const runtimeTargets = targets(impacts.map((impact) => impact.runtimeTargets));
  const checkTargets = targets(impacts.map((impact) => impact.checkTargets));
  const buildTargets = targets(impacts.map((impact) => impact.buildTargets));
  const uiTargets = targets(impacts.map((impact) => impact.uiTargets));
  const documentationOnly = impacts.length > 0 && impacts.every((impact) => impact.documentation);
  const scope = scopeForTargets(runtimeTargets, documentationOnly);

  return {
    scope,
    paths,
    // `targets` is retained for callers of the original helper.
    targets: runtimeTargets,
    deployTargets: runtimeTargets,
    buildTargets,
    uiTargets,
    deployPortal: runtimeTargets.includes('portal'),
    deployLaw: runtimeTargets.includes('law'),
    checkPortal: checkTargets.includes('portal'),
    checkLaw: checkTargets.includes('law'),
    runContentCheck: impacts.some((impact) => impact.runContentCheck),
    runKnowledgeCheck: impacts.some((impact) => impact.runKnowledgeCheck),
    runUnitTests: impacts.some((impact) => impact.runUnitTests),
    runUiSmoke: uiTargets.length > 0,
    runFullUiSmoke: uiTargets.length === SITE_TARGETS.length,
  };
}

export function normalizeChangedPath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//u, '');
}

export function classifyChangedPath(value) {
  const path = normalizeChangedPath(value);
  const impact = pathImpact(path);
  return scopeForTargets(impact.runtimeTargets, impact.documentation);
}

export function classifyChangeScope(values = []) {
  const paths = values.map(normalizeChangedPath).filter(Boolean);
  if (paths.length === 0) return resultFor([runtimeImpact(SITE_TARGETS, { content: true })], paths);
  return resultFor(paths.map(pathImpact), paths);
}

export function classifyManualDeploy(target = 'both') {
  const runtimeTargets = target === 'portal'
    ? ['portal']
    : target === 'law'
      ? ['law']
      : target === 'both'
        ? SITE_TARGETS
        : null;
  if (!runtimeTargets) {
    throw new Error('Manuelles Ziel muss portal, law oder both sein.');
  }
  // A manual deployment remains a normal release: content, type and browser
  // checks still run for exactly the selected target(s).
  return resultFor([runtimeImpact(runtimeTargets, { content: true })], []);
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readInput(args) {
  if (args.includes('--stdin')) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').split(/\r?\n/u);
  }
  const outputIndex = args.indexOf('--github-output');
  const manualTargetIndex = args.indexOf('--manual-target');
  return args.filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    return (outputIndex < 0 || index !== outputIndex + 1)
      && (manualTargetIndex < 0 || index !== manualTargetIndex + 1);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const manualTarget = argumentValue(args, '--manual-target') ?? (args.includes('--manual') ? 'both' : undefined);
  const result = manualTarget
    ? classifyManualDeploy(manualTarget)
    : classifyChangeScope(await readInput(args));
  const outputPath = argumentValue(args, '--github-output') ?? process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const lines = [
      `scope=${result.scope}`,
      `deploy_portal=${result.deployPortal}`,
      `deploy_law=${result.deployLaw}`,
      `deploy_targets=${result.deployTargets.join(',')}`,
      `check_portal=${result.checkPortal}`,
      `check_law=${result.checkLaw}`,
      `build_targets=${result.buildTargets.join(',')}`,
      `ui_targets=${result.uiTargets.join(',')}`,
      `run_content_check=${result.runContentCheck}`,
      `run_knowledge_check=${result.runKnowledgeCheck}`,
      `run_unit_tests=${result.runUnitTests}`,
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
