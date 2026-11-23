import {createHash,timingSafeEqual} from 'node:crypto';
const TTL=30*86400;
const uuid=/^[a-f0-9-]{36}$/i,token=/^[A-Za-z0-9_-]{43}$/;
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function redisStore(url,secret){
  async function cmd(...args){const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Relay storage unavailable');const data=await r.json();if(data.error)throw new Error('Relay storage unavailable');return data.result;}
  const key=id=>'easyfin:inbox:'+id;
  return {
    async limit(ip){const n=await cmd('EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",1,'easyfin:inbox:rate:'+hash(ip));return n<=120;},
    create:(id,meta)=>cmd('SET',key(id)+':meta',JSON.stringify(meta),'EX',TTL,'NX'),
    async get(id){const v=await cmd('GET',key(id)+':meta');return v?JSON.parse(v):null;},
    push:(id,envelope)=>cmd('EVAL',"if redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 1 end;if redis.call('HLEN',KEYS[1])>=200 then return 0 end;redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]);redis.call('EXPIRE',KEYS[1],ARGV[3]);return 1",1,key(id)+':queue',envelope.id,JSON.stringify(envelope),TTL),
    async pull(id){const values=await cmd('HGETALL',key(id)+':queue');const items=[];for(let i=1;i<(values||[]).length;i+=2)items.push(JSON.parse(values[i]));return items;},
    ack:(id,ids)=>cmd('HDEL',key(id)+':queue',...ids),
    revoke:id=>cmd('DEL',key(id)+':meta',key(id)+':queue')
  };
}
export function makeInboxHandler({store=null,now=()=>Date.now()}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    if(req.method==='GET')return res.status(200).json({configured:!!store,retentionDays:30});
    if(req.method!=='POST')return res.status(405).json({error:'POST required'});
    if(!store)return res.status(503).json({error:'Encrypted inbox is not configured on this deployment'});
    try{
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail(403,'Same-origin requests only');
      if(!await store.limit(String(req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown')))fail(429,'Too many requests. Retry shortly.');
      const b=req.body;
      if(!b||typeof b!=='object'||JSON.stringify(b).length>16000||!uuid.test(b.pairId||''))fail(400,'Invalid request');
      const {pairId,action}=b;
      if(action==='create'){
        if(!/^[a-f0-9]{64}$/.test(b.readHash||'')||!/^[a-f0-9]{64}$/.test(b.writeHash||''))fail(400,'Invalid pairing');
        const expiresAt=now()+TTL*1000;
        if(!await store.create(pairId,{readHash:b.readHash,writeHash:b.writeHash,expiresAt}))fail(409,'Pairing already exists');
        return res.status(201).json({expiresAt});
      }
      const meta=await store.get(pairId);if(!meta||meta.expiresAt<=now())fail(410,'Connection expired or revoked. Pair again from the main app.');
      const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
      if(!token.test(supplied))fail(401,'Invalid connection');
      const expected=action==='push'?meta.writeHash:meta.readHash;
      if(!timingSafeEqual(Buffer.from(hash(supplied),'hex'),Buffer.from(expected,'hex')))fail(401,'Invalid connection');
      if(action==='push'){
        const e=b.envelope;
        if(!e||Object.keys(e).sort().join(',')!=='ciphertext,id,iv,v'||e.v!==1||!uuid.test(e.id||'')||!/^[A-Za-z0-9_-]{16}$/.test(e.iv||'')||typeof e.ciphertext!=='string'||e.ciphertext.length<22||e.ciphertext.length>12000||!/^[A-Za-z0-9_-]+$/.test(e.ciphertext))fail(400,'Invalid encrypted envelope');
        if(!await store.push(pairId,e))fail(409,'Inbox is full. Open the Home Screen app to import pending expenses.');
        return res.status(200).json({queued:true});
      }
      if(action==='pull')return res.status(200).json({envelopes:await store.pull(pairId)});
      if(action==='ack'){
        if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>200||!b.ids.every(x=>typeof x==='string'&&uuid.test(x)))fail(400,'Invalid receipt');
        await store.ack(pairId,b.ids);return res.status(200).json({acknowledged:true});
      }
      if(action==='revoke'){await store.revoke(pairId);return res.status(200).json({revoked:true});}
      fail(400,'Unknown action');
    }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Relay unavailable. Local records have not been deleted.'});}
  };
}
