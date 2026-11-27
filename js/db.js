/* EasyFin IndexedDB layer — local-first, versioned */
const DB_NAME='easyfin', DB_VER=2;
let _db=null,_opening=null;
function openDB(){
  if(_db)return Promise.resolve(_db);
  if(_opening)return _opening;
  _opening=new Promise((res,rej)=>{
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
    mk('quickAddOutbox',{keyPath:'id'});
    mk('quickAddReceipts',{keyPath:'id'});
    const idx=(s,n,k,u)=>{const st=e.target.transaction.objectStore(s); if(!st.indexNames.contains(n)) st.createIndex(n,k,{unique:!!u});};
    idx('expenses','byDate','date'); idx('expenses','byCategory','category'); idx('expenses','byMonth','month');
    idx('income','byDate','date'); idx('income','byClient','clientId'); idx('income','byMonth','month');
    idx('subscriptions','byStatus','status');
    idx('subscriptionPayments','bySub','subscriptionId'); idx('subscriptionPayments','byCycle','cycleKey');
  };
  r.onsuccess=()=>{const db=r.result;_db=db;db.onversionchange=()=>{db.close();if(_db===db)_db=null;};res(db);};
  r.onblocked=()=>rej(new Error('Close other EasyFin tabs, then reopen to finish the safe storage upgrade.'));
  r.onerror=()=>rej(r.error);
  }).finally(()=>{_opening=null;});return _opening;
}
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
      const existing=q.result.find(c=>normalize(c.name)===normalize(name));
      if(existing){if(existing.archived){store.put({...existing,archived:false});created=true;}return;}
      store.add({id:id(),name,createdAt:new Date().toISOString()});created=true;
    };
  });
};

// A Safari expense and its encrypted outbound envelope commit together.
DB.addExpenseWithOutbox=async function(expense,outbox){
  const db=await openDB();return new Promise((resolve,reject)=>{
    const t=db.transaction(['expenses','quickAddOutbox'],'readwrite');
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);
    t.objectStore('expenses').add(expense);t.objectStore('quickAddOutbox').add(outbox);
  });
};
// Import and receipt are atomic. A retry cannot pay a cycle or add an expense twice.
DB.importInboxExpense=async function(expense,digest){
  const db=await openDB();return new Promise((resolve,reject)=>{
    const t=db.transaction(['expenses','quickAddReceipts','subscriptions','subscriptionPayments'],'readwrite');let added=false;
    t.oncomplete=()=>resolve(added);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Import conflict. No record was overwritten.'));
    const ex=t.objectStore('expenses'),receipts=t.objectStore('quickAddReceipts');
    const q=ex.get(expense.id);q.onsuccess=()=>{
      const existing=q.result,r=receipts.get(expense.id);
      r.onsuccess=()=>{
        if(existing){
          const same=r.result?r.result.digest===digest:['amount','description','category','date','month'].every(k=>existing[k]===expense[k]);
          if(!same){t.abort();return;}receipts.put({id:expense.id,digest});return;
        }
        const subs=t.objectStore('subscriptions'),pays=t.objectStore('subscriptionPayments'),sq=subs.getAll();
        sq.onsuccess=()=>{
          const sub=sq.result.find(s=>s.status==='active'&&s.name.trim()===expense.description.trim()&&Number(s.amount)===expense.amount&&s.nextBillingDate.slice(0,7)<=expense.month);
          const commit=(matched)=>{ex.add(matched?{...expense,category:'subscriptions'}:expense);receipts.put({id:expense.id,digest});added=true;};
          if(!sub){commit(false);return;}
          const cycle=cycleKey(sub.id,sub.nextBillingDate),paid=pays.index('byCycle').get(cycle);
          paid.onsuccess=()=>{
            if(paid.result){commit(false);return;}
            pays.add({id:'inbox-'+expense.id,subscriptionId:sub.id,cycleKey:cycle,billingDate:sub.nextBillingDate,amount:sub.amount,status:'paid',paidAt:expense.date,via:'quick-add-inbox'});
            subs.put({...sub,nextBillingDate:nextBillingDate(sub.billingDay,sub.nextBillingDate)});commit(true);
          };
        };
      };
    };
  });
};
