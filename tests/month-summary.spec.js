const {test,expect}=require('@playwright/test');
async function ready(page){await page.goto('/?action=quick-add');await expect(page.locator('#quickTitle')).toBeVisible();await page.locator('#quickClose').click();}
async function seed(page){await page.evaluate(async()=>{
  await DB.add('clients',{id:'a',name:'Studio A'});await DB.add('clients',{id:'b',name:'Studio B'});
  for(const [id,amount,category,month] of [['e1',10.5,'food','2025-11'],['e2',20,'travel','2025-11'],['e3',5,'food','2025-10']])await DB.add('expenses',{id,amount,description:id,category,month,date:month+'-10T12:00:00Z'});
  for(const [id,amount,clientId,month] of [['i1',1000,'a','2025-11'],['i2',2000,'b','2025-11'],['i3',500,'a','2025-09']])await DB.add('income',{id,amount,clientId,thumbnails:2,month,date:month+'-11T12:00:00Z'});
  await refresh();
});}
test('expenses show selected month total independently from category subtotal',async({page})=>{
  await ready(page);await seed(page);await expect(page.locator('#expenseTotal')).toHaveText('₹35.5');
  await page.locator('#expenseMonth').selectOption('2025-11');await expect(page.locator('#expenseTotalLabel')).toHaveText('Total expenses · November 2025');await expect(page.locator('#expenseTotal')).toHaveText('₹30.5');
  await page.locator('#catChips [data-c="food"]').click();await expect(page.locator('#expenseFilteredTotal')).toHaveText('Food · ₹10.5');await expect(page.locator('#expenseTotal')).toHaveText('₹30.5');
  await page.locator('#expenseMonth').selectOption('2025-10');await expect(page.locator('#expenseTotal')).toHaveText('₹5');await expect(page.locator('#expenseFilteredTotal')).toHaveText('Food · ₹5');await expect(page.locator('#catChips [data-c="food"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#expenseMonth').selectOption('2025-09');await expect(page.locator('#expenseTotal')).toHaveText('₹0');await expect(page.locator('#expenseFilteredTotal')).toHaveText('Food · ₹0');
  await page.locator('#expenseMonth').selectOption('all');await expect(page.locator('#expenseTotal')).toHaveText('₹35.5');await expect(page.locator('#expenseFilteredTotal')).toHaveText('Food · ₹15.5');await page.locator('#catChips [data-c="all"]').click();await expect(page.locator('#expenseFilteredTotal')).toBeHidden();
});
test('income shows selected month total and keeps client filter independent',async({page})=>{
  await ready(page);await seed(page);await page.locator('[data-view="income"]').click();await expect(page.locator('#incomeTotal')).toHaveText('₹3,500');
  await page.locator('#incomeMonth').selectOption('2025-11');await expect(page.locator('#incomeTotalLabel')).toHaveText('Total income · November 2025');await expect(page.locator('#incomeTotal')).toHaveText('₹3,000');
  await page.locator('#clientChips [data-c="a"]').click();await expect(page.locator('#incomeFilteredTotal')).toHaveText('Studio A · ₹1,000');await expect(page.locator('#incomeTotal')).toHaveText('₹3,000');
  await page.locator('#incomeMonth').selectOption('2025-09');await expect(page.locator('#incomeTotal')).toHaveText('₹500');await expect(page.locator('#incomeFilteredTotal')).toHaveText('Studio A · ₹500');await expect(page.locator('#clientChips [data-c="a"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#clientChips [data-c="b"]').click();await expect(page.locator('#incomeTotal')).toHaveText('₹500');await expect(page.locator('#incomeFilteredTotal')).toHaveText('Studio B · ₹0');await expect(page.locator('#incomeMonth')).toHaveValue('2025-09');
  await page.locator('#incomeMonth').selectOption('2025-10');await expect(page.locator('#incomeTotal')).toHaveText('₹0');await page.locator('#clientChips [data-c="all"]').click();await expect(page.locator('#incomeFilteredTotal')).toBeHidden();
});
test('removed header and filler copy stay absent, category action stays functional',async({page})=>{
  await page.goto('/?action=quick-add');await expect(page.locator('.topbar,#profileBtn,#themeBtn,#avatarInitial,#subsBadge,#qaHint')).toHaveCount(0);
  await expect(page.getByText('Amount, what it was for — we handle the rest.')).toHaveCount(0);await expect(page.getByText('Category is detected as you type')).toHaveCount(0);await expect(page.getByText('Choose a category when an item is unknown.')).toHaveCount(0);
  await expect(page.locator('#qaCategoryBtn')).toBeHidden();await page.locator('#qaDesc').fill('coffee');await expect(page.locator('#qaCategoryText')).toHaveText('Food');await expect(page.locator('#qaCategoryBtn')).toBeVisible();await page.locator('#qaDesc').fill('');await expect(page.locator('#qaCategoryBtn')).toBeHidden();
  await page.locator('#quickClose').click();await page.locator('[data-view="home"]').click();await expect(page.locator('.quick-page-heading h1')).toHaveText('Quick Add');await page.locator('#dockSettings').click();await expect(page.locator('#setTheme')).toBeVisible();
});
test('all filters fit their panel in both themes at narrow and desktop widths',async({page})=>{
  await ready(page);await seed(page);
  await page.evaluate(()=>DB.add('clients',{id:'long',name:'A very long client name that must wrap without clipping the filter panel'}));
  for(const theme of ['light','dark']){await page.evaluate(t=>applyTheme(t),theme);for(const width of [320,390,827,1280]){await page.setViewportSize({width,height:844});for(const view of ['expenses','income']){
    await page.evaluate(v=>go(v),view);const panel=page.locator('#view-'+view+' .filter-panel');const bounds=await panel.boundingBox();const filters=page.locator('#view-'+view+' .filter-panel button');await expect(filters.first()).toBeVisible();
    for(const button of await filters.all()){const box=await button.boundingBox();expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height+1);expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }}}
});
test('month totals refresh after real new expense and income saves',async({page})=>{
  await ready(page);await page.locator('[data-view="home"]').click();await page.locator('#qaAmount').fill('90');await page.locator('#qaDesc').fill('coffee');await expect(page.locator('#qaSlide')).toHaveAttribute('aria-disabled','false');
  await page.locator('#qaSlide').focus();for(let i=0;i<10;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('#toast')).toHaveText('Expense saved');await page.locator('[data-view="expenses"]').click();await expect(page.locator('#expenseTotal')).toHaveText('₹90');
  const month=await page.evaluate(()=>monthKey(new Date()));await page.locator('#expenseMonth').selectOption(month);await expect(page.locator('#expenseTotal')).toHaveText('₹90');
  await page.locator('[data-view="income"]').click();await page.locator('#addClientBtn').click();await page.locator('#clientName').fill('New Studio');await page.locator('#saveClient').click();await expect(page.locator('#overlay')).toBeHidden();await page.locator('#addIncomeBtn').click();await page.locator('#incAmt').fill('400');await page.locator('#incThumbs').fill('2');await page.locator('#saveIncome').click();await expect(page.locator('#overlay')).toBeHidden();await page.locator('#incomeMonth').selectOption(month);await expect(page.locator('#incomeTotal')).toHaveText('₹400');
});
