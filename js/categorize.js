/* Keyword categorisation engine — local only, no AI */
const CATEGORIES=[
  {id:'food',label:'Food',icon:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v7c0 3 5 3 5 0V3M6.5 3v18M17 3c-4 5-4 10 0 10V3Zm0 10v8"/></svg>'},
  {id:'travel',label:'Travel',icon:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14V5H5v12Zm0-9h14M8 21l2-4m6 4-2-4M8 13h.01M16 13h.01"/></svg>'},
  {id:'shopping',label:'Shopping',icon:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16l-1 14H5L4 7Zm4 0V6a4 4 0 0 1 8 0v1"/></svg>'},
  {id:'movies',label:'Movies',icon:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18v13H3V8Zm0 0V3h18v5M7 3l3 5m4-5 3 5"/></svg>'},
  {id:'subscriptions',label:'Subscriptions',icon:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a8 8 0 0 1 14-2l2 2M20 3v5h-5M20 16a8 8 0 0 1-14 2l-2-2M4 21v-5h5"/></svg>'},
  {id:'gifts',label:'Gifts',icon:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18v4H3V8Zm2 4v9h14v-9M12 8v13M12 8C3 8 6 0 12 8Zm0 0c9 0 6-8 0 0"/></svg>'},
];
const BUILTIN_KEYWORDS={
  food:["mcdonald","mcd","burger king","pizza hut","domino","restaurant","cafe","coffee","starbucks","snack","food","lunch","dinner","breakfast","zomato","swiggy","dosa","biryani","chai","tea","juice","bakery","kfc","subway","taco","sushi","grocery","vegetable","fruit","milk","bread","chocolate","ice cream","dinner","lunch"],
  travel:["railway","train","metro","bus","rickshaw","auto","ola","uber","cab","taxi","travel","ticket","flight","airline","petrol","fuel","parking","toll","irctc","fastag","rapido","yulu"],
  shopping:["cloth","clothing","shirt","pants","shoe","sneaker","accessor","shopping","electronic","phone","laptop","headphone","amazon","flipkart","myntra","zara","h&m","mall","store","watch","bag","sunglasses","perfume","makeup","book"],
  movies:["movie","cinema","pvr","inox","film","ticket","bookmyshow","bms","popcorn","theatre","theater"],
  subscriptions:["netflix","chatgpt","picsart","subscription","premium","spotify","youtube premium","apple","icloud","prime","hotstar","disney","canva","adobe","notion","gym membership","membership"],
  gifts:["gift","birthday gift","present","anniversary gift","bouquet","flowers","chocolate gift"]
};
function normalize(s){return String(s||'').toLowerCase().trim().replace(/\s+/g,' ');}
async function categorize(description){
  const text=normalize(description); if(!text) return null;
  // 1) user-learned mappings (exact keyword match preferred)
  try{
    const learned=await DB.all('categoryKeywords');
    for(const k of learned){ if(text===normalize(k.keyword)) return k.category; }
    for(const k of learned){ if(text.includes(normalize(k.keyword))) return k.category; }
  }catch(e){}
  // 2) built-in dictionary — longest keyword wins to avoid false positives
  let best=null,bestLen=0;
  for(const [cat,words] of Object.entries(BUILTIN_KEYWORDS)){
    for(const w of words){ const nw=normalize(w);
      if(text===nw||text.includes(nw)){ if(nw.length>bestLen){best=cat;bestLen=nw.length;} }
    }
  }
  return best;
}
async function rememberKeyword(keyword,category){
  const kw=normalize(keyword); if(!kw) return;
  await DB.put('categoryKeywords',{keyword:kw,category,updatedAt:new Date().toISOString()});
}
