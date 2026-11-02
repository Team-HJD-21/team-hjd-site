// GitHub Actions OIDC only; never print the bearer token or recipient data.
const site='https://tech.teamhjd.com';
const ids=(process.env.ISSUE_IDS||'').split(',').filter(Boolean);
async function oidcToken(){
 const auth=await fetch(`${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${encodeURIComponent(site)}`,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(15000)});
 if(!auth.ok)throw new Error('Actions OIDC unavailable.');
 const {value}=await auth.json();if(!value)throw new Error('Missing OIDC token.');
 console.log(`::add-mask::${value}`);return value;
}
if(process.argv.includes('--check')){
 const token=await oidcToken();
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
 const header=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 const {verifyActionsToken}=await import('../src/subscriptions.mjs');
 console.log(JSON.stringify({oidcDiagnostics:{algorithm:header.alg,audience:claims.aud,repository:claims.repository,subject:claims.sub,ref:claims.ref,workflow:claims.workflow_ref,lifetime:claims.exp-claims.iat,notBeforeDelta:claims.nbf-Date.now()/1000,expiresIn:claims.exp-Date.now()/1000,localVerification:await verifyActionsToken(token)}}));
 const response=await fetch(`${site}/api/internal/check`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
 console.log(JSON.stringify(await response.json()));
 if(!response.ok)throw new Error(`Authenticated connection check failed (${response.status}).`);
 process.exit(0);
}
if(!ids.length) throw new Error('No released issue IDs.');
for(const issueId of ids){
 let live=false;
 for(let attempt=0;attempt<24;attempt++){
  const response=await fetch(`${site}/publication.json?release=${Date.now()}`,{signal:AbortSignal.timeout(15000)});
  if(response.ok && (await response.json()).issues?.some(issue=>issue.id===issueId)){live=true;break;}
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 if(!live)throw new Error('The released issue is not live yet. No email sent.');
 for(let batch=0;batch<10;batch++){
  const value=await oidcToken();
  const response=await fetch(`${site}/api/internal/deliver`,{method:'POST',headers:{Authorization:`Bearer ${value}`,'Content-Type':'application/json'},body:JSON.stringify({issueId}),signal:AbortSignal.timeout(90000)});
  const result=await response.json();
  console.log(JSON.stringify(result)); // Aggregate counts only.
  if(!response.ok)throw new Error(`Email delivery needs attention (${response.status}). Existing receipts are never replayed automatically.`);
  if(!result.remaining)break;
  if(batch===9)throw new Error('Pending recipients exceed this free-plan run capacity.');
 }
}
