// GitHub Actions OIDC only; never print the bearer token or recipient data.
const site='https://tech.teamhjd.com';
const ids=(process.env.ISSUE_IDS||'').split(',').filter(Boolean);
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
  const auth=await fetch(`${process.env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${encodeURIComponent(site)}`,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(15000)});
  if(!auth.ok)throw new Error('Actions OIDC unavailable.');
  const {value}=await auth.json();if(!value)throw new Error('Missing OIDC token.');
  console.log(`::add-mask::${value}`);
  const response=await fetch(`${site}/api/internal/deliver`,{method:'POST',headers:{Authorization:`Bearer ${value}`,'Content-Type':'application/json'},body:JSON.stringify({issueId}),signal:AbortSignal.timeout(90000)});
  const result=await response.json();
  console.log(JSON.stringify(result)); // Aggregate counts only.
  if(!response.ok)throw new Error(`Email delivery needs attention (${response.status}). Existing receipts are never replayed automatically.`);
  if(!result.remaining)break;
  if(batch===9)throw new Error('Pending recipients exceed this free-plan run capacity.');
 }
}
