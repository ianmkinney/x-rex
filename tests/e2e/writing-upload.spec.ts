import {test,expect} from '@playwright/test';
test('upload writing samples, review, save, and reuse after reload',async({page,context})=>{
 await context.addInitScript(key=>localStorage.setItem(key,'done'),'xrex:tour:v2');
 await page.route('**/api/models',route=>route.fulfill({json:{models:[]}}));
 await page.goto('/');
 await page.getByText('Your writing style',{exact:true}).click();
 await page.getByRole('textbox',{name:'Your writing examples',exact:true}).fill('My original example.');
 await page.getByLabel('Upload writing sample files').setInputFiles([
 {name:'voice.txt',mimeType:'text/plain',buffer:Buffer.from('Keep it warm. A little wit helps. 🦖')},
 {name:'posts.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{text:'An example from my export.'}]))},
 ]);
 await expect(page.getByRole('textbox',{name:'Your writing examples',exact:true})).toHaveValue('My original example.\n\nKeep it warm. A little wit helps. 🦖\n\nAn example from my export.');
 await expect(page.locator('.writer-profile').getByRole('status')).toContainText('2 files imported');
 expect(await page.evaluate(()=>localStorage.getItem('xrex:voice:v1'))).toBeNull();
 await page.getByLabel('Upload writing sample files').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{')});
 await expect(page.locator('.writer-profile').getByRole('alert')).toContainText('not valid JSON');
 await expect(page.getByRole('textbox',{name:'Your writing examples',exact:true})).toHaveValue(/An example from my export\./);
 await page.getByRole('button',{name:'Save my voice',exact:true}).click();
 await page.reload();
 await page.getByRole('tab',{name:'Build for an audience'}).click();
 await expect(page.getByLabel('Generated prompt',{exact:true})).toHaveValue(/An example from my export\./);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
