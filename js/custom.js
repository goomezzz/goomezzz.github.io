(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.replace('no-js', 'js');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileMenu = window.matchMedia('(width < 48rem)');
  const navigation = document.querySelector('.site-nav');
  const menu = document.querySelector('#site-menu');
  const menuToggle = document.querySelector('.menu-toggle');
  const navigationLinks = [...menu.querySelectorAll('a')];
  const sections = [...document.querySelectorAll('main > section')];

  function setMenuOpen(open, restoreFocus = false) {
    menu.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (restoreFocus) menuToggle.focus();
  }

  menuToggle.addEventListener('click', () => {
    setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
  });
  navigation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenuOpen(false, true);
    }
  });
  document.addEventListener('click', (event) => {
    if (!navigation.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener('focusin', (event) => {
    if (mobileMenu.matches && !navigation.contains(event.target)) setMenuOpen(false);
  });
  mobileMenu.addEventListener('change', () => setMenuOpen(false));

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      setMenuOpen(false);
      // Let native anchors handle scrolling and history; keep keyboard focus in sync.
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    });
  });

  let navigationPending = false;
  function updateNavigation() {
    navigation.classList.toggle('is-scrolled', window.scrollY > 140);
    let currentSection = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 100) currentSection = section;
    }
    if (window.scrollY + window.innerHeight >= root.scrollHeight - 2) {
      currentSection = sections.at(-1);
    }
    for (const link of navigationLinks) {
      if (link.hash === `#${currentSection.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    navigationPending = false;
  }
  function scheduleNavigation() {
    if (navigationPending) return;
    navigationPending = true;
    requestAnimationFrame(updateNavigation);
  }
  window.addEventListener('scroll', scheduleNavigation, { passive: true });
  window.addEventListener('resize', scheduleNavigation);
  window.addEventListener('hashchange', scheduleNavigation);
  updateNavigation();

  const gallery = document.querySelector('#project-gallery');
  const cards = [...gallery.querySelectorAll('.project-card')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const filterStatus = document.querySelector('#filter-status');
  const touchCards = window.matchMedia('(width < 62rem), (hover: none), (pointer: coarse)');
  let expandedCard = null;

  function closeCard() {
    expandedCard?.classList.remove('is-touch-active');
    expandedCard = null;
  }

  // Tapping the card toggles its caption; the revealed link opens the project.
  gallery.addEventListener('click', (event) => {
    const card = event.target.closest('.project-card');
    if (!touchCards.matches || !card || event.detail === 0) return;
    if (card === expandedCard && event.target.closest('a')) return;
    event.preventDefault();
    event.stopPropagation();
    const wasExpanded = card === expandedCard;
    closeCard();
    if (wasExpanded) return;
    expandedCard = card;
    card.classList.add('is-touch-active');
  }, true);
  document.addEventListener('pointerdown', (event) => {
    if (expandedCard && !expandedCard.contains(event.target)) closeCard();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Tab') closeCard();
  });
  touchCards.addEventListener('change', closeCard);
  // Match the original Isotope 2.2.0 settings and preserve hidden items' coordinates.
  const filterDuration = 400;
  const hiddenScale = .001;
  const itemState = new Map(cards.map((card) => [card, {
    x: 0, y: 0, visible: true, animation: null
  }]));
  let activeFilter = filters.find((button) => button.getAttribute('aria-pressed') === 'true');
  let filterRun = 0;
  let layoutWidth = 0;
  let resizeFrame = null;
  gallery.classList.add('is-masonry');

  function readVisualState(card) {
    const state = itemState.get(card);
    if (card.hidden) {
      return { x: state.x, y: state.y, scaleX: hiddenScale, scaleY: hiddenScale, opacity: 0 };
    }
    const style = getComputedStyle(card);
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return {
      x: state.x + matrix.m41,
      y: state.y + matrix.m42,
      scaleX: Math.hypot(matrix.m11, matrix.m12),
      scaleY: Math.hypot(matrix.m21, matrix.m22),
      opacity: Number(style.opacity)
    };
  }

  function animateItem(card, from, to, run, hideOnFinish) {
    const state = itemState.get(card);
    const animation = card.animate([from, to], {
      duration: filterDuration,
      easing: 'ease',
      fill: 'both'
    });
    state.animation = animation;
    const finished = animation.finished.then(() => {
      if (run !== filterRun || state.animation !== animation) return;
      if (hideOnFinish) card.hidden = true;
      state.animation = null;
      animation.cancel();
    }, () => { /* Interrupted filters continue from their current rendered position. */ });
    return finished;
  }

  function arrangeProjects(button, { animate = true, announce = true } = {}) {
    closeCard();
    const run = ++filterRun;
    const shouldAnimate = animate && !reducedMotion.matches && typeof gallery.animate === 'function';
    const visual = new Map();
    // Read the current matrices before canceling a transition, including half-hidden items.
    if (shouldAnimate) for (const card of cards) visual.set(card, readVisualState(card));
    for (const state of itemState.values()) {
      state.animation?.cancel();
      state.animation = null;
    }
    const visibleCards = [];
    const hidingCards = [];
    for (const card of cards) {
      const state = itemState.get(card);
      const visible = button.dataset.filter === 'all' ||
        card.dataset.categories.split(' ').includes(button.dataset.filter);
      if (!visible && card.contains(document.activeElement)) button.focus({ preventScroll: true });
      state.visible = visible;
      card.inert = !visible;
      if (visible) {
        card.hidden = false;
        card.removeAttribute('aria-hidden');
        visibleCards.push(card);
      } else {
        card.setAttribute('aria-hidden', 'true');
        if (shouldAnimate && !card.hidden) hidingCards.push(card);
        else card.hidden = true;
      }
    }

    // Shortest-column placement matches the original masonry layout and source order.
    layoutWidth = gallery.getBoundingClientRect().width;
    const columns = Math.max(1, Number(getComputedStyle(gallery).getPropertyValue('--gallery-columns')) || 1);
    const columnWidth = layoutWidth / columns;
    const columnHeights = Array(columns).fill(0);
    const targets = new Map();
    for (const card of visibleCards) {
      const height = parseFloat(getComputedStyle(card).height) || 0;
      const y = Math.min(...columnHeights);
      const column = columnHeights.indexOf(y);
      const x = column * columnWidth;
      targets.set(card, {
        x: Math.floor(x), y: Math.floor(y),
        endX: x - Math.floor(x), endY: y - Math.floor(y)
      });
      columnHeights[column] += height;
    }
    const animations = [];
    for (const card of visibleCards) {
      const state = itemState.get(card);
      const target = targets.get(card);
      const old = visual.get(card);
      state.x = target.x;
      state.y = target.y;
      card.style.left = `${target.x}px`;
      card.style.top = `${target.y}px`;
      if (!shouldAnimate) continue;
      const dx = old.x - target.x;
      const dy = old.y - target.y;
      if (Math.abs(dx) < .01 && Math.abs(dy) < .01 &&
          Math.abs(old.scaleX - 1) < .0001 && Math.abs(old.scaleY - 1) < .0001 && old.opacity === 1) continue;
      animations.push(animateItem(card, {
        transform: `translate(${dx}px, ${dy}px) scale(${old.scaleX}, ${old.scaleY})`,
        opacity: old.opacity
      }, {
        // Isotope moves to fractional coordinates, then commits integer left/top values.
        transform: `translate(${target.endX}px, ${target.endY}px) scale(1)`, opacity: 1
      }, run, false));
    }
    for (const card of hidingCards) {
      const state = itemState.get(card);
      const old = visual.get(card);
      // Keep disappearing items at their current position; retain it for the next reveal.
      state.x = old.x;
      state.y = old.y;
      card.style.left = `${old.x}px`;
      card.style.top = `${old.y}px`;
      animations.push(animateItem(card, {
        transform: `scale(${old.scaleX}, ${old.scaleY})`, opacity: old.opacity
      }, { transform: `scale(${hiddenScale})`, opacity: 0 }, run, true));
    }

    // The original sets container height immediately; only item transforms/opacity transition.
    gallery.style.height = `${Math.max(...columnHeights)}px`;
    activeFilter = button;
    for (const filter of filters) filter.setAttribute('aria-pressed', String(filter === button));
    if (announce) filterStatus.textContent = `${visibleCards.length} proyectos visibles. Filtro: ${button.textContent}.`;
    if (animations.length) {
      gallery.dataset.animating = 'true';
      Promise.all(animations).then(() => {
        if (run !== filterRun) return;
        delete gallery.dataset.animating;
        scheduleNavigation();
      });
    } else delete gallery.dataset.animating;
    scheduleNavigation();
  }

  for (const button of filters) {
    button.addEventListener('click', () => {
      if (button !== activeFilter) arrangeProjects(button);
    });
  }
  function settleProjects() {
    arrangeProjects(activeFilter, { animate: false, announce: false });
  }
  function scheduleGalleryResize() {
    if (resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      if (Math.abs(gallery.getBoundingClientRect().width - layoutWidth) > .5) settleProjects();
    });
  }
  window.addEventListener('resize', scheduleGalleryResize);
  gallery.addEventListener('load', (event) => {
    if (event.target instanceof HTMLImageElement) scheduleGalleryResize();
  }, true);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) settleProjects();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gallery.dataset.animating) settleProjects();
  });
  arrangeProjects(activeFilter, { animate: false, announce: false });

  const viewer = document.querySelector('#image-viewer');
  const viewerStage = document.querySelector('#viewer-stage');
  const viewerTitle = document.querySelector('#viewer-title');
  const viewerStatus = document.querySelector('#viewer-status');
  const viewerError = viewer.querySelector('.viewer-error');
  const originalImage = document.querySelector('#viewer-original');
  let returnFocus = null;
  let activeImage = null;

  gallery.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-lightbox]');
    if (!link || typeof viewer.showModal !== 'function') return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const card = link.closest('.project-card');
    const thumbnail = card.querySelector('img');
    const title = card.querySelector('h3').textContent;
    const image = new Image();
    activeImage = image;
    returnFocus = link;
    image.className = 'viewer-image';
    image.alt = title;
    image.width = Number(thumbnail.getAttribute('width'));
    image.height = Number(thumbnail.getAttribute('height'));
    image.decoding = 'async';
    image.hidden = true;
    viewerTitle.textContent = title;
    viewerStatus.textContent = 'Cargando imagen…';
    viewerStage.setAttribute('aria-busy', 'true');
    viewerError.hidden = true;
    originalImage.href = link.href;
    viewerStage.replaceChildren(image);
    image.addEventListener('load', () => {
      if (activeImage !== image || !viewer.open) return;
      image.hidden = false;
      viewerStatus.textContent = '';
      viewerStage.setAttribute('aria-busy', 'false');
    }, { once: true });
    image.addEventListener('error', () => {
      if (activeImage !== image || !viewer.open) return;
      viewerStatus.textContent = 'Error al cargar la imagen.';
      viewerStage.setAttribute('aria-busy', 'false');
      viewerError.hidden = false;
    }, { once: true });
    root.classList.add('is-viewing');
    viewer.showModal();
    // Originals are requested only when opened; the thumbnail srcset stays independent.
    image.src = link.href;
  });

  let backdropPointerDown = false;
  function isBackdrop(event) {
    const bounds = viewer.getBoundingClientRect();
    return event.target === viewer && (
      event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
    );
  }
  viewer.addEventListener('pointerdown', (event) => {
    backdropPointerDown = isBackdrop(event);
  });
  viewer.addEventListener('click', (event) => {
    if (backdropPointerDown && isBackdrop(event)) viewer.close();
    backdropPointerDown = false;
  });
  // Keep the controls in a predictable tab loop, including the optional error link.
  viewer.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...viewer.querySelectorAll('button, a[href]')]
      .filter((control) => !control.disabled && control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if ((event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  viewer.addEventListener('close', () => {
    activeImage = null;
    viewerStage.replaceChildren();
    viewerStage.setAttribute('aria-busy', 'false');
    viewerStatus.textContent = '';
    viewerError.hidden = true;
    root.classList.remove('is-viewing');
    if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) {
      returnFocus.focus({ preventScroll: true });
    }
    returnFocus = null;
  });

  // The animated text is decorative; assistive tech receives the complete static description.
  const profession = document.querySelector('.profession');
  const professions = ['Dirección de Arte', 'Diseño Gráfico', 'Ilustración 3D', 'Arte Final'];
  const typingDelay = 55;
  const erasingDelay = 35;
  const phrasePause = 2500;
  const nextPhrasePause = 250;
  let typingTimer;
  let phraseIndex = 0;
  let characterIndex = 0;
  let deleting = false;

  function scheduleTyping(delay) {
    clearTimeout(typingTimer);
    if (!reducedMotion.matches && !document.hidden) {
      typingTimer = setTimeout(typeNextCharacter, delay);
    }
  }

  function typeNextCharacter() {
    if (reducedMotion.matches || document.hidden) return;
    const phrase = professions[phraseIndex];
    characterIndex += deleting ? -1 : 1;
    profession.textContent = phrase.slice(0, characterIndex);
    let delay = deleting ? erasingDelay : typingDelay;
    if (!deleting && characterIndex === phrase.length) {
      deleting = true;
      delay = phrasePause;
    } else if (deleting && characterIndex === 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % professions.length;
      delay = nextPhrasePause;
    }
    scheduleTyping(delay);
  }

  function restartTyping() {
    clearTimeout(typingTimer);
    phraseIndex = 0;
    characterIndex = 0;
    deleting = false;
    profession.classList.toggle('is-typing', !reducedMotion.matches);
    profession.textContent = reducedMotion.matches ? professions[0] : '';
    scheduleTyping(200);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(typingTimer);
    else scheduleTyping(200);
  });
  reducedMotion.addEventListener('change', restartTyping);
  restartTyping();
})();
