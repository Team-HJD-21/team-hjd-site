export const AUTO_REFRESH_MS=300000;
export function shouldAutoRefresh({enabled=false,hidden=false,busy=false,lastRefresh=0,now=Date.now()}={}){
 return enabled===true&&!hidden&&!busy&&now-lastRefresh>=AUTO_REFRESH_MS;
}
