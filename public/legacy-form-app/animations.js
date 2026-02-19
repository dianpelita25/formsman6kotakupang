export function initCardReveal() {
  const cards = Array.from(document.querySelectorAll('.question.ai-card'));
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach((card) => card.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  cards.forEach((card) => observer.observe(card));
}
