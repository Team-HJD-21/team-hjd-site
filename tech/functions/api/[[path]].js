import { handleSubscription } from '../../src/subscriptions.mjs';
export const onRequest = async ({request,env}) => {
 const result=await handleSubscription(request,env);
 if(!(request.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded') || !(request.headers.get('accept')||'').includes('text/html')) return result;
 const data=await result.json();
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const message=data.message || '화면을 새로 열고 이메일과 필수 동의 항목을 확인해 주세요.';
 return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>구독 안내 · 겜붕이의 노트</title><style>body{max-width:640px;margin:12vh auto;padding:28px;background:#080f17;color:#f3f0e8;font:18px/1.8 system-ui,sans-serif}a{color:#d9eea6}</style></head><body><h1>겜붕이의 노트</h1><p role="status">${escape(message)}</p><p><a href="/subscribe/?refresh=20261103">구독 페이지로 돌아가기</a></p><p><a href="/">글 목록 보기</a></p></body></html>`,{status:result.status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
};
