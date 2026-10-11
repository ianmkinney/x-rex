export function tourStepQualityCheck() {
  const overlap = (a: DOMRect, b: DOMRect) =>
    a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const tour = document.querySelector('.tour-hint');
  if (!tour) {
    return {
      inViewport: false,
      bodyVisible: false,
      titleDotsOverlap: true,
      tabs: true,
      heading: true,
      writingModel: true,
      labBadge: true,
      voiceButtonInViewport: true,
      cardInnerScroll: true,
      scrollOnBodyRegion: false,
    };
  }
  const tourRect = tour.getBoundingClientRect();
  const cardStyle = getComputedStyle(tour);
  const body = tour.querySelector('.tour-hint-body');
  const bodyStyle = body ? getComputedStyle(body) : null;
  const bodyRect = body?.getBoundingClientRect();
  const cardRect = tour.getBoundingClientRect();
  const inCard = (r: DOMRect | undefined) =>
    !!r && r.bottom > cardRect.top + 0.5 && r.top < cardRect.bottom - 0.5 && r.width > 0;
  const title = tour.querySelector('h2')?.getBoundingClientRect();
  const dots = tour.querySelector('.tour-dots')?.getBoundingClientRect();
  const scrollRegion = tour.querySelector('.tour-hint-scroll');
  const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
  const heading = document.querySelector('.page-heading h1')?.getBoundingClientRect();
  const writingModel = document.querySelector('.model-picker select')?.getBoundingClientRect();
  const labBadge = document.querySelector('.page-heading .version-pill')?.getBoundingClientRect();
  const voiceEl = tour.querySelector('.tour-voice');
  const voiceButton = voiceEl?.getBoundingClientRect();
  const scrollRegionStyle = scrollRegion ? getComputedStyle(scrollRegion) : null;
  const cardInnerScroll =
    (cardStyle.overflowY === 'auto' || cardStyle.overflowY === 'scroll') && tour.scrollHeight > tour.clientHeight + 1;
  const scrollOnBodyRegion = !!(
    scrollRegion &&
    scrollRegionStyle &&
    (scrollRegionStyle.overflowY === 'auto' || scrollRegionStyle.overflowY === 'scroll')
  );
  return {
    inViewport: tourRect.top >= -0.5 && tourRect.bottom <= window.innerHeight + 0.5,
    bodyVisible: !!(
      body &&
      bodyStyle &&
      scrollRegion &&
      scrollRegionStyle &&
      bodyStyle.display !== 'none' &&
      bodyStyle.visibility !== 'hidden' &&
      scrollRegion.clientHeight > 4 &&
      body.textContent?.trim()
    ),
    titleDotsOverlap: !!(title && dots && inCard(title) && inCard(dots) && overlap(title, dots)),
    tabs: !!(tabs && overlap(tourRect, tabs)),
    heading: !!(heading && overlap(tourRect, heading)),
    writingModel: !!(writingModel && overlap(tourRect, writingModel)),
    labBadge: !!(labBadge && overlap(tourRect, labBadge)),
    voiceButtonInViewport: !voiceButton || (voiceButton.top >= 0 && voiceButton.bottom <= window.innerHeight + 0.5),
    cardInnerScroll,
    scrollOnBodyRegion,
  };
}
