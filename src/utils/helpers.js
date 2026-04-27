// Avatar colour palette derived from Connectivity & Clarity palette
const PALETTES = [
  { bg: '#dde1ff', fg: '#003ec7' },   // primary blue
  { bg: '#d0e1fb', fg: '#505f76' },   // secondary slate
  { bg: '#c9e6ff', fg: '#005479' },   // tertiary teal
  { bg: '#d3e4fe', fg: '#0b1c30' },   // secondary fixed
  { bg: '#e8eaf6', fg: '#283593' },   // indigo
  { bg: '#e0f7fa', fg: '#00696f' },   // cyan
  { bg: '#fce4ec', fg: '#880e4f' },   // pink
  { bg: '#f3e5f5', fg: '#6a1b9a' },   // purple
];

export function getAvatarPalette(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return PALETTES[Math.abs(h) % PALETTES.length];
}

export function formatTime(ts) {
  if (!ts) return '';
  const d   = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  const diff = (now - d) / 86400000;
  if (diff < 7) return d.toLocaleDateString('id-ID', { weekday: 'short' });
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function formatFullTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function getChatId(a, b) { return [a, b].sort().join('_'); }

export function generateId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function toFirebaseEmail(username) {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@respirasion.app`;
}
