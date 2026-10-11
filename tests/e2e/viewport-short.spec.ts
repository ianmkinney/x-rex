import {test, expect, type Browser} from '@playwright/test';
import {TOUR_STORAGE_KEY} from '../../lib/tour';

const SHORT_VIEWPORT = {width: 1024, height: 570};
const DESKTOP_SHORT_VIEWPORT = {width: 1280, height: 713};

function tourOverlapCheck() {
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
}

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
  const layout = await page.evaluate(tourOverlapCheck);
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
  const layout = await page.evaluate(tourOverlapCheck);
  expect(layout.tabs).toBe(false);
  expect(layout.heading).toBe(false);
  expect(layout.innerScroll).toBe(false);
  await context.close();
});

function tourStepQualityCheck() {
  const overlap = (a: DOMRect, b: DOMRect) =>
    a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const tour = document.querySelector('.tour-hint');
  if (!tour) {
    return {bodyVisible: false, titleDotsOverlap: true, tabs: true, heading: true, writingModel: true, labBadge: true, innerScroll: true};
  }
  const tourRect = tour.getBoundingClientRect();
  const style = getComputedStyle(tour);
  const body = tour.querySelector('.tour-hint-body');
  const bodyStyle = body ? getComputedStyle(body) : null;
  const bodyRect = body?.getBoundingClientRect();
  const title = tour.querySelector('h2')?.getBoundingClientRect();
  const dots = tour.querySelector('.tour-dots')?.getBoundingClientRect();
  const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
  const heading = document.querySelector('.page-heading h1')?.getBoundingClientRect();
  const writingModel = document.querySelector('.model-picker select')?.getBoundingClientRect();
  const labBadge = document.querySelector('.page-heading .version-pill')?.getBoundingClientRect();
  const innerScroll =
    (style.overflowY === 'auto' || style.overflowY === 'scroll') && tour.scrollHeight > tour.clientHeight + 1;
  return {
    bodyVisible: !!(
      body &&
      bodyStyle &&
      bodyStyle.display !== 'none' &&
      bodyStyle.visibility !== 'hidden' &&
      (bodyRect?.height ?? 0) > 8 &&
      body.textContent?.trim()
    ),
    titleDotsOverlap: !!(title && dots && overlap(title, dots)),
    tabs: !!(tabs && overlap(tourRect, tabs)),
    heading: !!(heading && overlap(tourRect, heading)),
    writingModel: !!(writingModel && overlap(tourRect, writingModel)),
    labBadge: !!(labBadge && overlap(tourRect, labBadge)),
    innerScroll,
  };
}

test('1280×713: Quick tour stays clear on every step', async ({browser}) => {
  const context = await browser.newContext({viewport: DESKTOP_SHORT_VIEWPORT});
  await context.addInitScript(key => localStorage.setItem(key, 'done'), TOUR_STORAGE_KEY);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', {name: 'Quick tour', exact: true}).click();
  await expect(page.locator('.tour-hint')).toBeVisible();

  for (let step = 1; step <= 5; step++) {
    const layout = await page.evaluate(tourStepQualityCheck);
    expect(layout.bodyVisible).toBe(true);
    expect(layout.titleDotsOverlap).toBe(false);
    expect(layout.tabs).toBe(false);
    expect(layout.heading).toBe(false);
    expect(layout.writingModel).toBe(false);
    expect(layout.labBadge).toBe(false);
    expect(layout.innerScroll).toBe(false);
    if (step < 5) {
      await page.evaluate(() => {
        document.querySelector<HTMLButtonElement>('.tour-hint .tour-actions .primary')?.click();
      });
    }
  }

  const anchoredInResults = await page.evaluate(() => {
    const tour = document.querySelector('.tour-hint');
    const results = document.querySelector('.results-panel');
    if (!tour || !results) return true;
    const tourRect = tour.getBoundingClientRect();
    const resultsRect = results.getBoundingClientRect();
    const sidebar = document.querySelector('.sidebar')?.getBoundingClientRect();
    const sidebarRight = sidebar?.right ?? 0;
    return (
      tourRect.left >= sidebarRight + 8 &&
      tourRect.left >= resultsRect.left - 4 &&
      tourRect.top >= (document.querySelector('.mode-tabs')?.getBoundingClientRect().bottom ?? 0) - 2
    );
  });
  expect(anchoredInResults).toBe(true);
  await context.close();
});
