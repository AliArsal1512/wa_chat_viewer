/**
 * WhatsApp Chat Viewer - Utilities
 */

export const AVATAR_COLORS = [
  '#e17076', '#faa774', '#a695e7', '#7bc862', '#6ec9cb',
  '#65aadd', '#ee7aae', '#f2a33c', '#5c9cd6', '#c17bd6',
  '#20c997', '#ff6b6b', '#339af0', '#f06595', '#845ef7'
];

/**
 * Extract participant initials
 */
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generate a consistent avatar color for a name
 */
export function colorFor(name) {
  if (!name) return '#8696a0';
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/**
 * Escape HTML characters
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert URLs into clickable links
 */
export function linkify(text) {
  const urlRe = /((https?:\/\/|www\.)[^\s<]+)/gi;
  return text.replace(urlRe, (m) => {
    const href = m.startsWith('http') ? m : 'https://' + m;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">${m}</a>`;
  });
}

/**
 * Format WhatsApp Markdown: *bold*, _italic_, ~strikethrough~, ```monospace```
 */
export function formatWhatsAppFormatting(text) {
  // Code block ```code```
  text = text.replace(/```([\s\S]*?)```/g, '<span class="wa-mono">$1</span>');
  // Bold *text*
  text = text.replace(/(^|[\s_~])\*([^\s*](?:[\s\S]*?[^\s*])?)\*($|[\s_~])/g, '$1<span class="wa-bold">$2</span>$3');
  // Italic _text_
  text = text.replace(/(^|[\s*~])_([^\s_](?:[\s\S]*?[^\s_])?)_($|[\s*~])/g, '$1<span class="wa-italic">$2</span>$3');
  // Strikethrough ~text~
  text = text.replace(/(^|[\s*_])~([^\s~](?:[\s\S]*?[^\s~])?)~($|[\s*_])/g, '$1<span class="wa-strike">$2</span>$3');
  return text;
}

/**
 * Highlight search term matches inside HTML safely
 */
export function highlightHTML(html, term) {
  if (!term || !term.trim()) return html;
  const esc = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'gi');
  return html.split(/(<[^>]+>)/g).map(chunk => {
    if (chunk.startsWith('<')) return chunk;
    return chunk.replace(re, m => '<mark class="search-hit">' + m + '</mark>');
  }).join('');
}

/**
 * Complete message formatting
 */
export function formatMessageText(raw, term = '') {
  if (!raw || raw === 'null' || raw === '<null>') return '';
  let t = escapeHtml(raw);
  t = linkify(t);
  t = formatWhatsAppFormatting(t);
  t = highlightHTML(t, term);
  return t;
}

/**
 * System message descriptions with icons
 */
export function describeSystemMessage(text) {
  const clean = (text || '').trim();
  if (!clean) return '📌 System notice';
  const rules = [
    [/end-to-end encrypted/i, '🔒 '],
    [/missed voice call/i, '📞 '],
    [/missed video call/i, '📹 '],
    [/security code changed/i, '🔒 '],
    [/changed their phone number/i, '📱 '],
    [/created group|added|removed|left the group|changed the subject|changed this group.?s icon|changed the group description|joined using this group.?s invite link/i, '👥 '],
    [/changed to \+|changed the group|pinned a message/i, '📌 '],
    [/disappearing messages/i, '⏳ '],
  ];
  for (const [re, icon] of rules) {
    if (re.test(clean)) return icon + clean;
  }
  return clean;
}

/**
 * Grouping key for date headers
 */
export function groupKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Format relative/calendar date label
 */
export function formatDateLabel(d) {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (groupKey(d) === groupKey(today)) return 'Today';
  if (groupKey(d) === groupKey(yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format time with AM/PM
 */
export function formatTime(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Format audio seconds to M:SS
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format file size in bytes
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get file extension from filename
 */
export function getExt(name) {
  if (!name) return '';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Categorize media kind
 */
export function mediaKind(name) {
  const ext = getExt(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return ext === 'webp' && name.includes('STK') ? 'sticker' : 'image';
  }
  if (['mp4', 'mov', '3gp', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['opus', 'mp3', 'm4a', 'aac', 'ogg', 'wav'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'xlsx', 'xls', 'pptx'].includes(ext)) return 'document';
  if (ext === 'vcf') return 'vcf';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'file';
}

/**
 * Determine MIME type for blob creation
 */
export function mimeFor(ext) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', svg: 'image/svg+xml', mp4: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp',
    webm: 'video/webm', mkv: 'video/x-matroska', opus: 'audio/ogg; codecs=opus', mp3: 'audio/mpeg',
    m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', pdf: 'application/pdf',
    vcf: 'text/vcard', zip: 'application/zip'
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * File icon SVG helper
 */
export function getFileIconSvg(kind) {
  if (kind === 'pdf') {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zm4.5 2.5h1v-3h-1v3z"/></svg>`;
  }
  if (kind === 'vcf') {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
}

/**
 * Toast notifications
 */
export function showToast(msg) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

/**
 * Debounce helper
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
