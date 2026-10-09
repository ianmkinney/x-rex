import {test, expect} from '@playwright/test';
import {draftFixture} from './draft-fixture';
import {TOUR_STORAGE_KEY} from '../../lib/tour';

test('first-visit tour is non-blocking, supports paging, localStorage dismissal, and replay', async ({page}, testInfo) => {
  await page.goto('/');
  const tour = page.getByRole('status', {name: 'Quick tour tip'});
  await expect(tour).toBeVisible();
  await expect(page.getByLabel('Post text')).toBeEditable();

  await page.getByRole('button', {name: 'Next', exact: true}).click();
  await expect(tour).toContainText('Make it sound like you.');
  await page.getByRole('button', {name: 'Back', exact: true}).click();
  await expect(tour).toContainText('Meet your writing sidekick.');
  await page.screenshot({path: `test-results/${testInfo.project.name}-tour.png`});

  await page.getByRole('button', {name: 'Dismiss', exact: true}).click();
  await expect(tour).not.toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), TOUR_STORAGE_KEY)).toBe('done');

  await page.reload();
  await expect(tour).not.toBeVisible();
  await expect(page.getByLabel('Post text')).toBeEditable();

  await page.getByRole('button', {name: 'Quick tour', exact: true}).click();
  await expect(tour).toBeVisible();
  await page.getByRole('button', {name: 'Go to tour step 5'}).click();
  await page.getByRole('button', {name: 'Got it'}).click();
  await expect(tour).not.toBeVisible();
});

test('rex launcher stays clear of the post input', async ({page}) => {
  await page.addInitScript(key => localStorage.setItem(key, 'done'), TOUR_STORAGE_KEY);
  await page.goto('/');
  const overlap = await page.evaluate(() => {
    const input = document.querySelector<HTMLElement>('#post');
    const launcher = document.querySelector<HTMLElement>('.rex-launcher');
    if (!input || !launcher) return true;
    const a = input.getBoundingClientRect();
    const b = launcher.getBoundingClientRect();
    const intersects = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return intersects;
  });
  expect(overlap).toBe(false);
});

test('saved writer voice reaches both briefs and can be removed; X-Rex navigates with user clicks', async ({page, context}, testInfo) => {
  await page.addInitScript(key => localStorage.setItem(key, 'done'), TOUR_STORAGE_KEY);
  await page.route('**/api/models', r => r.fulfill({json: {models: []}}));
  await page.route('**/api/profile', r => r.fulfill({json: {profile: {username: 'myvoice', name: 'My Voice', bio: 'Chef', posts: [{id: '1', text: 'Tiny fix. Big relief. That’s my kind of Tuesday.'}], source: 'x-api'}}}));
  const calls: Record<string, unknown>[] = [];
  await page.route('**/api/ai', r => {
    const data = r.request().postDataJSON();
    calls.push(data);
    return r.fulfill({json: data.action === 'help' ? {reply: 'Start with the audience builder. Pick restaurant owners, then add your topic.', actions: ['create']} : draftFixture});
  });
  await page.goto('/');
  await page.locator('.writer-profile summary').click();
  await page.getByLabel('Your X profile', {exact: true}).fill('@myvoice');
  await page.getByRole('button', {name: 'Import my posts'}).click();
  await expect(page.getByLabel('Your writing examples')).toHaveValue(/Tiny fix/);
  await page.getByRole('button', {name: 'Save my voice'}).click();
  await page.reload();
  await expect(page.locator('.writer-profile summary')).toContainText('@myvoice · Voice applied');
  await page.getByRole('tab', {name: 'Build for an audience'}).click();
  await expect(page.getByLabel('Generated prompt')).toHaveValue(/Tiny fix/);
  await page.getByRole('button', {name: 'Generate posts', exact: true}).click();
  await expect(page.getByLabel('Post option 1', {exact: true})).toBeVisible();
  expect(calls[0].prompt).toContain('Tiny fix');
  await page.getByRole('tab', {name: 'Target a profile'}).click();
  await page.getByLabel('X profile URL or handle').fill('reader');
  await page.getByLabel('Public bio', {exact: true}).fill('Restaurant owner');
  await page.getByRole('button', {name: 'Use pasted public text'}).click();
  await expect(page.getByLabel('Profile generation prompt')).toHaveValue(/Tiny fix/);
  await page.getByRole('button', {name: 'Talk to X-Rex', exact: true}).click();
  const chat = page.getByRole('dialog', {name: 'Talk to X-Rex'});
  await expect(chat).toBeVisible();
  await page.getByLabel('Ask X-Rex').fill('How can I write for restaurant owners?');
  await page.getByRole('button', {name: 'Send to X-Rex'}).click();
  await expect(chat).toContainText('Start with the audience builder.');
  expect(JSON.stringify(calls.at(-1))).not.toContain('Tiny fix');
  await page.screenshot({path: `test-results/${testInfo.project.name}-rex-chat.png`});
  await chat.getByRole('button', {name: 'Build for an audience', exact: true}).last().click();
  await expect(chat).not.toBeVisible();
  await expect(page.getByRole('tab', {name: 'Build for an audience'})).toHaveAttribute('aria-selected', 'true');
  await page.locator('.writer-profile summary').click();
  await page.getByRole('button', {name: 'Remove voice'}).click();
  await expect(page.getByLabel('Generated prompt')).not.toHaveValue(/Tiny fix/);
  expect(await page.evaluate(() => localStorage.getItem('xrex:voice:v1'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
