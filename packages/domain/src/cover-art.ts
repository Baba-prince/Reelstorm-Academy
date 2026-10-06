/**
 * SVG cover art for Template Room ideal cards (no external image dependency).
 */

export function idealCoverDataUri(opts: {
  name: string;
  category: string;
  accent: string;
  tagline?: string;
}): string {
  const accent = opts.accent || "#7C3AED";
  const title = escapeXml(opts.name.slice(0, 28));
  const cat = escapeXml(opts.category.replace(/_/g, " ").toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#0A0A0A"/>
      <stop offset="100%" stop-color="#00D9FF" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="#080808"/>
  <rect width="640" height="360" fill="url(#g)"/>
  <circle cx="520" cy="80" r="90" fill="${accent}" opacity="0.25"/>
  <circle cx="80" cy="300" r="120" fill="#00D9FF" opacity="0.12"/>
  <text x="32" y="48" fill="rgba(255,255,255,0.7)" font-family="ui-monospace,monospace" font-size="14" letter-spacing="2">${cat}</text>
  <text x="32" y="200" fill="#fff" font-family="Georgia,serif" font-size="36" font-weight="700">${title}</text>
  <rect x="32" y="330" width="576" height="6" fill="${accent}" opacity="0.8"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
