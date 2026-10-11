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
      modelPickerVisible: false,
      labBadge: true,
      voiceButtonInViewport: true,
      cardInnerScroll: true,
      scrollOnBodyRegion: false,
      bodyWithoutScroll: false,
      footerBackInViewport: false,
      footerPrimaryInViewport: false,
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
  const dotsRect = tour.querySelector('.tour-dots')?.getBoundingClientRect();
  const scrollRegion = tour.querySelector('.tour-hint-scroll');
  const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
  const heading = document.querySelector('.page-heading h1')?.getBoundingClientRect();
  const modelPickerEl = document.querySelector('.model-picker');
  const modelPickerStyle = modelPickerEl ? getComputedStyle(modelPickerEl) : null;
  const modelPickerRect = modelPickerEl?.getBoundingClientRect();
  const pickerControls = modelPickerEl
    ? [...modelPickerEl.querySelectorAll('select, button')]
    : [];
  const writingModel = pickerControls.some(control => overlap(tourRect, control.getBoundingClientRect()));
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
  const footerBack = tour.querySelector('.tour-actions .secondary')?.getBoundingClientRect();
  const footerPrimary = tour.querySelector('.tour-actions .primary')?.getBoundingClientRect();
  const inViewport = (r: DOMRect | undefined) =>
    !!r && r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5 && r.height > 0;
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
    titleDotsOverlap: !!(
      scrollRegion &&
      dotsRect &&
      scrollRegion.getBoundingClientRect().bottom > dotsRect.top + 1
    ),
    tabs: !!(tabs && overlap(tourRect, tabs)),
    heading: !!(heading && overlap(tourRect, heading)),
    writingModel,
    modelPickerVisible: !!(
      modelPickerEl &&
      modelPickerStyle &&
      modelPickerStyle.display !== 'none' &&
      modelPickerStyle.visibility !== 'hidden' &&
      (modelPickerRect?.height ?? 0) > 8 &&
      (modelPickerRect?.width ?? 0) > 8
    ),
    labBadge: !!(labBadge && overlap(tourRect, labBadge)),
    voiceButtonInViewport: !voiceButton || (voiceButton.top >= 0 && voiceButton.bottom <= window.innerHeight + 0.5),
    cardInnerScroll,
    scrollOnBodyRegion,
    bodyWithoutScroll: !!(body && body.scrollHeight <= body.clientHeight + 1),
    footerBackInViewport: inViewport(footerBack),
    footerPrimaryInViewport: inViewport(footerPrimary),
  };
}
