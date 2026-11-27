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
        recorded=true;const expenseId=id();
        payments.add({id:id(),expenseId,subscriptionId:sub.id,cycleKey:cycle,billingDate:sub.nextBillingDate,amount:sub.amount,status:'paid',paidAt:date,via:viaQuickAdd?'quick-add':'slide'});
        t.objectStore('expenses').add({id:expenseId,amount:sub.amount,description:sub.name,category:'subscriptions',date,month:monthKey(now)});
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
        if(r.result&&!existing){if(r.result.digest!==digest){t.abort();return;}return;}
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
            pays.add({id:'inbox-'+expense.id,expenseId:expense.id,subscriptionId:sub.id,cycleKey:cycle,billingDate:sub.nextBillingDate,amount:sub.amount,status:'paid',paidAt:expense.date,via:'quick-add-inbox'});
            subs.put({...sub,nextBillingDate:nextBillingDate(sub.billingDay,sub.nextBillingDate)});commit(true);
          };
        };
      };
    };
  });
};

// Source and all linked income are deleted together, including previously archived sources.
DB.deleteSource=async function(sourceId){
  const db=await openDB();return new Promise((resolve,reject)=>{
    const t=db.transaction(['clients','income'],'readwrite'),income=t.objectStore('income');
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Source deletion failed'));
    t.objectStore('clients').delete(sourceId);
    const q=income.openCursor();q.onsuccess=()=>{const cursor=q.result;if(!cursor)return;if(cursor.value.clientId===sourceId)cursor.delete();cursor.continue();};
  });
};
DB.saveIncome=async function(record){
  const db=await openDB();return new Promise((resolve,reject)=>{
    const t=db.transaction(['clients','income'],'readwrite');
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Source no longer available'));
    const q=t.objectStore('clients').get(record.clientId);q.onsuccess=()=>{if(!q.result||q.result.archived){t.abort();return;}t.objectStore('income').add(record);};
  });
};
// Optimistic record check prevents stale sheets/tabs resurrecting deleted/changed records.
DB.changeRecord=async function(store,expected,next){
  if(!['expenses','income'].includes(store))throw new Error('Invalid store');
  const db=await openDB();return new Promise((resolve,reject)=>{
    const names=store==='income'?['income','clients']:['expenses','quickAddOutbox','quickAddReceipts','subscriptions','subscriptionPayments'];
    const t=db.transaction(names,'readwrite'),records=t.objectStore(store);
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('This record changed. Close and reopen it before retrying.'));
    const q=records.get(expected.id);q.onsuccess=()=>{
      if(!q.result||JSON.stringify(q.result)!==JSON.stringify(expected)){t.abort();return;}
      if(next&&(next.id!==expected.id||next.date!==expected.date||next.month!==expected.month||!Number.isFinite(next.amount)||next.amount<=0)){t.abort();return;}
      const write=()=>{if(next)records.put(next);else records.delete(expected.id);};
      if(store==='income'){
        if(!next){write();return;}
        const c=t.objectStore('clients').get(next.clientId);c.onsuccess=()=>{if(!c.result||!Number.isInteger(next.thumbnails)||next.thumbnails<=0){t.abort();return;}write();};return;
      }
      if(next&&(!next.description?.trim()||next.description.length>1000||!CATEGORIES.some(c=>c.id===next.category))){t.abort();return;}
      // Never allow a stale unsent copy to transfer after a local correction/deletion.
      t.objectStore('quickAddOutbox').delete(expected.id);
      // Keep the original receipt: relay retries must not resurrect a deleted imported expense.
      const subs=t.objectStore('subscriptions'),payments=t.objectStore('subscriptionPayments'),sq=subs.getAll();
      sq.onsuccess=()=>{
        const pq=payments.getAll();pq.onsuccess=()=>{
          const linked=pq.result.filter(p=>p.expenseId===expected.id||(!p.expenseId&&p.paidAt===expected.date&&Number(p.amount)===expected.amount&&sq.result.some(s=>s.id===p.subscriptionId&&s.name.trim()===expected.description.trim())));
          // Legacy records had no expenseId; do not guess if the match is ambiguous.
          if(linked.length>1){t.abort();return;}
          for(const payment of linked){
            if(next)payments.put({...payment,expenseId:expected.id,amount:next.amount});
            else{
              payments.delete(payment.id);
              const sub=sq.result.find(s=>s.id===payment.subscriptionId);
              if(sub&&sub.nextBillingDate===nextBillingDate(sub.billingDay,payment.billingDate))subs.put({...sub,nextBillingDate:payment.billingDate});
            }
          }
          write();
        };
      };
    };
  });
};
