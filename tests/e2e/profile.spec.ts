import {test,expect} from '@playwright/test';
import {TOUR_STORAGE_KEY} from '../../lib/tour';
test.beforeEach(async({context})=>{await context.addInitScript(key=>localStorage.setItem(key,'done'),TOUR_STORAGE_KEY);});
test('public profile tab builds an editable, evidence-based prompt without API credentials',async({page,request},testInfo)=>{
 await page.goto('/');await page.getByRole('tab',{name:'Target a profile'}).click();
 await page.getByLabel('X profile URL or handle').fill('https://x.com/examplechef');
 await page.getByLabel('Public bio',{exact:true}).fill('Restaurant owner and chef.');
 await page.getByLabel('Public post excerpts').fill('Kitchen inventory and better menus reduce food waste.');
 await page.getByRole('button',{name:'Use pasted public text'}).click();
 await expect(page.getByLabel('Interests to write for')).toHaveValue(/restaurant/);
 await page.getByLabel('Your post topic').fill('A daily food waste checklist');
 await expect(page.getByLabel('Profile generation prompt')).toHaveValue(/food waste checklist/);
 await expect(page.getByLabel('Profile generation prompt')).toHaveValue(/not independently verified/);
 await page.screenshot({path:`test-results/${testInfo.project.name}-profile.png`,fullPage:true});
 await page.getByRole('tab',{name:'Analyze a post',exact:true}).click();
 await page.getByRole('tab',{name:'Target a profile'}).click();
 await expect(page.getByLabel('Your post topic')).toHaveValue('A daily food waste checklist');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const missing=await request.post('/api/profile',{data:{profile:'examplechef'}});expect(missing.status()).toBe(503);
 const invalid=await request.post('/api/profile',{data:{profile:'https://evil.test/chef'}});expect(invalid.status()).toBe(400);
 // Explicit mock verifies import UI provenance; it is not a live X API call.
 await page.route('**/api/profile',r=>r.fulfill({json:{profile:{username:'examplechef',name:'Example chef',bio:'Restaurant owner',posts:[{id:'123',text:'Menu planning for a restaurant'}],source:'x-api',fetchedAt:'2026-10-04T16:00:00Z'}}}));
 await page.getByRole('button',{name:'Import public profile'}).click();
 await expect(page.getByText(/Imported from X API/)).toBeVisible();
 await page.getByText('Review post excerpts',{exact:true}).click();
 await expect(page.getByRole('link',{name:'Source post 1'})).toHaveAttribute('href','https://x.com/examplechef/status/123');
});
