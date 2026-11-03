import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants,randomUUID} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const exec=promisify(execFile),repo='Team-HJD-21/team-hjd-site';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export const seoulDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function gh(args,binary=false){return (await exec('gh',args,{windowsHide:true,encoding:binary?'buffer':'utf8',maxBuffer:8*1024*1024,timeout:45000})).stdout;}
export function extractReportZip(bytes){
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw new Error('INVALID_ARCHIVE');
 let cursor=bytes.readUInt32LE(eocd+16),count=bytes.readUInt16LE(eocd+10);
 if(count>10)throw new Error('INVALID_ARCHIVE');
 for(let i=0;i<count;i++){
  if(bytes.readUInt32LE(cursor)!==0x02014b50)throw new Error('INVALID_ARCHIVE');
  const method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24),nameLen=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),local=bytes.readUInt32LE(cursor+42);
  const name=bytes.subarray(cursor+46,cursor+46+nameLen).toString('utf8');
  if(name==='monitor-report.json'){
   if(size>5*1024*1024||bytes.readUInt32LE(local)!==0x04034b50)throw new Error('INVALID_ARCHIVE');
   const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
   if(start+compressed>bytes.length)throw new Error('INVALID_ARCHIVE');
   const data=bytes.subarray(start,start+compressed),raw=method===8?inflateRawSync(data,{maxOutputLength:5*1024*1024}):method===0?data:null;
   if(!raw||raw.length!==size)throw new Error('INVALID_ARCHIVE');return JSON.parse(raw.toString('utf8'));
  }
  cursor+=46+nameLen+extra+comment;
 }
 throw new Error('REPORT_MISSING');
}
export function decryptReport(envelope,privateKey,requestId){
 if(envelope.version!==1||envelope.requestId!==requestId)throw new Error('REPORT_MISMATCH');
 const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.key,'base64url'));
 const encrypted=Buffer.from(envelope.ciphertext,'base64url'),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64url'));
 decipher.setAAD(Buffer.from(requestId));decipher.setAuthTag(encrypted.subarray(-16));
 const report=JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]).toString('utf8'));
 if(report.version!==1)throw new Error('REPORT_MISMATCH');return report;
}
export async function fetchSnapshot(date=seoulDate(),progress=()=>{}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw new Error('INVALID_DATE');
 const requestId=randomUUID(),keys=generateKeyPairSync('rsa',{modulusLength:2048});
 const publicKey=Buffer.from(JSON.stringify(keys.publicKey.export({format:'jwk'}))).toString('base64url');
 progress({phase:'GitHub 조회 요청 중'});
 await gh(['workflow','run','monitor-newsletter.yml','--repo',repo,'--ref','main','-f',`request_id=${requestId}`,'-f',`date=${date}`,'-f',`public_key=${publicKey}`]);
 let run;
 for(let attempt=0;attempt<45;attempt++){
  if(!run){const runs=JSON.parse(await gh(['run','list','--repo',repo,'--workflow','monitor-newsletter.yml','--limit','30','--json','databaseId,displayTitle,status,conclusion']));run=runs.find(item=>item.displayTitle===`Newsletter monitor ${requestId}`);}
  if(run){
   progress({phase:'서버에서 암호화된 정보 수집 중',runUrl:`https://github.com/${repo}/actions/runs/${run.databaseId}`});
   const info=JSON.parse(await gh(['api',`repos/${repo}/actions/runs/${run.databaseId}/artifacts`]));
   const artifact=info.artifacts.find(item=>item.name===`newsletter-monitor-${requestId}`&&!item.expired);
   if(artifact){
    progress({phase:'이 PC에서 보고서 복호화 중'});
    const envelope=extractReportZip(await gh(['api',`repos/${repo}/actions/artifacts/${artifact.id}/zip`],true));
    const report=decryptReport(envelope,keys.privateKey,requestId);
    if(report.date!==date)throw new Error('REPORT_MISMATCH');
    return report;
   }
   const current=JSON.parse(await gh(['run','view',String(run.databaseId),'--repo',repo,'--json','status,conclusion']));
   if(current.status==='completed'&&current.conclusion!=='success')throw new Error('MONITOR_WORKFLOW_FAILED');
  }
  await pause(4000);
 }
 throw new Error('MONITOR_TIMEOUT');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await fetchSnapshot(process.argv[2]||seoulDate());
 console.log(JSON.stringify({date:result.date,subscribers:result.subscribers,quota:result.quota,records:result.deliveries.length}));
}
