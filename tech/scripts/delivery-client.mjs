// Read-only deployment polling may retry. A delivery POST with an uncertain
// result never retries here; the existing D1 receipts remain the authority.
export const SITE = 'https://tech.teamhjd.com';
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const dateInSeoul = milliseconds => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(milliseconds));

function checkIssueId(issueId) {
  if (typeof issueId !== 'string' || issueId.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(issueId)) {
    throw new Error('Invalid issue ID.');
  }
}

/** Wait for the exact live manifest entry AND its dated article, with a deadline. */
export async function waitForLiveIssue(issueId, {
  expectedDate, expectedArticleUrl, expectedTitle, expectedVersion, fetcher = fetch, clock = Date.now, pause = sleep,
  maxWaitMs = 360000, pollMs = 10000, onProgress = () => {}
} = {}) {
  checkIssueId(issueId);
  const today = dateInSeoul(clock());
  if (expectedDate !== today) throw new Error('Release date is not today in Asia/Seoul. No email sent.');
  if (!Number.isSafeInteger(maxWaitMs) || maxWaitMs < 1 || maxWaitMs > 360000 ||
      !Number.isSafeInteger(pollMs) || pollMs < 1) throw new Error('Invalid deployment wait limits.');
  const deadline = clock() + maxWaitMs; let getRequests = 0;
  for (let attempt = 1; getRequests < 60 && clock() < deadline; attempt++) {
    if (dateInSeoul(clock()) !== expectedDate) throw new Error('The Seoul date changed while waiting. No email sent.');
    try {
      getRequests++;
      const response = await fetcher(`${SITE}/publication.json?release=${clock()}`, {
        headers: { 'Cache-Control': 'no-cache' }, redirect: 'error',
        signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - clock())))
      });
      if (response.ok) {
        const manifest = await response.json();
        const matches = Array.isArray(manifest.issues)
          ? manifest.issues.filter(issue => issue.id === issueId && issue.date === expectedDate) : [];
        if (matches.length === 1) {
          const issue = matches[0];
          if (typeof issue.url !== 'string' || typeof issue.title !== 'string' || !issue.title.trim()) {
            throw new Error('Invalid manifest entry.');
          }
          const address = new URL(issue.url);
          const validPath = new RegExp(`^/${expectedDate}/[a-z0-9]+(?:-[a-z0-9]+)*/$`);
          if (address.origin !== SITE || address.username || address.password ||
              address.search || address.hash || !validPath.test(address.pathname)) {
            throw new Error('Unexpected article address.');
          }
          if ((expectedArticleUrl && address.href !== expectedArticleUrl) || (expectedTitle && issue.title !== expectedTitle) || (expectedVersion && issue.contentVersion!==expectedVersion)) throw new Error('The live issue differs from the validated source.');
          if (clock() >= deadline || getRequests >= 60) break;
          getRequests++;
          const article = await fetcher(address.href, {
            headers: { 'Cache-Control': 'no-cache' }, redirect: 'error',
            signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - clock())))
          });
          let ready = article.ok && (article.headers.get('content-type') || '').includes('text/html');
          if(ready&&expectedVersion)ready=(await article.text()).includes(`<meta name="note-content-version" content="${expectedVersion}">`);
          else await article.body?.cancel();
          if (ready && clock() < deadline && dateInSeoul(clock()) === expectedDate) return issue;
        }
      } else {
        await response.body?.cancel();
      }
    } catch {
      // Retry only these public GETs. Do not print raw errors, URLs or response bodies.
    }
    onProgress({ stage: 'waiting_for_live_issue', issueId, attempt, getRequests });
    const remaining = deadline - clock();
    if (remaining > 0) await pause(Math.min(pollMs, remaining));
  }
  throw new Error('The exact article did not become live before the deadline. No email sent.');
}

const COUNT_FIELDS = ['queued', 'duplicate', 'quota', 'rejected', 'uncertain', 'cancelled', 'remaining', 'unresolved'];
function safeCounts(result, issueId) {
  if (!result || result.issueId !== issueId) throw new Error('Unexpected delivery issue ID.');
  const counts = { issueId };
  for (const field of COUNT_FIELDS) {
    if (!Number.isSafeInteger(result[field]) || result[field] < 0) throw new Error('Invalid delivery counts.');
    counts[field] = result[field];
  }
  return counts;
}

/** This does not receive recipients or mail contents and never resets receipts. */
export async function deliverBatches(issueId, {
  tokenProvider, fetcher = fetch, maxBatches = 16, onResult = () => {},
  expectedDate, contentVersion, clock = Date.now
} = {}) {
  checkIssueId(issueId);
  if (typeof tokenProvider !== 'function' || !Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > 16) {
    throw new Error('Invalid delivery configuration.');
  }
  let acceptedThisRun = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    if (expectedDate !== dateInSeoul(clock())) throw new Error('The Seoul date changed. No further batches sent.');
    const token = await tokenProvider();
    if (typeof token !== 'string' || !token) throw new Error('Missing OIDC token.');
    let response, result;
    try {
      response = await fetcher(`${SITE}/api/internal/deliver`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, ...(contentVersion?{contentVersion}:{}) }), redirect: 'error', signal: AbortSignal.timeout(90000)
      });
      result = await response.json();
    } catch {
      throw new Error('Delivery response is uncertain. No automatic POST retry; preserve receipts and inspect the run/provider records.');
    }
    let counts;
    try { counts = safeCounts(result, issueId); }
    catch { throw new Error(`Invalid delivery result (HTTP ${response.status}). No automatic POST retry.`); }
    onResult(counts); // Only allowlisted aggregate counts; never dump an API response.
    acceptedThisRun += counts.queued;
    if (!response.ok || counts.unresolved || counts.quota || counts.rejected || counts.uncertain) {
      throw new Error(`Delivery needs operator review (HTTP ${response.status}); receipts are preserved.`);
    }
    if (!counts.remaining) return { issueId, acceptedThisRun, remaining: 0, unresolved: 0 };
  }
  throw new Error('Unattempted recipients remain after the bounded batch limit; do not reset receipts.');
}
