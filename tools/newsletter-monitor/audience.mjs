// Keep browser policy in an existing route so an already-running local server
// can serve an updated dashboard without interrupting its current request.
export const AUTO_REFRESH_MS=300000;
export function shouldAutoRefresh({enabled=false,hidden=false,busy=false,lastRefresh=0,now=Date.now()}={}){
 return enabled===true&&!hidden&&!busy&&now-lastRefresh>=AUTO_REFRESH_MS;
}
export function selectPeople(people,{status='active',search='',sort='newest'}={}){
 const query=search.trim().toLocaleLowerCase('ko-KR');
 const rows=people.filter(person=>(status==='all'||person.status===status)&&person.email.toLocaleLowerCase('ko-KR').includes(query));
 const timestamp=value=>value?Date.parse(value):0;
 return rows.sort((a,b)=>{
  const value=person=>sort==='confirmed'?timestamp(person.confirmedAt):sort==='mail'?timestamp(person.mail.recent[0]?.createdAt):timestamp(person.createdAt);
  return (sort==='oldest'?value(a)-value(b):value(b)-value(a))||a.id.localeCompare(b.id);
 });
}
export function pagePeople(rows,page,size=25){
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.max(1,Math.min(page,pages)),offset=(current-1)*size;
 return {rows:rows.slice(offset,offset+size),page:current,pages,total:rows.length,start:rows.length?offset+1:0,end:Math.min(offset+size,rows.length)};
}
export function duration(seconds){
 if(seconds==null)return '기록 없음';
 if(seconds<60)return `${Math.max(0,Math.round(seconds))}초`;
 if(seconds<3600)return `${Math.floor(seconds/60)}분`;
 if(seconds<86400)return `${Math.floor(seconds/3600)}시간 ${Math.floor(seconds%3600/60)}분`;
 return `${Math.floor(seconds/86400)}일 ${Math.floor(seconds%86400/3600)}시간`;
}
