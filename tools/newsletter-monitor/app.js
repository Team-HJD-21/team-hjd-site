(()=>{'use strict';
const $=id=>document.getElementById(id),num=n=>Number(n||0).toLocaleString('ko-KR'),time=s=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(s));
const purpose={confirm:'구독 인증',issue:'정기 메일',manage:'구독 관리'},states={queued:'API 수락',pending:'처리 확인 필요',uncertain:'응답 확인 필요',rejected:'제공자 거절',quota:'한도 차단',cancelled:'발송 취소'};
let initialized=false,lastGenerated='',lastRefresh=0;
function cell(tr,text,className){const td=document.createElement('td');td.textContent=text;if(className)td.className=className;tr.append(td);return td;}
function render(r){
 $('updated').textContent=time(r.generatedAt);$('active').textContent=num(r.subscribers.active)+'명';$('pending').textContent=num(r.subscribers.pending)+'명';$('forecast').textContent=num(r.subscribers.active)+'통';$('quota').textContent=`${num(r.quota.appUsed)} / ${num(r.quota.appDailyLimit)}통`;$('budget').value=r.quota.appUsed;
 $('quota-detail').textContent=`앱 예산 ${num(r.quota.appRemaining)}통 남음 · 같은 한도 기간의 API 수락 ${num(r.quota.accepted)}통 · 집계 ${time(r.quota.startsAt)} ~ ${time(r.quota.resetsAt)} KST`;
 const risk=r.quota.appUsed>=72||r.subscribers.active>r.quota.appRemaining;
 $('capacity').textContent=risk?'한도 주의':'예산 여유';$('capacity').className='badge '+(risk?'warn':'ok');
 $('capacity-warning').hidden=!risk;$('capacity-warning').textContent=`현재 구독자 ${num(r.subscribers.active)}명과 남은 안전 예산 ${num(r.quota.appRemaining)}통을 확인해 주세요. 인증·관리 메일도 같은 예산을 사용합니다. 한도를 넘는 자동 재발송은 하지 않습니다.`;
 const count=state=>r.summary.filter(x=>x.state===state).reduce((n,x)=>n+x.count,0);
 $('accepted').textContent=num(count('queued'));$('rejected').textContent=num(count('rejected'));$('uncertain').textContent=num(count('pending')+count('uncertain'));$('blocked').textContent=num(count('quota'));
 $('period-title').textContent=`${r.date} 발송 내역 · KST`;$('record-count').textContent=`총 ${num(r.summary.reduce((n,x)=>n+x.count,0))}건`;
 $('mail-rows').replaceChildren();
 if(!r.deliveries.length){const tr=document.createElement('tr');const td=cell(tr,'이 날짜의 발송 기록이 없습니다.','empty');td.colSpan=5;$('mail-rows').append(tr);}
 r.deliveries.forEach((item,index)=>{const tr=document.createElement('tr');cell(tr,time(item.createdAt));cell(tr,purpose[item.purpose]||item.purpose);cell(tr,item.recipient);const status=cell(tr,'');const badge=document.createElement('span');badge.className='badge '+(item.state==='queued'?'ok':'warn');badge.textContent=states[item.state]||item.state;status.append(badge);const detail=cell(tr,'');const title=document.createElement('strong');title.className='record-subject';title.textContent=item.subject||'본문 저장 도입 이전 기록';detail.append(title);if(item.html){const button=document.createElement('button');button.textContent='발송 본문 보기';button.addEventListener('click',()=>{$('mail-frame').src=`/api/preview?index=${index}`;$('preview').showModal();});detail.append(button);}if(item.providerId){const id=document.createElement('div');id.className='record-id';id.textContent=`Resend ID: ${item.providerId}`;detail.append(id);}else{const note=document.createElement('small');note.textContent='제공자 수락 ID 없음';detail.append(note);}$('mail-rows').append(tr);});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.generatedAt)),dates=Array.from({length:7},(_,index)=>new Date(Date.parse(today)-(6-index)*86400000).toISOString().slice(0,10));$('trend-rows').replaceChildren();for(const date of dates){const sum=state=>r.trend.filter(x=>x.date===date&&x.state===state).reduce((n,x)=>n+x.count,0),tr=document.createElement('tr');cell(tr,date);cell(tr,num(sum('queued')));cell(tr,num(sum('pending')+sum('uncertain')+sum('rejected')));cell(tr,num(sum('quota')));$('trend-rows').append(tr);}
}
async function refresh(){lastRefresh=Date.now();$('refresh').disabled=true;try{const response=await fetch('/api/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:$('report-date').value})});if(!response.ok)throw new Error();}catch{$('error').hidden=false;$('error').textContent='조회 요청에 실패했습니다. 로컬 관리 바로가기로 다시 열어 주세요.';}await poll();}
async function poll(){try{const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw new Error();const state=await response.json();if(!initialized){initialized=true;lastRefresh=Date.now();$('report-date').value=state.today;$('report-date').max=state.today;$('report-date').min=new Date(Date.parse(state.today)-29*86400000).toISOString().slice(0,10);setTimeout(refresh,0);}
 $('status').textContent=state.busy?`${state.phase} · 첫 조회는 실행 대기 때문에 잠시 걸릴 수 있습니다.`:state.phase;$('refresh').disabled=state.busy;$('error').hidden=!state.error;if(state.error)$('error').textContent=state.error;
 if(state.runUrl){$('run-link').hidden=false;$('run-link').href=state.runUrl;}
 if(state.report&&state.report.generatedAt!==lastGenerated){lastGenerated=state.report.generatedAt;render(state.report);}
 if(!document.hidden&&!state.busy&&Date.now()-lastRefresh>300000)refresh();
 }catch{$('status').textContent='로컬 관리 서비스 연결을 확인해 주세요.';}
}
$('refresh').addEventListener('click',refresh);$('report-date').addEventListener('change',refresh);$('preview').addEventListener('close',()=>{$('mail-frame').src='about:blank';});setInterval(poll,2000);poll();
})();
