import {test, expect, type Browser} from '@playwright/test';
import {TOUR_STORAGE_KEY} from '../../lib/tour';

const SHORT_VIEWPORT = {width: 1024, height: 570};

async function shortPage(browser: Browser, tourDone = true) {
  const context = await browser.newContext({viewport: SHORT_VIEWPORT});
  if (tourDone) {
    await context.addInitScript(key => localStorage.setItem(key, 'done'), TOUR_STORAGE_KEY);
  }
  const page = await context.newPage();
  return {context, page};
}

test('1024×570: rex launcher clears LIVE badge and audience scores', async ({browser}) => {
  const {context, page} = await shortPage(browser);
  await page.goto('/');
  await page.getByRole('tab', {name: 'Build for an audience'}).click();
  await page.evaluate(() => window.scrollTo(0, 100));
  const buildOverlap = await page.evaluate(() => {
    const overlap = (a: DOMRect, b: DOMRect) =>
      a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const launcher = document.querySelector('.rex-launcher')?.getBoundingClientRect();
    const live = [...document.querySelectorAll('.tag')].find(t => t.textContent?.includes('LIVE'))?.getBoundingClientRect();
    return !!(launcher && live && overlap(launcher, live));
  });
  expect(buildOverlap).toBe(false);

  await page.getByRole('tab', {name: 'Analyze a post'}).click();
  await page.evaluate(() => window.scrollTo(0, 850));
  const scoreOverlap = await page.evaluate(() => {
    const overlap = (a: DOMRect, b: DOMRect) =>
      a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const launcher = document.querySelector('.rex-launcher')?.getBoundingClientRect();
    const scores = [...document.querySelectorAll('.result-list .score')].map(s => s.getBoundingClientRect());
    return scores.some(score => launcher && overlap(launcher, score));
  });
  expect(scoreOverlap).toBe(false);
  await context.close();
});

test('1024×570: sidebar tagline is hidden or fully visible', async ({browser}) => {
  const {context, page} = await shortPage(browser);
  await page.goto('/');
  const clipped = await page.evaluate(() => {
    const note = document.querySelector('.sidebar-note');
    if (!note || getComputedStyle(note).display === 'none') return false;
    const p = note.querySelector('p');
    if (!p) return false;
    const rect = p.getBoundingClientRect();
    return rect.bottom > window.innerHeight + 1;
  });
  expect(clipped).toBe(false);
  await context.close();
});

test('1024×570: first-visit tour avoids writing model controls', async ({browser}) => {
  const {context, page} = await shortPage(browser, false);
  await page.goto('/');
  await expect(page.locator('.tour-hint')).toBeVisible();
  const overlapsControls = await page.evaluate(() => {
    const overlap = (a: DOMRect, b: DOMRect) =>
      a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const tour = document.querySelector('.tour-hint')?.getBoundingClientRect();
    const controls = [
      document.querySelector('.model-picker select'),
      document.querySelector('.model-picker input[type="search"]'),
      document.querySelector('.model-picker'),
    ]
      .filter(Boolean)
      .map(el => el!.getBoundingClientRect());
    return controls.some(rect => tour && overlap(tour, rect));
  });
  expect(overlapsControls).toBe(false);
  await context.close();
});

test('1024×570: no extra fixed controls on the right edge besides Rex', async ({browser}) => {
  const {context, page} = await shortPage(browser);
  await page.goto('/');
  const extraFixed = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter(button => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.position === 'fixed' && rect.right > window.innerWidth - 4 && !button.classList.contains('rex-launcher');
    }).map(button => button.className),
  );
  expect(extraFixed).toEqual([]);
  await context.close();
});
