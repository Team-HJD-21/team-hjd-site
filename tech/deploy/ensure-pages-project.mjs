import { pathToFileURL } from 'node:url';

export const PROJECT = 'gambungi-notes';
const BRANCH = 'main';

function verifyProject(project) {
  if (!project || project.name !== PROJECT) {
    throw new Error('Cloudflare returned an unexpected project. Deployment stopped.');
  }
  if (project.source != null) {
    throw new Error('gambungi-notes is Git-integrated; this workflow requires a Direct Upload project. No settings were changed.');
  }
  if (project.production_branch !== BRANCH) {
    throw new Error('gambungi-notes must use main as its production branch. No settings were changed.');
  }
  return project;
}

export async function ensureProject({ accountId, apiToken, request = fetch }) {
  if (!/^[a-f0-9]{32}$/i.test(accountId ?? '') || !apiToken?.trim()) {
    throw new Error('Set valid CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN repository secrets.');
  }
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
  async function call(url, method, body) {
    try {
      return await request(url, {
        method, headers, redirect: 'error', signal: AbortSignal.timeout(20_000),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      // Never echo a request, credential, response body, or underlying error.
      throw new Error(`Cloudflare ${method} request failed. No retry was attempted.`);
    }
  }
  async function readProject(response) {
    if (!response.ok) {
      throw new Error(`Cloudflare returned HTTP ${response.status}. Deployment stopped; no retry was attempted.`);
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error('Cloudflare returned invalid JSON. Deployment stopped.'); }
    if (payload.success !== true) {
      throw new Error('Cloudflare did not confirm success. Deployment stopped.');
    }
    return verifyProject(payload.result);
  }
  const existing = await call(`${base}/${PROJECT}`, 'GET');
  if (existing.status !== 404) {
    return { created: false, project: await readProject(existing) };
  }
  const created = await call(base, 'POST', { name: PROJECT, production_branch: BRANCH });
  return { created: true, project: await readProject(created) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await ensureProject({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    });
    console.log(`Pages project ${PROJECT}: ${result.created ? 'created' : 'verified'} (Direct Upload, main).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
