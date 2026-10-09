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

test('1024×570: audience scores sort descending on Analyze', async ({browser}) => {
  const {context, page} = await shortPage(browser);
  await page.goto('/');
  const scores = await page.locator('.result-list .score').evaluateAll(els =>
    els.map(el => Number(el.firstChild?.textContent?.trim() || 'NaN')).filter(n => !Number.isNaN(n)),
  );
  for (let i = 1; i < scores.length; i++) {
    expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
  }
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

test('1024×570: first-visit tour avoids tabs, heading, and inner scroll', async ({browser}) => {
  const {context, page} = await shortPage(browser, false);
  await page.goto('/');
  await expect(page.locator('.tour-hint')).toBeVisible();
  const layout = await page.evaluate(() => {
    const overlap = (a: DOMRect, b: DOMRect) =>
      a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const tour = document.querySelector('.tour-hint');
    if (!tour) return {tabs: true, heading: true, innerScroll: true};
    const tourRect = tour.getBoundingClientRect();
    const style = getComputedStyle(tour);
    const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
    const heading = document.querySelector('.page-heading h1')?.getBoundingClientRect();
    const innerScroll =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') && tour.scrollHeight > tour.clientHeight + 1;
    return {
      tabs: !!(tabs && overlap(tourRect, tabs)),
      heading: !!(heading && overlap(tourRect, heading)),
      innerScroll,
    };
  });
  expect(layout.tabs).toBe(false);
  expect(layout.heading).toBe(false);
  expect(layout.innerScroll).toBe(false);
  await context.close();
});

test('1024×570: Quick tour avoids tabs, heading, and inner scroll', async ({browser}) => {
  const {context, page} = await shortPage(browser, true);
  await page.goto('/');
  await page.getByRole('button', {name: 'Quick tour', exact: true}).click();
  await expect(page.locator('.tour-hint')).toBeVisible();
  const layout = await page.evaluate(() => {
    const overlap = (a: DOMRect, b: DOMRect) =>
      a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const tour = document.querySelector('.tour-hint');
    if (!tour) return {tabs: true, heading: true, innerScroll: true};
    const tourRect = tour.getBoundingClientRect();
    const style = getComputedStyle(tour);
    const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
    const heading = document.querySelector('.page-heading h1')?.getBoundingClientRect();
    const innerScroll =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') && tour.scrollHeight > tour.clientHeight + 1;
    return {
      tabs: !!(tabs && overlap(tourRect, tabs)),
      heading: !!(heading && overlap(tourRect, heading)),
      innerScroll,
    };
  });
  expect(layout.tabs).toBe(false);
  expect(layout.heading).toBe(false);
  expect(layout.innerScroll).toBe(false);
  await context.close();
});
