// Preserve distinct user requests in FIFO order; identical in-flight/queued reads coalesce.
export function createRefreshQueue({run,onChange=()=>{},onError=()=>{}}){
 let current=null;const pending=[],waiters=[];
 const snapshot=()=>({busy:current!==null,current,pending:[...pending]});
 async function drain(){
  while(pending.length){
   current=pending.shift();onChange(snapshot());
   try{await run(current);}catch(error){onError(error,current);}
   current=null;
  }
  onChange(snapshot());for(const done of waiters.splice(0))done();
 }
 return {
  request(date){
   if(date===current||pending.includes(date))return {deduplicated:true,...snapshot()};
   pending.push(date);if(current===null)void drain();else onChange(snapshot());
   return {deduplicated:false,...snapshot()};
  },
  idle(){return current===null&&!pending.length?Promise.resolve():new Promise(done=>waiters.push(done));}
 };
}
