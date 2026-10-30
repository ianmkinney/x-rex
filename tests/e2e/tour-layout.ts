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
      bodyWithoutScroll: false,
      footerBackInViewport: false,
      footerPrimaryInViewport: false,
      anchoredBottomRight: false,
      cardHeight: 0,
    };
  }
  const tourRect = tour.getBoundingClientRect();
  const cardStyle = getComputedStyle(tour);
  const body = tour.querySelector('.tour-hint-body');
  const bodyStyle = body ? getComputedStyle(body) : null;
  const main = tour.querySelector('.tour-hint-main');
  const mainStyle = main ? getComputedStyle(main) : null;
  const dotsRect = tour.querySelector('.tour-dots')?.getBoundingClientRect();
  const voiceEl = tour.querySelector('.tour-voice');
  const voiceButton = voiceEl?.getBoundingClientRect();
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
  const cardInnerScroll =
    (cardStyle.overflowY === 'auto' || cardStyle.overflowY === 'scroll') && tour.scrollHeight > tour.clientHeight + 1;
  const mainScrolls = !!(
    main &&
    mainStyle &&
    (mainStyle.overflowY === 'auto' || mainStyle.overflowY === 'scroll') &&
    main.scrollHeight > main.clientHeight + 1
  );
  const footerBack = tour.querySelector('.tour-actions .secondary')?.getBoundingClientRect();
  const footerPrimary = tour.querySelector('.tour-actions .primary')?.getBoundingClientRect();
  const inViewport = (r: DOMRect | undefined) =>
    !!r && r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5 && r.height > 0;
  const insetRight = parseFloat(cardStyle.right) || 0;
  const insetBottom = parseFloat(cardStyle.bottom) || 0;
  const anchoredBottomRight =
    Math.abs(tourRect.right - (window.innerWidth - insetRight)) <= 3 &&
    Math.abs(tourRect.bottom - (window.innerHeight - insetBottom)) <= 3 &&
    tourRect.width <= 320.5;
  const voiceOverlapsDots = !!(
    voiceButton &&
    dotsRect &&
    overlap(voiceButton, dotsRect)
  );
  return {
    inViewport: tourRect.top >= -0.5 && tourRect.bottom <= window.innerHeight + 0.5,
    bodyVisible: !!(
      body &&
      bodyStyle &&
      main &&
      mainStyle &&
      bodyStyle.display !== 'none' &&
      bodyStyle.visibility !== 'hidden' &&
      body.textContent?.trim()
    ),
    titleDotsOverlap: voiceOverlapsDots,
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
    bodyWithoutScroll: !!(body && body.scrollHeight <= body.clientHeight + 1 && !mainScrolls),
    footerBackInViewport: inViewport(footerBack),
    footerPrimaryInViewport: inViewport(footerPrimary),
    anchoredBottomRight,
    cardHeight: tourRect.height,
  };
}
