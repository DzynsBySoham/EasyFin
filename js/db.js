/* EasyFin IndexedDB layer — local-first, versioned */
const DB_NAME='easyfin', DB_VER=1;
let _db=null;
function openDB(){return new Promise((res,rej)=>{
  if(_db) return res(_db);
  const r=indexedDB.open(DB_NAME,DB_VER);
  r.onupgradeneeded=e=>{
    const db=e.target.result;
    const mk=(n,opts)=>{ if(!db.objectStoreNames.contains(n)) db.createObjectStore(n,opts); };
    mk('expenses',{keyPath:'id'});
    mk('income',{keyPath:'id'});
    mk('clients',{keyPath:'id'});
    mk('subscriptions',{keyPath:'id'});
    mk('subscriptionPayments',{keyPath:'id'});
    mk('categoryKeywords',{keyPath:'keyword'});
    mk('settings',{keyPath:'key'});
    const idx=(s,n,k,u)=>{const st=e.target.transaction.objectStore(s); if(!st.indexNames.contains(n)) st.createIndex(n,k,{unique:!!u});};
    idx('expenses','byDate','date'); idx('expenses','byCategory','category'); idx('expenses','byMonth','month');
    idx('income','byDate','date'); idx('income','byClient','clientId'); idx('income','byMonth','month');
    idx('subscriptions','byStatus','status');
    idx('subscriptionPayments','bySub','subscriptionId'); idx('subscriptionPayments','byCycle','cycleKey');
  };
  r.onsuccess=()=>{_db=r.result;res(_db);};
  r.onerror=()=>rej(r.error);
});}
async function tx(store,mode,fn){const db=await openDB();return new Promise((res,rej)=>{
  const t=db.transaction(store,mode);const s=t.objectStore(store);let out;
  const done=fn(s); if(done&&done.then) done.then(v=>out=v).catch(rej);
  t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('Storage transaction aborted'));
});}
const id=()=> (crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(16).slice(2));
const DB={
  async put(store,val){return tx(store,'readwrite',s=>s.put(val));},
  async add(store,val){return tx(store,'readwrite',s=>s.add(val));},
  async get(store,key){const db=await openDB();return new Promise((res,rej)=>{const q=db.transaction(store).objectStore(store).get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});},
  async all(store){const db=await openDB();return new Promise((res,rej)=>{const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});},
  async del(store,key){return tx(store,'readwrite',s=>s.delete(key));},
  async clear(store){return tx(store,'readwrite',s=>s.clear());},
  async setting(key,val){ if(val===undefined){const r=await DB.get('settings',key);return r?r.value:undefined;} return DB.put('settings',{key,value:val}); }
};

// One transaction: either payment, expense and cycle advance all commit, or none do.
DB.paySubscription=async function(subId,expectedDate,viaQuickAdd){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(['subscriptions','subscriptionPayments','expenses'],'readwrite');let recorded=false;
    t.oncomplete=()=>resolve(recorded);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Payment cancelled'));
    const subs=t.objectStore('subscriptions'),payments=t.objectStore('subscriptionPayments');
    const q=subs.get(subId);
    q.onsuccess=()=>{
      const sub=q.result;
      if(!sub||sub.status!=='active'||sub.nextBillingDate!==expectedDate)return;
      const cycle=cycleKey(sub.id,sub.nextBillingDate),check=payments.index('byCycle').get(cycle);
      check.onsuccess=()=>{
        if(check.result)return;
        const now=new Date(),date=now.toISOString();
        recorded=true;
        payments.add({id:id(),subscriptionId:sub.id,cycleKey:cycle,billingDate:sub.nextBillingDate,amount:sub.amount,status:'paid',paidAt:date,via:viaQuickAdd?'quick-add':'slide'});
        t.objectStore('expenses').add({id:id(),amount:sub.amount,description:sub.name,category:'subscriptions',date,month:monthKey(now)});
        subs.put({...sub,nextBillingDate:nextBillingDate(sub.billingDay,sub.nextBillingDate)});
      };
    };
  });
};
DB.restore=async function(data,replace){
  const db=await openDB(),stores=['expenses','income','clients','subscriptions','subscriptionPayments','categoryKeywords','settings'];
  return new Promise((resolve,reject)=>{
    const t=db.transaction(stores,'readwrite');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);
    for(const name of stores){const store=t.objectStore(name);if(replace)store.clear();for(const row of data[name]){
      if(replace)store.put(row);else{const q=store.get(row[store.keyPath]);q.onsuccess=()=>{if(!q.result)store.add(row);};}
    }}
  });
};

// Serialize duplicate checks with writes across tabs; no schema migration required.
DB.addClient=async function(name){
  name=String(name||'').trim();
  if(!name)throw new Error('Enter a client name');
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction('clients','readwrite'),store=t.objectStore('clients');let created=false;
    t.oncomplete=()=>resolve(created);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Client was not saved'));
    const q=store.getAll();q.onsuccess=()=>{
      if(q.result.some(c=>normalize(c.name)===normalize(name)))return;
      store.add({id:id(),name,createdAt:new Date().toISOString()});created=true;
    };
  });
};
