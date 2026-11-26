const COLORS = ['#3b82f6', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981'];

/** A short, light confetti burst (pure DOM, removed after it falls). */
export function confetti(count = 48) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frag = document.createDocumentFragment();
  const pieces: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = COLORS[i % COLORS.length];
    el.style.setProperty('--x', `${(Math.random() - 0.5) * 240}px`);
    el.style.setProperty('--r', `${(Math.random() - 0.5) * 1080}deg`);
    el.style.setProperty('--d', `${1.4 + Math.random() * 1.3}s`);
    el.style.animationDelay = `${Math.random() * 0.25}s`;
    if (i % 3 === 0) { el.style.width = '6px'; el.style.height = '6px'; el.style.borderRadius = '9px'; }
    frag.appendChild(el);
    pieces.push(el);
  }
  document.body.appendChild(frag);
  setTimeout(() => pieces.forEach((p) => p.remove()), 3200);
}
