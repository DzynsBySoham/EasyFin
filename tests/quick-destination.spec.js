const {test,expect}=require('@playwright/test');
async function amount(page,description='coffee'){await page.locator('#qaAmount').fill('145');await page.locator('#qaDesc').fill(description);}
async function drag(page,fraction=1){const slider=page.locator('#qaSlide');await slider.scrollIntoViewIfNeeded();await expect(slider).toHaveAttribute('aria-disabled','false');const b=await slider.boundingBox();await page.mouse.move(b.x+28,b.y+30);await page.mouse.down();await page.mouse.move(b.x+28+(b.width-62)*fraction,b.y+30,{steps:15});await page.mouse.up();}
const records=p=>p.evaluate(()=>DB.all('expenses'));
test('focused route skips onboarding without marking it complete and keeps no navigation',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?action=quick-add');await expect(page.locator('#quickTitle')).toBeVisible();
  await expect(page.locator('.dock')).toBeHidden();await expect(page.locator('.topbar')).toBeHidden();await expect(page.locator('.hero-card')).toBeHidden();
  await expect(page.locator('#overlay')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('easyfin-onboarded'))).toBeNull();
  await page.evaluate(()=>handleDeepLink());await amount(page);await expect(page.locator('#qaCategoryText')).toHaveText('Food');
  await drag(page);await expect.poll(async()=> (await records(page)).length).toBe(1);
  await page.reload();await expect(page.locator('#quickTitle')).toBeVisible();expect((await records(page)).length).toBe(1);
  await page.locator('#quickClose').click();await expect(page.locator('#view-expenses')).toBeVisible();await expect(page.locator('#expenseList')).toContainText('coffee');
  await page.locator('[data-view="dashboard"]').click();await expect(page.locator('#dashExpenses')).toHaveText('₹145');
  await page.locator('[data-view="balance"]').click();await expect(page.locator('#balValue')).toHaveText('₹-145');
  expect(errors).toEqual([]);
});
test('unknown category does not save until selection AND a complete slide',async({page})=>{
  await page.goto('/?action=quick-add');await amount(page,'qzxunknown');await expect(page.locator('#qaSlide')).toHaveAttribute('aria-disabled','true');
  await page.locator('#qaCategoryBtn').click();await page.locator('[data-cat="gifts"]').click();expect((await records(page)).length).toBe(0);
  await drag(page,.6);expect((await records(page)).length).toBe(0);await drag(page);await expect.poll(async()=> (await records(page)).length).toBe(1);
  expect((await records(page))[0].category).toBe('gifts');
});
test('focused X discards, normal first launch onboarding still appears later',async({page})=>{
  await page.goto('/?action=quick-add');await amount(page);await page.locator('#quickClose').click();expect((await records(page)).length).toBe(0);
  await expect(page.locator('.dock')).toBeVisible();await expect(page.locator('#qaAmount')).toHaveValue('');
  await page.goto('/');await expect(page.locator('#nextSetup')).toBeVisible();
});
test('focused theme persistence, small/landscape layouts and offline route',async({page,context})=>{
  await page.goto('/?action=quick-add');await page.evaluate(()=>applyTheme('dark'));await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  for(const theme of ['dark','light']){await page.evaluate(t=>applyTheme(t),theme);for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#qaAmount')).toBeVisible();}}
  await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.goto('/?action=quick-add');await amount(page);await drag(page);await expect.poll(async()=> (await records(page)).length).toBe(1);await page.reload();expect((await records(page)).length).toBe(1);
});
test('page headers and required filter order have no redundant branding or dot',async({page})=>{
  await page.goto('/?action=expenses');await page.locator('#skipSetup').click();
  await expect(page.locator('#view-expenses h1')).toHaveText('Expenses');await expect(page.locator('.topbar')).toBeHidden();await expect(page.locator('#subsBadge')).toBeEmpty();
  expect(await page.locator('#catChips button').allTextContents()).toEqual(['All','Food','Travel','Shopping','Movies','Gifts','Subscriptions']);
  expect(await page.locator('#subsBadge').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.locator('#dockSettings').click();await expect(page.locator('#setTheme')).toBeVisible();
});
test('atomic client duplicate prevention across simultaneous writes and reload',async({page})=>{
  await page.goto('/?action=quick-add');const result=await page.evaluate(()=>Promise.all([DB.addClient(' Studio '),DB.addClient('studio'),DB.addClient('STUDIO')]));expect(result.filter(Boolean)).toHaveLength(1);
  await page.reload();expect(await page.evaluate(()=>DB.all('clients').then(c=>c.length))).toBe(1);
  await page.locator('#quickClose').click();await page.locator('[data-view="income"]').click();await expect(page.locator('#clientChips')).toContainText('Studio');
});
test('failed client save retains form and reports error instead of silent failure',async({page})=>{
  await page.goto('/?action=quick-add');await page.locator('#quickClose').click();await page.locator('[data-view="income"]').click();await page.locator('#addClientBtn').click();await page.locator('#clientName').fill('Client');
  await page.evaluate(()=>{window.realClient=DB.addClient;DB.addClient=()=>Promise.reject(new Error('Controlled client write failure'));});await page.locator('#saveClient').click();await expect(page.locator('#toast')).toContainText('Could not save');await expect(page.locator('#clientName')).toHaveValue('Client');await expect(page.locator('#saveClient')).toBeEnabled();
  await page.evaluate(()=>DB.addClient=window.realClient);await page.locator('#saveClient').click();await expect(page.locator('#overlay')).toBeHidden();expect(await page.evaluate(()=>DB.all('clients').then(c=>c.length))).toBe(1);
});
