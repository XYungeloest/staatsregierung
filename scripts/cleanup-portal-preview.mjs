const marker = '<!-- ostrecht-cloudflare-preview -->';
const idPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;

export function previewComment(comments) {
  return comments.find((entry) => entry.user?.login === 'github-actions[bot]' && entry.body?.startsWith(marker));
}

export function trackedVersions(body) {
  const line = body?.split('\n').find((value) => value.startsWith('<!-- cloudflare-versions:'));
  if (!line) return [];
  const match = /^<!-- cloudflare-versions:([^ ]+) -->$/u.exec(line);
  const ids = match?.[1].split(',') ?? [];
  if (!ids.length || ids.some((id) => !idPattern.test(id))) throw new Error('Ungültige Versionskennung im Vorschaukommentar.');
  return [...new Set(ids)];
}

function requireSuccess(response) {
  if (response.ok && response.body?.success === true) return response.body.result;
  const errors = response.body?.errors?.map(({ code, message }) => `${code} ${message}`).join(', ');
  throw new Error(`Cloudflare HTTP ${response.status}: ${errors || 'ungültige API-Antwort'}`);
}

function isMissingVersion(response) {
  return response.status === 404 && response.body?.success === false
    && response.body.errors?.some(({ message }) =>
      /version.*(?:not found|does not exist)|(?:not found|no such|could not find).*version/iu.test(String(message).replace(/[_-]/gu, ' ')));
}

function isActive(id, response) {
  const latest = requireSuccess(response)?.deployments?.[0];
  if (!Array.isArray(latest?.versions) || !latest.versions.length || latest.versions.some((v) => !idPattern.test(v.version_id))) {
    throw new Error('Aktive Portalversionen nicht eindeutig ermittelbar.');
  }
  return latest.versions.some((version) => version.version_id === id);
}

export async function cleanupVersions(ids, number, request) {
  if (!Number.isSafeInteger(number) || number < 1 || ids.some((id) => !idPattern.test(id))) {
    throw new Error('Ungültiger Pull Request oder ungültige Versionskennung.');
  }
  const alias = `pr-${number}`;
  const results = [];
  for (const id of ids) {
    try {
      if (isActive(id, await request('GET', 'scripts/ostrecht-portal/deployments'))) {
        results.push({ id, status: 'active' });
        continue;
      }
      const path = `scripts/ostrecht-portal/versions/${id}`;
      const version = await request('GET', path);
      if (isMissingVersion(version)) {
        results.push({ id, status: 'missing' });
        continue;
      }
      const details = requireSuccess(version);
      const tag = details?.annotations?.['workers/tag'];
      const versionAlias = details?.annotations?.['workers/alias'];
      // Alte Uploads hatten nur den Alias. Bei älteren API-Antworten belegen Bot-Kommentar,
      // Versions-ID und die im Upload gesetzte APP_ENV-Bindung gemeinsam die Vorschau.
      const legacy = details?.resources?.bindings?.some((binding) =>
        binding.name === 'APP_ENV' && binding.type === 'plain_text' && binding.text === 'preview');
      if (details?.id !== id || (tag && tag !== alias) || (versionAlias && versionAlias !== alias)
        || !(tag === alias || versionAlias === alias || legacy)) {
        throw new Error(`Version ist nicht als Vorschau dieses Pull Requests ausgewiesen.`);
      }
      const deletion = await request('DELETE', `workers/ostrecht-portal/versions/${id}`);
      if (deletion.status === 409 && deletion.body?.errors?.some((e) => e.code === 10339)) {
        results.push({ id, status: 'latest' });
      } else if (deletion.status === 409 && isActive(id, await request('GET', 'scripts/ostrecht-portal/deployments'))) {
        results.push({ id, status: 'active' });
      } else if (isMissingVersion(deletion)) {
        results.push({ id, status: 'missing' });
      } else {
        requireSuccess(deletion);
        results.push({ id, status: 'removed' });
      }
    } catch (error) {
      results.push({ id, status: 'error', message: error.message });
    }
  }
  return results;
}

export function cleanupComment(results) {
  const retained = results.filter(({ status }) => ['active', 'latest', 'error'].includes(status));
  if (!retained.length) return `${marker}\nDie vermerkten Cloudflare-Vorschauversionen sind entfernt oder bereits abgelaufen.`;
  const labels = { active: 'im aktiven Deployment geschützt', latest: 'als neueste Version geschützt', error: 'Bereinigung fehlgeschlagen' };
  return [marker, `<!-- cloudflare-versions:${retained.map(({ id }) => id).join(',')} -->`,
    'Cloudflare-Vorschau nach dem Schließen des Pull Requests teilweise oder vollständig erhalten.',
    ...retained.map(({ id, status }) => `- \`${id}\` — ${labels[status]}`)].join('\n');
}

export async function runPreviewCleanup({ github, context, core, number }) {
  const { owner, repo } = context.repo;
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  if (pr.state !== 'closed' || pr.base.ref !== 'main' || pr.base.repo.full_name !== `${owner}/${repo}`) {
    throw new Error('Die Bereinigung erfordert einen geschlossenen Pull Request auf main in diesem Repository.');
  }
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: number });
  const comment = previewComment(comments);
  const ids = trackedVersions(comment?.body);
  if (!ids.length) return core.notice('Keine vorgemerkten Vorschauversionen.');
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error('Cloudflare-Kontokennung oder API-Token fehlt.');
  const request = async (method, path) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/${path}`, {
      method, headers: { Authorization: `Bearer ${token}` }, redirect: 'error',
    });
    return { ok: response.ok, status: response.status, body: await response.json() };
  };
  const results = await cleanupVersions(ids, number, request);
  for (const result of results) core.info(`${result.id}: ${result.status}${result.message ? ` – ${result.message}` : ''}`);
  await github.rest.issues.updateComment({ owner, repo, comment_id: comment.id, body: cleanupComment(results) });
  if (results.some((entry) => entry.status === 'error')) core.setFailed('Cloudflare-Vorschau nicht vollständig geprüft oder bereinigt.');
}
