const {test,expect}=require('@playwright/test');
const path=require('path');const {pathToFileURL}=require('url');
async function makeRelay(){
  const {makeInboxHandler}=await import(pathToFileURL(path.resolve('server/inbox.mjs')).href);
  const pairs=new Map(),queues=new Map(),requests=[];let online=true,failAck=false;
  const store={limit:async()=>true,create:async(id,m)=>{if(pairs.has(id))return null;pairs.set(id,m);return 'OK';},get:async id=>pairs.get(id),push:async(id,e)=>{const q=queues.get(id)||new Map();if(!q.has(e.id))q.set(e.id,e);queues.set(id,q);return 1;},pull:async id=>[...(queues.get(id)||new Map()).values()],ack:async(id,ids)=>{if(failAck)throw new Error('Controlled ACK failure');ids.forEach(x=>queues.get(id)?.delete(x));},revoke:async id=>{pairs.delete(id);queues.delete(id);}};
  const handler=makeInboxHandler({store});
  return {requests,queues,setOnline:v=>online=v,setFailAck:v=>failAck=v,attach:async context=>context.route('**/api/inbox',async route=>{
    if(!online)return route.abort('internetdisconnected');const request=route.request();let body;try{body=request.postDataJSON();}catch{}
    if(body)requests.push(body);let status=200,result;const res={setHeader:()=>{},status:n=>{status=n;return res;},json:v=>result=v};
    await handler({method:request.method(),headers:await request.allHeaders(),body},res);await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  })};
}
async function setup(browser,baseURL){
  const relay=await makeRelay(),main=await browser.newContext(),safari=await browser.newContext();await relay.attach(main);await relay.attach(safari);
  await main.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedInboxLink=text;}}});});
  const receiver=await main.newPage();await receiver.goto(baseURL+'/?action=quick-add');await receiver.locator('#quickClose').click();await receiver.locator('#dockSettings').click();await receiver.locator('#setInbox').click();await receiver.locator('#createInbox').click();await expect(receiver.locator('#copyInboxLink')).toBeVisible();await receiver.locator('#copyInboxLink').click();
  const link=await receiver.evaluate(()=>window.copiedInboxLink),sender=await safari.newPage();await sender.goto(link);await expect(sender.locator('#acceptInbox')).toBeVisible();expect(new URL(sender.url()).hash).toBe('');
  expect(await sender.evaluate(()=>DB.setting('quickAddInbox'))).toBeUndefined();await sender.locator('#acceptInbox').click();await expect(sender.locator('#overlay')).toBeHidden();
  return {relay,main,safari,receiver,sender,link};
}
async function add(page,description='coffee',amount='123'){await page.locator('#qaAmount').fill(amount);await page.locator('#qaDesc').fill(description);await expect(page.locator('#qaSlide')).toHaveAttribute('aria-disabled','false');await page.locator('#qaSlide').focus();for(let i=0;i<10;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('#qaAmount')).toHaveValue('');}
const count=page=>page.evaluate(()=>DB.all('expenses').then(e=>e.length));
test('two isolated databases connect only after consent; encrypted delivery imports once',async({browser,baseURL})=>{
  const f=await setup(browser,baseURL);try{
    await f.receiver.evaluate(()=>DB.add('expenses',{id:'existing',amount:50,description:'Private original',category:'food',date:new Date().toISOString(),month:monthKey(new Date())}));
    await add(f.sender);await expect.poll(()=>f.relay.requests.filter(r=>r.action==='push').length).toBe(1);await f.sender.evaluate(()=>Inbox.run());
    expect(await count(f.sender)).toBe(1);expect(await count(f.receiver)).toBe(1);expect(JSON.stringify(f.relay.requests)).not.toContain('coffee');expect(JSON.stringify(f.relay.requests)).not.toContain('Private original');
    await f.receiver.evaluate(()=>Inbox.run());expect(await count(f.receiver)).toBe(2);await f.receiver.locator('#sheet .close-x').click();await f.receiver.locator('[data-view="dashboard"]').click();await expect(f.receiver.locator('#dashExpenses')).toHaveText('₹173');
    const pushed=f.relay.requests.find(r=>r.action==='push');await f.sender.evaluate(async b=>{const c=await DB.setting('quickAddInbox');await fetch('/api/inbox',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.writeToken},body:JSON.stringify(b)});},pushed);
    await f.receiver.evaluate(()=>Inbox.run());expect(await count(f.receiver)).toBe(2);await f.receiver.reload();expect(await count(f.receiver)).toBe(2);
  }finally{await f.main.close();await f.safari.close();}
});
test('relay failure keeps an offline-safe local expense/outbox and retries after reopening',async({browser,baseURL})=>{
  const f=await setup(browser,baseURL);try{f.relay.setOnline(false);await add(f.sender);await f.sender.evaluate(()=>Inbox.run());expect(await count(f.sender)).toBe(1);expect(await f.sender.evaluate(()=>DB.all('quickAddOutbox').then(x=>x.length))).toBe(1);expect(await count(f.receiver)).toBe(0);
    await f.sender.reload();await expect(f.sender.locator('#quickTitle')).toBeVisible();expect(await count(f.sender)).toBe(1);f.relay.setOnline(true);await f.sender.evaluate(()=>Inbox.run());expect(await f.sender.evaluate(()=>DB.all('quickAddOutbox').then(x=>x.length))).toBe(0);await f.receiver.evaluate(()=>Inbox.run());expect(await count(f.receiver)).toBe(1);
  }finally{await f.main.close();await f.safari.close();}
});
test('ACK failure after commit cannot duplicate import or subscription payment',async({browser,baseURL})=>{
  const f=await setup(browser,baseURL);try{
    await f.receiver.evaluate(()=>DB.add('subscriptions',{id:'sub',name:'Netflix',amount:123,billingDay:1,nextBillingDate:monthKey(new Date())+'-01',status:'active'}));
    await add(f.sender,'Netflix');await f.sender.evaluate(()=>Inbox.run());f.relay.setFailAck(true);await f.receiver.evaluate(()=>Inbox.run());expect(await count(f.receiver)).toBe(1);expect(await f.receiver.evaluate(()=>DB.all('subscriptionPayments').then(x=>x.length))).toBe(1);
    f.relay.setFailAck(false);await f.receiver.evaluate(()=>Inbox.run());expect(await count(f.receiver)).toBe(1);expect(await f.receiver.evaluate(()=>DB.all('subscriptionPayments').then(x=>x.length))).toBe(1);
  }finally{await f.main.close();await f.safari.close();}
});
test('tampered ciphertext is never imported or acknowledged; existing records untouched',async({browser,baseURL})=>{
  const f=await setup(browser,baseURL);try{await add(f.sender);await f.sender.evaluate(()=>Inbox.run());const queue=[...f.relay.queues.values()][0],entry=[...queue.values()][0];entry.ciphertext=(entry.ciphertext[0]==='A'?'B':'A')+entry.ciphertext.slice(1);const before=f.relay.requests.filter(r=>r.action==='ack').length;await f.receiver.evaluate(()=>Inbox.run());expect(await count(f.receiver)).toBe(0);expect(f.relay.requests.filter(r=>r.action==='ack').length).toBe(before);expect(queue.size).toBe(1);await expect(f.receiver.locator('#inboxConnectionStatus')).toContainText('could not be imported');
  }finally{await f.main.close();await f.safari.close();}
});
test('explicit recovery queues existing expenses only, preview is not a send',async({browser,baseURL})=>{
  const f=await setup(browser,baseURL);try{
    await f.sender.evaluate(async()=>{await DB.add('expenses',{id:'old-safari',amount:50,description:'Old coffee',category:'food',date:new Date().toISOString(),month:monthKey(new Date())});await Inbox.settings();});await f.sender.locator('#recoverSafari').click();expect(f.relay.requests.filter(r=>r.action==='push').length).toBe(0);await f.sender.locator('#sendExisting').click();await expect.poll(()=>f.relay.requests.filter(r=>r.action==='push').length).toBe(1);await f.receiver.evaluate(()=>Inbox.run());expect(await count(f.receiver)).toBe(1);expect(await count(f.sender)).toBe(1);
  }finally{await f.main.close();await f.safari.close();}
});
test('backups exclude connection secrets and refuse restoring injected pairing',async({browser,baseURL})=>{
  const f=await setup(browser,baseURL);try{await f.receiver.locator('#sheet .close-x').click();await f.receiver.locator('#dockSettings').click();const download=f.receiver.waitForEvent('download');await f.receiver.locator('#setExport').click();const file=await download,data=JSON.parse(require('fs').readFileSync(await file.path(),'utf8'));expect(data.settings.some(x=>x.key==='quickAddInbox')).toBe(false);const c=await f.receiver.evaluate(()=>DB.setting('quickAddInbox'));expect(JSON.stringify(data)).not.toContain(c.encryptionKey);expect(await f.receiver.evaluate(d=>{try{validateBackup({...d,settings:[{key:'quickAddInbox',value:{}}]});return false;}catch{return true;}},data)).toBe(true);
  }finally{await f.main.close();await f.safari.close();}
});
test('unconfigured relay offers no fake connection or copy-link success',async({page})=>{
  await page.route('**/api/inbox',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({configured:false})}));await page.goto('/?action=quick-add');await page.locator('#quickClose').click();await page.locator('#dockSettings').click();await page.locator('#setInbox').click();await expect(page.locator('#inboxConnectionStatus')).toContainText('Not available yet');await expect(page.locator('#createInbox')).toHaveCount(0);
});
test('v1 database upgrades without losing expenses or clients',async({page,baseURL})=>{
  await page.goto(baseURL+'/manifest.json');await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('easyfin',1);r.onupgradeneeded=()=>{for(const name of ['expenses','income','clients','subscriptions','subscriptionPayments'])r.result.createObjectStore(name,{keyPath:'id'});r.result.createObjectStore('settings',{keyPath:'key'});r.result.createObjectStore('categoryKeywords',{keyPath:'keyword'});};r.onsuccess=()=>{const db=r.result,t=db.transaction(['expenses','clients'],'readwrite');t.objectStore('expenses').add({id:'keep',amount:42,description:'Original',category:'food',date:new Date().toISOString(),month:new Date().toISOString().slice(0,7)});t.objectStore('clients').add({id:'keep-client',name:'Original client'});t.oncomplete=()=>{db.close();resolve();};};r.onerror=()=>reject(r.error);}));await page.goto('/?action=quick-add');await expect(page.locator('#quickTitle')).toBeVisible();expect(await count(page)).toBe(1);expect(await page.evaluate(()=>DB.all('clients').then(x=>x.length))).toBe(1);expect(await page.evaluate(()=>openDB().then(d=>d.version))).toBe(2);
});
