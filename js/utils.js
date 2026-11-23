/* Shared helpers — IST-aware dates, money, month keys */
const fmtINR=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
function monthKey(d){const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');}
function monthLabel(key){ if(key==='all')return 'All Time'; const [y,m]=key.split('-'); return new Date(+y,+m-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'}); }
function fmtDate(iso){return new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'long',hour:'numeric',minute:'2-digit'});}
function fmtDay(iso){return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'long'});}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,2600);}
function animateNumber(el,to){
  if(el.dataset.v===String(to))return;
  const from=parseFloat(el.dataset.v||'0'); el.dataset.v=to;
  el.classList.add('blur');
  setTimeout(()=>{ el.textContent=fmtINR(to); el.classList.remove('blur'); },180);
  void from;
}
function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
/* Next monthly billing date anchored to original day, clamped to month end without drift */
function nextBillingDate(anchorDay,fromDate){
  const parts=(fromDate||new Date().toISOString().slice(0,10)).split('-').map(Number);
  const d=new Date(Date.UTC(parts[0],parts[1],1));
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(anchorDay,last));
  return d.toISOString().slice(0,10);
}
function cycleKey(subId,dateStr){return subId+'|'+dateStr;}
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/86400000);}

function validateBackup(data){
  if(!data||data.app!=='EasyFin'||data.schemaVersion!==1)throw new Error('Unsupported EasyFin backup schema');
  const keys={expenses:'id',income:'id',clients:'id',subscriptions:'id',subscriptionPayments:'id',categoryKeywords:'keyword',settings:'key'};
  for(const [store,key] of Object.entries(keys)){
    if(!Array.isArray(data[store]))throw new Error('Backup is missing '+store);
    const seen=new Set();
    for(const r of data[store]){
      if(!r||typeof r[key]!=='string'||!r[key]||seen.has(r[key]))throw new Error('Invalid or duplicate '+store+' record');seen.add(r[key]);
      if(['expenses','income','subscriptions','subscriptionPayments'].includes(store)&&(!Number.isFinite(r.amount)||r.amount<=0))throw new Error('Invalid amount');
      if(['expenses','categoryKeywords'].includes(store)&&!CATEGORIES.some(c=>c.id===r.category))throw new Error('Invalid category');
      if(['expenses','income'].includes(store)&&(!Number.isFinite(Date.parse(r.date))||r.month!==monthKey(r.date)))throw new Error('Invalid record date');
      if(store==='income'&&(!Number.isInteger(r.thumbnails)||r.thumbnails<=0||!data.clients.some(c=>c.id===r.clientId)))throw new Error('Invalid income client or thumbnails');
      if(store==='clients'&&(typeof r.name!=='string'||!r.name.trim()))throw new Error('Invalid client');
      if(store==='subscriptions'&&(!r.name||!['active','cancelled'].includes(r.status)||!Number.isInteger(r.billingDay)||r.billingDay<1||r.billingDay>31||!/^\d{4}-\d{2}-\d{2}$/.test(r.nextBillingDate)))throw new Error('Invalid subscription');
    }
  }
}
function reminderStage(sub,today=new Date().toISOString().slice(0,10)){
  if(sub.status!=='active')return null;
  const overdue=daysBetween(sub.nextBillingDate,today);
  return overdue>=10?'Have you cancelled your subscription?':overdue>=5?'Payment is overdue':overdue===-1?'Due tomorrow':null;
}
