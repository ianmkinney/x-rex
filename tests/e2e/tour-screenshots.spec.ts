import {test, expect} from '@playwright/test';
import path from 'node:path';
import {TOUR_STORAGE_KEY} from '../../lib/tour';
import {tourStepQualityCheck} from './tour-layout';

const VIEWPORTS = [
  {name: '1280x713', width: 1280, height: 713},
  {name: '390x844', width: 390, height: 844},
];

const OUT_DIR = path.join('test-results', 'tour-screenshots');

for (const viewport of VIEWPORTS) {
  test(`tour screenshots: ${viewport.name}`, async ({browser}) => {
    const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}});
    await context.addInitScript(key => localStorage.setItem(key, 'done'), TOUR_STORAGE_KEY);
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', {name: 'Quick tour', exact: true}).click();
    const tour = page.getByRole('status', {name: 'Quick tour tip'});
    await expect(tour).toBeVisible();

    for (let step = 1; step <= 5; step++) {
      await expect.poll(async () => {
        const layout = await page.evaluate(tourStepQualityCheck);
        return layout.anchoredBottomRight && layout.bodyWithoutScroll && layout.bodyVisible;
      }).toBe(true);
      const layout = await page.evaluate(tourStepQualityCheck);
      expect(layout.anchoredBottomRight).toBe(true);
      expect(layout.bodyWithoutScroll).toBe(true);
      expect(layout.titleDotsOverlap).toBe(false);
      expect(layout.cardInnerScroll).toBe(false);
      if (viewport.width >= 1000) {
        expect(layout.cardHeight).toBeLessThanOrEqual(270);
      }
      const file = path.join(OUT_DIR, `${viewport.name}-step-${step}.png`);
      await page.screenshot({path: file, fullPage: false});
      if (step < 5) {
        await tour.getByRole('button', {name: 'Next', exact: true}).click();
      }
    }
    await context.close();
  });
}
