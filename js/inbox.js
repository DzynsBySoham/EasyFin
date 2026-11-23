/* Optional, encrypted Safari → Home Screen expense inbox. Never a shared DB claim. */
'use strict';
const Inbox=(()=>{
  let config=null,running=null,lastMessage='',pendingPair=null;
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
  const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
  const ios=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=()=>navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
  const browserOnIOS=()=>ios()&&!standalone();
  async function reload(){config=await DB.setting('quickAddInbox')||null;return config;}
  async function request(action,payload={},c=config){
    const headers={'Content-Type':'application/json'};
    if(action!=='create')headers.Authorization='Bearer '+(action==='push'?c.writeToken:c.readToken);
    const response=await fetch('/api/inbox',{method:'POST',headers,cache:'no-store',body:JSON.stringify({action,pairId:c.pairId,...payload}),signal:AbortSignal.timeout(15000)});
    let data;try{data=await response.json();}catch{throw new Error('Encrypted inbox is not available on this deployment.');}
    if(!response.ok)throw new Error(data.error||'Inbox unavailable. Your local record is safe.');return data;
  }
  async function available(){try{const r=await fetch('/api/inbox',{cache:'no-store',signal:AbortSignal.timeout(6000)});return r.ok&&(await r.json()).configured===true;}catch{return false;}}
  async function key(c){return crypto.subtle.importKey('raw',bytes(c.encryptionKey),{name:'AES-GCM'},false,['encrypt','decrypt']);}
  const aad=(c,id)=>encoder.encode('easyfin:inbox:v1:'+c.pairId+':'+id);
  function validateExpense(e){
    if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(e.id)||!Number.isFinite(e.amount)||e.amount<=0||e.amount>1e12||typeof e.description!=='string'||!e.description.trim()||e.description.length>1000||!CATEGORIES.some(c=>c.id===e.category)||typeof e.date!=='string'||!Number.isFinite(Date.parse(e.date))||!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.month||''))throw new Error('Invalid inbox expense; nothing was overwritten.');
    return {id:e.id,amount:e.amount,description:e.description,category:e.category,date:e.date,month:e.month};
  }
  async function envelope(expense,c){
    const transportId=id(),iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(c,transportId)},await key(c),encoder.encode(JSON.stringify(validateExpense(expense))));
    return {v:1,id:transportId,iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext))};
  }
  async function decrypt(e,c){
    if(e.v!==1||typeof e.ciphertext!=='string'||e.ciphertext.length>12000||bytes(e.iv).length!==12)throw new Error('Invalid encrypted expense');
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(e.iv),additionalData:aad(c,e.id)},await key(c),bytes(e.ciphertext));
    return validateExpense(JSON.parse(decoder.decode(plain)));
  }
  function notice(){
    const node=document.getElementById('quickInboxNotice');if(!node)return;
    node.hidden=!config&&!browserOnIOS();
    if(node.hidden)return;
    const text=document.getElementById('quickInboxText');
    text.textContent=lastMessage||(config?.role==='sender'?'Connected to app inbox. Open the Home Screen app to import sent expenses.':config?.role==='receiver'?'App inbox connected. Expenses import when this app is open.':'This is Safari, not the Home Screen app. Without pairing, saves stay in this browser.');
    document.getElementById('quickInboxManage').textContent=config?'Inbox':'Connect';
    document.getElementById('quickInboxManage').onclick=()=>settings();
  }
  async function saveExpense(expense){
    await reload();
    if(config?.role!=='sender'){await DB.add('expenses',expense);return;}
    const encrypted=await envelope(expense,config);
    await DB.addExpenseWithOutbox(expense,{id:expense.id,pairId:config.pairId,envelope:encrypted});
    lastMessage='Saved in Safari. Waiting to send to the app inbox.';notice();
    // Network failure must never undo or misreport the successful local commit.
    queueMicrotask(()=>run());
  }
  async function run(){
    if(running)return running;
    running=(async()=>{
      await reload();if(!config)return;
      const c={...config};
      try{
        if(c.role==='sender'){
          const outbox=(await DB.all('quickAddOutbox')).filter(e=>e.pairId===c.pairId);
          for(const item of outbox){await request('push',{envelope:item.envelope},c);await DB.del('quickAddOutbox',item.id);}
          if(outbox.length)lastMessage='Sent to app inbox. Open Home Screen EasyFin to import.';
        }else{
          const {envelopes}=await request('pull',{},c);let added=0,failed=0;
          const acknowledgements=[];
          if(!Array.isArray(envelopes)||envelopes.length>200)throw new Error('Invalid inbox response');
          for(const item of envelopes){
            try{
              const expense=await decrypt(item,c),digest=await sha(JSON.stringify(expense));
              if(await DB.importInboxExpense(expense,digest))added++;
              // ACK only after import and receipt transaction has committed.
              acknowledgements.push(item.id);
            }catch{failed++;}
          }
          if(added){await refresh();toast(added===1?'1 expense imported into this app':added+' expenses imported into this app');}
          if(acknowledgements.length)await request('ack',{ids:acknowledgements},c);
          lastMessage=failed?'Some inbox entries could not be imported. No existing records were overwritten.':added?'Imported into this app’s database.':'App inbox checked.';
        }
      }catch(e){lastMessage=e.message||'Inbox unavailable. Local expenses are safe.';}
      finally{notice();const status=document.getElementById('inboxConnectionStatus');if(status)status.textContent=lastMessage;}
    })().catch(()=>{lastMessage='Inbox unavailable. Local expenses are safe.';notice();}).finally(()=>{running=null;});
    return running;
  }
  function validPair(p){return p&&p.v===1&&/^[a-f0-9-]{36}$/i.test(p.pairId||'')&&/^[A-Za-z0-9_-]{43}$/.test(p.writeToken||'')&&/^[A-Za-z0-9_-]{43}$/.test(p.encryptionKey||'')&&!p.readToken&&Number.isFinite(p.expiresAt)&&p.expiresAt>Date.now();}
  async function acceptLink(){
    try{pendingPair=JSON.parse(decoder.decode(bytes(window.easyfinPairing)));if(!validPair(pendingPair))throw new Error();}
    catch{window.easyfinPairing=null;toast('Invalid or expired inbox pairing link');return;}
    window.easyfinPairing=null;
    if(standalone()){pendingPair=null;toast('Open the pairing link in Safari, not the Home Screen app.');return;}
    openSheet(`<button class="close-x" id="declineInbox" aria-label="Do not connect">✕</button><h2>Connect Safari to your app</h2><p class="sub">Only continue if you created this private link in your own Home Screen EasyFin. New expenses will be saved here first, then encrypted on this device and sent through the relay. Your Home Screen app imports them when opened. The relay cannot read the encrypted contents.</p><p class="note">No existing records are sent automatically. Keep this link private. Pairing expires after 30 days. Never connect using someone else’s link.</p><button class="primary-btn" id="acceptInbox">Connect this Safari Quick Add</button>`);
    document.getElementById('declineInbox').onclick=()=>{pendingPair=null;closeSheet();};
    document.getElementById('acceptInbox').onclick=guardSubmission(document.getElementById('acceptInbox'),async()=>{
      if(config)throw new Error('Disconnect the existing inbox in Settings before changing connections.');
      if(!await available())throw new Error('Relay is not configured');
      config={...pendingPair,role:'sender'};await DB.setting('quickAddInbox',config);pendingPair=null;closeSheet();lastMessage='Connected. New expenses will be encrypted and queued for your app.';notice();
    });
  }
  async function settings(){
    await reload();
    openSheet(`<button class="close-x" onclick="closeSheet()">✕</button><h2>App expense inbox</h2><p class="sub">Safari and the Home Screen app have separate databases. Pair them to send encrypted Quick Add expenses into your main app when it opens.</p><p class="note" id="inboxConnectionStatus">Checking relay…</p><div id="inboxActions"></div>`);
    const configured=await available();if(!document.getElementById('inboxActions'))return;
    const status=document.getElementById('inboxConnectionStatus'),actions=document.getElementById('inboxActions');
    if(config){
      status.textContent=(config.role==='receiver'?'This is the receiving app. ':'This is the Safari sender. ')+(lastMessage||'')+' Connection expires '+new Date(config.expiresAt).toLocaleDateString()+'.';
      actions.innerHTML=`<button class="primary-btn" id="checkInbox">${config.role==='receiver'?'Import pending expenses':'Retry sending pending expenses'}</button>${config.role==='receiver'?'<button class="ghost-btn" id="copyInboxLink">Copy private Safari setup link</button>':'<button class="ghost-btn" id="recoverSafari">Send existing Safari expenses…</button>'}<button class="ghost-btn" id="disconnectInbox">${config.role==='receiver'?'Revoke connection':'Disconnect this browser'}</button><p class="note">The relay retains encrypted pending entries for up to 30 days. Local records are not deleted. The app must be opened to import; closed-app background delivery is not promised.</p>`;
      document.getElementById('checkInbox').onclick=guardSubmission(document.getElementById('checkInbox'),run);
      if(config.role==='receiver')document.getElementById('copyInboxLink').onclick=()=>copyLink(config);
      else document.getElementById('recoverSafari').onclick=previewExisting;
      document.getElementById('disconnectInbox').onclick=()=>confirmDisconnect();
      return;
    }
    if(!configured){status.textContent='Not available yet: the encrypted relay needs server configuration. Expenses currently stay in the browser/app where you enter them. Do not clear either database.';return;}
    if(browserOnIOS()){status.textContent='Start pairing from Settings → Connect Safari Quick Add inside the Home Screen app. Then open its private setup link in Safari.';return;}
    status.textContent='Start here only in your main EasyFin app. Safari expenses will be encrypted before leaving that browser; no full financial backup or income/client history is uploaded.';
    actions.innerHTML='<button class="primary-btn" id="createInbox">Create private connection</button><p class="note">By connecting you opt into an encrypted server relay for new Quick Add expenses. Existing records stay local unless explicitly selected for recovery.</p>';
    document.getElementById('createInbox').onclick=guardSubmission(document.getElementById('createInbox'),async()=>{
      const c={v:1,role:'receiver',pairId:id(),readToken:random(),writeToken:random(),encryptionKey:random()};
      const result=await request('create',{readHash:await sha(c.readToken),writeHash:await sha(c.writeToken)},c);
      c.expiresAt=result.expiresAt;await DB.setting('quickAddInbox',c);config=c;lastMessage='Connection created. Copy its private link and open it in Safari.';await settings();notice();
    });
  }
  async function copyLink(c){
    const p={v:1,pairId:c.pairId,writeToken:c.writeToken,encryptionKey:c.encryptionKey,expiresAt:c.expiresAt};
    const link=location.origin+'/?action=quick-add#inbox='+b64(encoder.encode(JSON.stringify(p)));
    try{await navigator.clipboard.writeText(link);toast('Private link copied. Open it in Safari and confirm Connect.');}
    catch{openSheet('<button class="close-x" onclick="closeSheet()">✕</button><h2>Private setup link</h2><label class="field-label" for="privateInboxLink">Copy into Safari</label><textarea class="text-input" id="privateInboxLink" readonly></textarea><p class="note">This link contains a private encryption key. Do not share it publicly.</p>');document.getElementById('privateInboxLink').value=link;}
  }
  async function previewExisting(){
    const expenses=await DB.all('expenses');
    openSheet(`<button class="close-x" onclick="closeSheet()">✕</button><h2>Recover Safari expenses</h2><p class="sub">Send ${expenses.length} existing expense records, totalling ${fmtINR(expenses.reduce((s,e)=>s+Number(e.amount),0))}, to your paired app? They are encrypted before upload. Income, clients, settings and full backups are not sent. Existing app records are never overwritten.</p><button class="primary-btn" id="sendExisting" ${!expenses.length||expenses.length>200?'disabled':''}>Send ${expenses.length} expenses</button><p class="note">This recovery supports up to 200 expenses per batch. Repeat imports keep the same record IDs to avoid duplicates.</p>`);
    document.getElementById('sendExisting').onclick=guardSubmission(document.getElementById('sendExisting'),async()=>{
      for(const expense of expenses){const encrypted=await envelope(expense,config);await DB.put('quickAddOutbox',{id:expense.id,pairId:config.pairId,envelope:encrypted});}
      closeSheet();lastMessage='Recovery queued locally. Open the Home Screen app after sending.';notice();await run();
    });
  }
  function confirmDisconnect(){
    const c={...config};openSheet(`<button class="close-x" onclick="closeSheet()">✕</button><h2>Disconnect inbox?</h2><p class="sub">${c.role==='receiver'?'Revoking stops this private link and removes encrypted pending entries from the relay. Import pending entries first. Original Safari expenses stay in Safari.':'Unsent entries and expenses remain stored in this browser. Reconnect or recover them before clearing browser data.'} No local expenses will be deleted.</p><button class="primary-btn" id="confirmInboxDisconnect">${c.role==='receiver'?'Revoke connection':'Disconnect'}</button>`);
    document.getElementById('confirmInboxDisconnect').onclick=guardSubmission(document.getElementById('confirmInboxDisconnect'),async()=>{
      if(c.role==='receiver')await request('revoke',{},c);
      await DB.del('settings','quickAddInbox');config=null;lastMessage='';closeSheet();notice();
    });
  }
  async function init(){await reload();notice();if(window.easyfinPairing){await acceptLink();return;}if(config)run();}
  window.addEventListener('online',()=>run());
  window.addEventListener('focus',()=>{if(config)run();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&config)run();});
  return {init,reload,settings,run,saveExpense,notice,browserOnIOS,isSender:()=>config?.role==='sender',saveMessage:()=>config?.role==='sender'?'Saved in Safari · queued for app inbox':browserOnIOS()?'Saved in this browser':'Expense saved'};
})();
