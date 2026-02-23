const MOBILE_MEDIA_QUERY = '(max-width: 960px)';
const ACTIVE_SECTION_OFFSET_PX = 132;

function setSectionOpen(section, open) {
  const isOpen = Boolean(open);
  const toggle = section.querySelector('[data-section-toggle]');
  const body = section.querySelector('.superadmin-section__body');

  section.classList.toggle('is-open', isOpen);
  if (toggle) {
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
  if (body) {
    body.hidden = !isOpen;
  }
}

function resolveSectionByHash(hash, sections) {
  const sectionId = String(hash || '').replace(/^#/, '').trim();
  if (!sectionId) return null;
  return sections.find((section) => section.id === sectionId) || null;
}

function updateActiveQuickNav(navLinks, activeSection) {
  navLinks.forEach((link) => {
    const targetHash = String(link.getAttribute('href') || '').trim();
    const isActive = Boolean(activeSection) && targetHash === `#${activeSection.id}`;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'true');
      return;
    }
    link.removeAttribute('aria-current');
  });
}

function resolveScrolledSection(sections) {
  const viewportTop = window.scrollY + ACTIVE_SECTION_OFFSET_PX;
  let active = sections[0] || null;

  sections.forEach((section) => {
    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    if (sectionTop <= viewportTop) {
      active = section;
    }
  });

  return active;
}

export function initSuperadminIaLayout(doc = document) {
  const page = doc.querySelector('.superadmin-page');
  if (!page) return;

  const sections = Array.from(page.querySelectorAll('[data-ia-section]'));
  const navLinks = Array.from(page.querySelectorAll('[data-ia-nav-link]'));
  if (!sections.length || !navLinks.length) return;

  const media = window.matchMedia(MOBILE_MEDIA_QUERY);

  function applyLayoutMode() {
    const isMobile = media.matches;
    page.dataset.iaMobile = isMobile ? 'true' : 'false';

    sections.forEach((section) => {
      if (!isMobile) {
        setSectionOpen(section, true);
        return;
      }

      const persisted = String(section.dataset.iaOpen || '').trim();
      const defaultOpen = String(section.dataset.accordionDefault || '').trim() === 'open';
      const shouldOpen = persisted ? persisted === 'true' : defaultOpen;
      setSectionOpen(section, shouldOpen);
    });

    updateActiveQuickNav(navLinks, resolveScrolledSection(sections));
  }

  sections.forEach((section) => {
    const toggle = section.querySelector('[data-section-toggle]');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      if (!media.matches) return;
      const nextOpen = !section.classList.contains('is-open');
      section.dataset.iaOpen = nextOpen ? 'true' : 'false';
      setSectionOpen(section, nextOpen);
    });
  });

  window.addEventListener('superadmin:open-section', (event) => {
    const sectionId = String(event?.detail?.sectionId || '').trim();
    if (!sectionId) return;
    const target = sections.find((section) => section.id === sectionId);
    if (!target) return;
    target.dataset.iaOpen = 'true';
    setSectionOpen(target, true);
    updateActiveQuickNav(navLinks, target);
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = String(link.getAttribute('href') || '').trim();
      const targetSection = resolveSectionByHash(href, sections);
      if (!targetSection) return;

      event.preventDefault();

      if (media.matches) {
        targetSection.dataset.iaOpen = 'true';
        setSectionOpen(targetSection, true);
      }

      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateActiveQuickNav(navLinks, targetSection);
    });
  });

  let scrollTicking = false;
  function handleScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      updateActiveQuickNav(navLinks, resolveScrolledSection(sections));
      scrollTicking = false;
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleScroll);

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', applyLayoutMode);
  } else if (typeof media.addListener === 'function') {
    media.addListener(applyLayoutMode);
  }

  applyLayoutMode();
}
