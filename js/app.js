/* EasyFin app — Quick Add, Dashboard, Balance, Income, Expenses, Subscriptions, Backup, Push */
'use strict';
const $=s=>document.querySelector(s);
let state={period:null,view:'home',expCat:'all',expMonth:'all',incClient:'all',incMonth:'all'};

/* ---------- Theme ---------- */
async function initTheme(){
  const saved=await DB.setting('theme');
  const prefersDark=matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved||(prefersDark?'dark':'light'));
}
function applyTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem('easyfin-theme',t);document.querySelector('meta[name="theme-color"]').content=t==='dark'?'#050506':'#f7f9fc';DB.setting('theme',t).catch(()=>toast('Appearance could not be saved'));}
$('#themeBtn').onclick=()=>{const cur=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(cur);};

/* ---------- Navigation ---------- */
function go(view){
  if(state.view!==view)state.period=null;
  state.view=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  document.querySelectorAll('.dock-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const titles={home:['Quick Add','Pick up where you left off'],dashboard:['Dashboard','Your money at a glance'],balance:['Balance','Current month position'],income:['Income','Client-wise earnings'],expenses:['Expenses','Every rupee, accounted'],subs:['Subscriptions','Monthly recurring']};
  const t=titles[view]||titles.home; $('#topEyebrow').textContent=t[0]; $('#topSub').textContent=t[1];
  refresh();
  window.scrollTo({top:0});
}
document.querySelectorAll('.dock-btn').forEach(b=>b.onclick=()=>go(b.dataset.view));
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$('#dashExpenseCard').onclick=()=>go('expenses');
$('#dashIncomeCard').onclick=()=>go('income');
$('#openSubsBtn').onclick=()=>go('subs');

/* ---------- Sheet / modal ---------- */
let sheetReturnFocus=null;
function openSheet(html){const o=$('#overlay'),s=$('#sheet');if(o.hidden)sheetReturnFocus=document.activeElement;s.innerHTML=html;s.querySelectorAll('.field-label').forEach(label=>{if(label.nextElementSibling?.id)label.htmlFor=label.nextElementSibling.id;});s.querySelectorAll('.close-x').forEach(b=>b.setAttribute('aria-label','Close without saving'));o.hidden=false;document.body.style.overflow='hidden';const heading=s.querySelector('h2');if(heading){heading.id='sheetTitle';s.setAttribute('aria-labelledby','sheetTitle');}requestAnimationFrame(()=>s.querySelector('button,input,select')?.focus());}
function closeSheet(){$('#overlay').hidden=true;$('#sheet').innerHTML='';document.body.style.overflow='';sheetReturnFocus?.focus();}
document.addEventListener('keydown',e=>{if($('#overlay').hidden)return;if(e.key==='Escape'){if($('.onboarding'))return;if($('.cat-grid'))clearQA();closeSheet();}if(e.key==='Tab'){const nodes=[...$('#sheet').querySelectorAll('button:not(:disabled),input:not([hidden]),select,[tabindex="0"]')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
$('#overlay').addEventListener('click',e=>{if(e.target.id==='overlay'&&!$('.onboarding')){if($('.cat-grid'))clearQA();closeSheet();}});

/* ---------- Slide to confirm ---------- */
function bindSlide(el,onDone){
  const thumb=el.querySelector('.slide-thumb'), track=el.querySelector('.slide-track');
  let pointer=null,start=0,x=0,busy=false;
  const max=()=>Math.max(1,el.clientWidth-thumb.offsetWidth-12);
  const disabled=()=>el.getAttribute('aria-disabled')==='true';
  el.tabIndex=0;el.setAttribute('role','slider');el.setAttribute('aria-label',el.querySelector('.slide-label').textContent);
  el.setAttribute('aria-description','Drag from left to right to confirm. With a keyboard, use Arrow Right to reach 100, then Enter. Escape resets.');
  el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax','100');
  const move=v=>{x=Math.max(0,Math.min(max(),v));thumb.style.transform=`translateX(${x}px)`;track.style.opacity=1-x/max()*.8;el.setAttribute('aria-valuenow',Math.round(x/max()*100));};
  const reset=()=>{el.classList.remove('dragging','done');move(0);};
  const complete=async()=>{
    if(busy||disabled())return;busy=true;el.setAttribute('aria-busy','true');move(max());
    try{await onDone();el.classList.add('done');await new Promise(r=>setTimeout(r,300));}
    catch(error){console.error(error);toast('Could not save. Your entry is still here — please retry.');}
    finally{busy=false;el.removeAttribute('aria-busy');reset();}
  };
  el.addEventListener('pointerdown',e=>{
    if(busy||disabled()||pointer!==null||!e.isPrimary||e.button!==0)return;
    if(e.clientX>thumb.getBoundingClientRect().right+8)return;
    pointer=e.pointerId;start=e.clientX;el.classList.add('dragging');try{el.setPointerCapture(pointer);}catch{pointer=null;reset();return;}e.preventDefault();
  });
  el.addEventListener('pointermove',e=>{if(e.pointerId===pointer){move(e.clientX-start);e.preventDefault();}});
  el.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;pointer=null;el.classList.remove('dragging');if(x>=max()*.94)complete();else reset();});
  const cancel=()=>{if(pointer!==null){pointer=null;reset();}};
  el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);
  el.addEventListener('keydown',e=>{if(disabled()||busy)return;if(e.key==='ArrowRight'){e.preventDefault();move(x+max()/10);}if(e.key==='ArrowLeft'){e.preventDefault();move(x-max()/10);}if(e.key==='Escape')reset();if((e.key==='Enter'||e.key===' ')&&x>=max()*.94){e.preventDefault();complete();}});
  move(0);
}

/* ---------- Quick Add ---------- */
$('#quickClose').onclick=()=>{ $('#qaAmount').value='';$('#qaDesc').value=''; updateQAValidity(); };
async function trySaveExpense(){
  const amt=parseFloat($('#qaAmount').value);
  const desc=$('#qaDesc').value.trim();
  if(!Number.isFinite(amt)||amt<=0){toast('Enter a valid amount');return;}
  if(!desc){toast('Enter what it was for');$('#qaDesc').focus();return;}
  // Already gated by Slide to Add: exact name + amount + current pending cycle.
  const matched=await findPendingSubscription(desc,amt);
  if(matched){ await confirmSubscriptionPayment(matched,{viaQuickAdd:true}); toast('Subscription paid ✓'); clearQA(); return; }
  const cat=await categorize(desc);
  if(!cat){ openCategoryPicker(desc,amt); return; }
  await saveExpense({amount:amt,description:desc,category:cat});
  toast('Added ✓'); clearQA();
}
function clearQA(){$('#qaAmount').value='';$('#qaDesc').value='';updateQAValidity();refresh();}
function updateQAValidity(){const amount=Number($('#qaAmount').value);$('#qaSlide').setAttribute('aria-disabled',!(Number.isFinite(amount)&&amount>0&&$('#qaDesc').value.trim()));}
$('#qaAmount').addEventListener('input',updateQAValidity);$('#qaDesc').addEventListener('input',updateQAValidity);updateQAValidity();
async function saveExpense({amount,description,category}){
  const now=new Date();
  await DB.add('expenses',{id:id(),amount,description,category,date:now.toISOString(),month:monthKey(now)});
}
bindSlide($('#qaSlide'),trySaveExpense);

function openCategoryPicker(desc,amt){
  openSheet(`<button class="close-x" onclick="clearQA();closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>Pick a category</h2><p class="sub">“${esc(desc)}” wasn't recognised. Choose one of the 6 fixed categories — we'll remember it for next time.</p>
    <div class="cat-grid">${CATEGORIES.map(c=>`<button class="cat-pick" data-cat="${c.id}"><span class="ci">${c.icon}</span>${c.label}</button>`).join('')}</div>`);
  document.querySelectorAll('.cat-pick').forEach(b=>b.onclick=async()=>{
    document.querySelectorAll('.cat-pick').forEach(x=>x.disabled=true);
    try{
    await rememberKeyword(desc,b.dataset.cat);
    await saveExpense({amount:amt,description:desc,category:b.dataset.cat});
    closeSheet(); toast('Added ✓'); clearQA();
    }catch(e){toast('Could not save. Please retry.');document.querySelectorAll('.cat-pick').forEach(x=>x.disabled=false);}
  });
}

/* ---------- Subscriptions core ---------- */
async function findPendingSubscription(desc,amt){
  const subs=await DB.all('subscriptions');
  for(const s of subs){
    if(s.status!=='active')continue;
    if(s.name.trim()!==desc.trim())continue;
    if(s.nextBillingDate.slice(0,7)>monthKey(new Date()))continue;
    if(Number(s.amount)!==Number(amt))continue;
    const pays=await DB.all('subscriptionPayments');
    const cycle=cycleKey(s.id,s.nextBillingDate);
    if(pays.some(p=>p.cycleKey===cycle&&p.status==='paid'))continue;
    return s;
  }
  return null;
}
async function confirmSubscriptionPayment(sub,{viaQuickAdd=false}={}){
  await DB.paySubscription(sub.id,sub.nextBillingDate,viaQuickAdd);
  syncReminderMetadata();
}
async function syncReminderMetadata(){
  // Queue minimal metadata for server reminders (name/amount/date only — never full history)
  try{
    const subs=(await DB.all('subscriptions')).filter(s=>s.status==='active');
    await DB.setting('reminderQueue',subs.map(s=>({id:s.id,name:s.name,amount:s.amount,nextBillingDate:s.nextBillingDate})));
    if(navigator.serviceWorker&&'sync' in navigator.serviceWorker){ /* background sync where supported */ }
  }catch(e){}
}

/* ---------- Refresh / renders ---------- */
async function refresh(){
  await Promise.all([renderToday(),renderDashboard(),renderBalance(),renderExpenses(),renderIncome(),renderSubs(),fillMonthSelects()]);
}
async function renderToday(){
  const today=monthKey(new Date());
  const all=(await DB.all('expenses')).filter(e=>e.month===today&&new Date(e.date).toDateString()===new Date().toDateString()).sort((a,b)=>new Date(b.date)-new Date(a.date));
  $('#todayList').innerHTML=all.length?all.map(e=>txnHTML(e,'out')).join(''):'<p class="empty">No expenses today yet.</p>';
}
function txnHTML(e,kind){
  const cat=CATEGORIES.find(c=>c.id===e.category);
  return `<div class="txn"><div class="cat-dot">${cat?cat.icon:'•'}</div><div class="txn-main"><div class="txn-title">${esc(e.description)}</div><div class="txn-sub">${cat?cat.label:''} · ${fmtDate(e.date)}</div></div><div class="txn-amt ${kind}">${kind==='in'?'+':'−'}${fmtINR(e.amount)}</div></div>`;
}
async function monthTotals(){
  const mk=monthKey(new Date());
  const exps=await DB.all('expenses'), incs=await DB.all('income');
  const e=exps.filter(x=>x.month===mk).reduce((s,x)=>s+Number(x.amount),0);
  const i=incs.filter(x=>x.month===mk).reduce((s,x)=>s+Number(x.amount),0);
  return {e,i,net:i-e};
}
async function renderDashboard(){
  const t=await monthTotals();
  $('#dashMonthLabel').textContent=monthLabel(monthKey(new Date()));
  animateNumber($('#dashBalance'),t.net); animateNumber($('#dashExpenses'),t.e); animateNumber($('#dashIncome'),t.i);
  const exps=(await DB.all('expenses')).filter(x=>x.month===monthKey(new Date()));
  const byCat={}; exps.forEach(x=>byCat[x.category]=(byCat[x.category]||0)+Number(x.amount));
  $('#dashBreakdown').innerHTML=Object.keys(byCat).length?Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>{const cat=CATEGORIES.find(x=>x.id===c);return `<div class="row-between"><span>${cat?cat.icon+' '+cat.label:c}</span><span>${fmtINR(v)}</span></div>`;}).join(''):'<p class="empty">No expenses this month.</p>';
}
async function renderBalance(){
  const t=await monthTotals();
  animateNumber($('#balValue'),t.net); animateNumber($('#balIncome'),t.i); animateNumber($('#balExpenses'),t.e); animateNumber($('#balNet'),t.net);
  $('#balSub').textContent=`${monthLabel(monthKey(new Date()))} · Income − Expenses`;
}
async function fillMonthSelects(){
  const exps=await DB.all('expenses'), incs=await DB.all('income');
  const months=[...new Set([...exps.map(e=>e.month),...incs.map(e=>e.month)])].sort().reverse();
  const opts=['all',...new Set([monthKey(new Date()),...months])].map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join('');
  const em=$('#expenseMonth'),im=$('#incomeMonth');
  const ev=state.expMonth,iv=state.incMonth; em.innerHTML=opts; im.innerHTML=opts;
  em.value=[...em.options].some(o=>o.value===ev)?ev:'all'; im.value=[...im.options].some(o=>o.value===iv)?iv:'all';
}
$('#expenseMonth').onchange=e=>{state.expMonth=e.target.value;renderExpenses();};
$('#incomeMonth').onchange=e=>{state.incMonth=e.target.value;renderIncome();};

async function renderExpenses(){
  $('#catChips').innerHTML=['all',...CATEGORIES.map(c=>c.id)].map(c=>{
    const label=c==='all'?'All':CATEGORIES.find(x=>x.id===c).label;
    return `<button class="chip ${state.expCat===c?'active':''}" data-c="${c}">${label}</button>`;
  }).join('');
  document.querySelectorAll('#catChips .chip').forEach(b=>b.onclick=()=>{state.expCat=b.dataset.c;renderExpenses();});
  let list=await DB.all('expenses');
  if(state.period==='today')list=list.filter(e=>new Date(e.date).toDateString()===new Date().toDateString());
  if(state.period==='week'){const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7));list=list.filter(e=>new Date(e.date)>=start&&new Date(e.date)<=new Date());}
  if(state.expCat!=='all')list=list.filter(e=>e.category===state.expCat);
  if(state.expMonth!=='all')list=list.filter(e=>e.month===state.expMonth);
  list.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const groups={}; list.forEach(e=>{const d=fmtDay(e.date);(groups[d]=groups[d]||[]).push(e);});
  $('#expenseList').innerHTML=list.length?Object.entries(groups).map(([d,items])=>`<h3 style="margin:14px 0 8px;font-size:15px">${d}</h3>`+items.map(e=>txnHTML(e,'out')).join('')).join(''):'<p class="empty">No expenses match.</p>';
  const subs=await DB.all('subscriptions'); const pending=subs.filter(s=>s.status==='active').length;
  $('#subsBadge').textContent=pending?pending+' active':'';
}

async function renderIncome(){
  const clients=await DB.all('clients');
  $('#clientChips').innerHTML=[{id:'all',name:'All Clients'},...clients].map(c=>`<button class="chip ${state.incClient===c.id?'active':''}" data-c="${c.id}">${esc(c.name)}</button>`).join('');
  document.querySelectorAll('#clientChips .chip').forEach(b=>b.onclick=()=>{state.incClient=b.dataset.c;renderIncome();});
  let list=await DB.all('income');
  if(state.incClient!=='all')list=list.filter(x=>x.clientId===state.incClient);
  if(state.incMonth!=='all')list=list.filter(x=>x.month===state.incMonth);
  list.sort((a,b)=>new Date(b.date)-new Date(a.date));
  $('#incomeList').innerHTML=list.length?list.map(x=>{
    const cl=clients.find(c=>c.id===x.clientId);
    return `<div class="txn"><div class="cat-dot">↗</div><div class="txn-main"><div class="txn-title">${esc(cl?cl.name:'Client')}</div><div class="txn-sub">${x.thumbnails} thumbnails · ${fmtDate(x.date)}</div></div><div class="txn-amt in">+${fmtINR(x.amount)}</div></div>`;
  }).join(''):'<p class="empty">No income yet. Add a client to get started.</p>';
}

async function renderSubs(){
  const subs=await DB.all('subscriptions');
  const pays=await DB.all('subscriptionPayments');
  const active=subs.filter(s=>s.status==='active'), cancelled=subs.filter(s=>s.status==='cancelled');
  const paidThisCycle=pays.filter(p=>p.status==='paid').length;
  $('#subsStats').innerHTML=`
    <div class="stat-card"><span class="stat-label">Total</span><span class="stat-value">${subs.length}</span></div>
    <div class="stat-card"><span class="stat-label">Active / Pending</span><span class="stat-value">${active.length}</span></div>
    <div class="stat-card"><span class="stat-label">Paid (all cycles)</span><span class="stat-value">${paidThisCycle}</span></div>
    <div class="stat-card"><span class="stat-label">Cancelled</span><span class="stat-value">${cancelled.length}</span></div>`;
  $('#subsList').innerHTML=subs.length?subs.map(s=>{
    const paid=pays.some(p=>p.subscriptionId===s.id&&p.cycleKey===cycleKey(s.id,s.nextBillingDate)&&p.status==='paid');
    const status=s.status==='cancelled'?'Cancelled':paid?'Paid':(reminderStage(s)||'Pending');
    return `<div class="txn"><div class="cat-dot">${CATEGORIES[4].icon}</div><div class="txn-main"><div class="txn-title">${esc(s.name)}</div><div class="txn-sub">${fmtINR(s.amount)}/mo · Next: ${s.nextBillingDate} · ${status}</div></div>${s.status==='active'&&!paid?`<button class="chip" data-confirm="${s.id}">Pay</button><button class="chip" data-cancel="${s.id}" aria-label="Cancel subscription">×</button>`:''}</div>`;
  }).join(''):'<p class="empty">No subscriptions yet.</p>';
  document.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=async()=>{const s=await DB.get('subscriptions',b.dataset.confirm);openConfirmSheet(s);});
  document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>openCancelSheet(await DB.get('subscriptions',b.dataset.cancel)));
  $('#subPayments').innerHTML=pays.length?pays.sort((a,b)=>new Date(b.paidAt)-new Date(a.paidAt)).map(p=>{const s=subs.find(x=>x.id===p.subscriptionId);return `<div class="row-between"><span>${esc(s?s.name:'Subscription')} · ${p.billingDate}</span><span>${fmtINR(p.amount)} ✓</span></div>`;}).join(''):'<p class="empty">No payments recorded.</p>';
}
function openConfirmSheet(sub){
  openSheet(`<button class="close-x" onclick="closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>${esc(sub.name)}</h2><p class="sub">${fmtINR(sub.amount)} due ${sub.nextBillingDate}. Slide to confirm you have paid.</p>
    <div class="slide" id="confirmSlide" data-color="blue"><div class="slide-track"><span class="slide-label">Slide to Confirm</span></div><div class="slide-thumb">›</div></div>
    <p class="slide-note">Closing without sliding records nothing.</p>`);
  bindSlide($('#confirmSlide'),async()=>{await confirmSubscriptionPayment(sub);closeSheet();toast('Payment recorded ✓');refresh();});
}
function openCancelSheet(sub){
  openSheet(`<button class="close-x" onclick="closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>Have you cancelled your subscription?</h2><p class="sub">Slide only if you have <strong>already</strong> cancelled ${esc(sub.name)} externally. This stops EasyFin reminders — it does not cancel the service itself.</p>
    <div class="slide" id="cancelSlide" data-color="pink"><div class="slide-track"><span class="slide-label">Slide to Confirm Cancellation</span></div><div class="slide-thumb">›</div></div>`);
  bindSlide($('#cancelSlide'),async()=>{await DB.put('subscriptions',{...sub,status:'cancelled'});closeSheet();toast('Marked cancelled');refresh();syncReminderMetadata();});
}

/* ---------- Add Subscription ---------- */
$('#addSubBtn').onclick=()=>{
  openSheet(`<button class="close-x" onclick="closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>Add Subscription</h2><p class="sub">Monthly only. Reminders: 1 day before, 5 &amp; 10 days after if unpaid.</p>
    <label class="field-label">Name</label><input class="text-input" id="subName" placeholder="Netflix">
    <label class="field-label">Amount (₹)</label><input class="text-input" id="subAmt" type="number" inputmode="decimal" placeholder="649">
    <label class="field-label">Monthly billing date</label><input class="text-input" id="subDate" type="date">
    <button class="primary-btn" id="saveSub">Save Subscription</button>`);
  $('#saveSub').onclick=async()=>{
    const name=$('#subName').value.trim(), amt=parseFloat($('#subAmt').value), d=$('#subDate').value;
    if(!name||!Number.isFinite(amt)||amt<=0||!d||!Number.isFinite(Date.parse(d))){toast('Fill all fields');return;}
    const billingDay=new Date(d+'T00:00:00').getDate();
    await DB.add('subscriptions',{id:id(),name,amount:amt,billingDay,nextBillingDate:d,status:'active',createdAt:new Date().toISOString()});
    closeSheet();toast('Subscription added ✓');refresh();syncReminderMetadata();
  };
};

/* ---------- Clients & Income ---------- */
$('#addClientBtn').onclick=()=>{
  openSheet(`<button class="close-x" onclick="closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>Add Client</h2><p class="sub">Only the client name is needed.</p>
    <label class="field-label">Client Name</label><input class="text-input" id="clientName" placeholder="Client name">
    <button class="primary-btn" id="saveClient">Save Client</button>`);
  $('#saveClient').onclick=async()=>{
    const name=$('#clientName').value.trim(); if(!name){toast('Enter a name');return;}
    const clients=await DB.all('clients');
    if(clients.some(c=>normalize(c.name)===normalize(name))){toast('Client already exists');return;}
    await DB.add('clients',{id:id(),name,createdAt:new Date().toISOString()});
    closeSheet();toast('Client added ✓');refresh();
  };
};
$('#addIncomeBtn').onclick=async()=>{
  const clients=await DB.all('clients');
  if(!clients.length){toast('Add a client first');$('#addClientBtn').click();return;}
  openSheet(`<button class="close-x" onclick="closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>Add Income</h2><p class="sub">Record only after full payment is received. Date/time captured automatically.</p>
    <label class="field-label">Amount received (₹)</label><input class="text-input" id="incAmt" type="number" inputmode="decimal" placeholder="5000">
    <label class="field-label">Client</label><select class="text-input" id="incClient">${clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <label class="field-label">Thumbnails delivered</label><input class="text-input" id="incThumbs" type="number" inputmode="numeric" placeholder="10">
    <button class="primary-btn" id="saveIncome">Save Income</button>`);
  $('#saveIncome').onclick=async()=>{
    const amt=parseFloat($('#incAmt').value), cid=$('#incClient').value, th=Number($('#incThumbs').value);
    if(!Number.isFinite(amt)||amt<=0||!clients.some(c=>c.id===cid)||!Number.isInteger(th)||th<=0){toast('Amount, client & thumbnails are required');return;}
    const now=new Date();
    await DB.add('income',{id:id(),amount:amt,clientId:cid,thumbnails:th,date:now.toISOString(),month:monthKey(now)});
    closeSheet();toast('Income added ✓');refresh();
  };
};

/* ---------- Profile / Settings ---------- */
$('#profileBtn').onclick=()=>{
  openSheet(`<button class="close-x" onclick="closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>Profile &amp; Settings</h2><p class="sub">EasyFin v1.0 · All financial data stays on this device (IndexedDB).</p>
    <button class="ghost-btn" id="setExport">Export Backup</button>
    <button class="ghost-btn" id="setImport">Import Backup</button>
    <button class="ghost-btn" id="setBackTap">Quick Setup · iPhone &amp; Back Tap</button>
    <button class="ghost-btn" id="setPush">Enable Notifications</button>
    <label class="field-label" for="setTheme">Appearance</label><select class="text-input" id="setTheme"><option value="light">Light</option><option value="dark">Dark</option></select>
    <input type="file" id="importFile" accept="application/json" hidden>
    <p class="note" style="margin-top:10px">Notifications are optional. If denied, pending subscriptions still show inside the app.</p>`);
  $('#setExport').onclick=exportBackup;
  $('#setImport').onclick=()=>$('#importFile').click();
  $('#setBackTap').onclick=openBackTapGuide;
  $('#setPush').onclick=enablePush;
  $('#setTheme').value=document.documentElement.dataset.theme;$('#setTheme').onchange=e=>applyTheme(e.target.value);
  $('#importFile').onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);};
};
async function exportBackup(){
  const data={app:'EasyFin',schemaVersion:1,exportedAt:new Date().toISOString(),
    expenses:await DB.all('expenses'),income:await DB.all('income'),clients:await DB.all('clients'),
    subscriptions:await DB.all('subscriptions'),subscriptionPayments:await DB.all('subscriptionPayments'),
    categoryKeywords:await DB.all('categoryKeywords'),settings:await DB.all('settings')};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='easyfin-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  toast('Backup exported ✓');
}
async function importBackup(file){
  let data; try{data=JSON.parse(await file.text());}catch(e){toast('Invalid file');return;}
  try{validateBackup(data);}catch(e){toast(e.message);return;}
  const counts=`${data.expenses.length} expenses · ${data.income.length} income · ${data.clients.length} clients · ${data.subscriptions.length} subscriptions`;
  openSheet(`<button class="close-x" onclick="closeSheet()" style="position:absolute;top:14px;right:14px">✕</button>
    <h2>Restore backup?</h2><p class="sub">Exported ${esc(data.exportedAt||'unknown')}.<br>${counts}</p>
    <button class="primary-btn" id="impReplace">Replace all data</button>
    <button class="ghost-btn" id="impMerge">Merge (keep existing)</button>`);
  const apply=async(replace)=>{
    $('#impReplace').disabled=true;$('#impMerge').disabled=true;
    try{await DB.restore(data,replace);await initTheme();}catch(e){toast('Restore failed; no changes were made.');$('#impReplace').disabled=false;$('#impMerge').disabled=false;return;}
    closeSheet();toast('Restored ✓');refresh();
  };
  $('#impReplace').onclick=()=>apply(true); $('#impMerge').onclick=()=>apply(false);
}
function openBackTapGuide(){showOnboarding(0);}
const setupPath='Settings → Accessibility → Touch → Back Tap';
function showOnboarding(step=0){
  const pages=[
    ['A little clarity.\nEvery day.','Welcome to EasyFin','Your money, without the noise. Capture expenses in seconds, track client income and stay on top of subscriptions. Private by design. Stored on this device.'],
    ['Your finances.\nOne tap away.','Install on iPhone','Open EasyFin in Safari on your iPhone. Tap Share → Add to Home Screen → Add. If “Open as Web App” appears, enable it. Then launch EasyFin from its new Home Screen icon. Use Safari for this installation flow, not an unsupported browser tab.'],
    ['Two taps.\nOne less thing.','Double Back Tap','In Apple Shortcuts, create “EasyFin Quick Add”. Add a URL action with '+location.origin+'/?view=quick-add, then an Open URLs action. Next: '+setupPath+' → Double Tap → EasyFin Quick Add. Unlock your iPhone before entering an expense.'],
    ['Your own\nquick menu.','Triple Back Tap','Create “EasyFin Quick Menu” in Shortcuts using Choose from Menu: Today’s Expenses, This Week’s Overview, This Month’s Expenses, Open EasyFin. In each branch, use Open URLs with '+location.origin+'/?view= followed by today, week, month or home. Then '+setupPath+' → Triple Tap → EasyFin Quick Menu.']
  ];
  const p=pages[step];
  openSheet(`<div class="onboarding"><div class="setup-top"><span class="hero-eyebrow">EASYFIN / QUICK SETUP</span><button class="chip" id="skipSetup">Skip</button></div><div class="setup-mark">${['↗','＋','Ⅱ','Ⅲ'][step]}</div><p class="hero-eyebrow">${step+1} OF 4 · ${p[1]}</p><h2>${p[0].replace('\n','<br>')}</h2><p class="sub">${esc(p[2])}</p>${step>1?'<p class="note">Shortcuts cannot read the closed app’s IndexedDB. EasyFin loads data after opening. Open URLs may open Safari rather than the installed app; use the Home Screen icon as the reliable fallback. No automatic installation or unsupported settings redirect is provided.</p><button class="ghost-btn" id="copySetup">Copy settings path</button>':''}<div class="setup-dots">${pages.map((_,i)=>`<span class="${i===step?'selected':''}"></span>`).join('')}</div><button class="primary-btn" id="nextSetup">${step===3?'Finish setup':step===0?'Quick Setup':'Continue'} →</button>${step?'<button class="ghost-btn" id="prevSetup">Back</button>':''}</div>`);
  const finish=()=>{localStorage.setItem('easyfin-onboarded','1');closeSheet();};
  $('#skipSetup').onclick=finish;$('#nextSetup').onclick=step===3?finish:()=>showOnboarding(step+1);
  if(step)$('#prevSetup').onclick=()=>showOnboarding(step-1);
  if($('#copySetup'))$('#copySetup').onclick=async()=>{try{await navigator.clipboard.writeText(setupPath);toast('Settings path copied');}catch{toast(setupPath);}};
}
async function enablePush(){
  toast('Closed-app reminders are not configured. Check subscriptions inside EasyFin.');
}

/* ---------- Deep links (Shortcuts handoff) ---------- */
function handleDeepLink(){
  const p=new URLSearchParams(location.search);
  const view=p.get('view')||p.get('action');
  const map={'quick-add':'home','home':'home','today':'expenses','week':'expenses','month':'expenses','expenses':'expenses','income':'income','dashboard':'dashboard','subs':'subs','subscriptions':'subs'};
  if(view&&map[view])go(map[view]);
  else go('home');
  if(view==='today'||view==='week'){state.period=view;renderExpenses();}
  if(view==='month'){state.expMonth=monthKey(new Date());renderExpenses();}
  history.replaceState(null,'',location.pathname);
}

/* ---------- Init ---------- */
(async()=>{
  $('#topEyebrow').textContent=greeting();
  await initTheme();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  handleDeepLink();
  await refresh();
  if(!localStorage.getItem('easyfin-onboarded'))showOnboarding();
})().catch(e=>{console.error(e);toast('Unable to open local storage. Please allow device storage and reload.');});
