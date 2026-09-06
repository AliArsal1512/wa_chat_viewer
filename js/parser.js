/**
 * WhatsApp Chat Viewer - Parser
 * Resilient parser supporting Android, iOS, and international date formats.
 */

// Matches [DD/MM/YY, HH:MM:SS] or DD/MM/YY, HH:MM - or DD.MM.YY, HH:MM
const LINE_START_REGEX = /^\[?(\d{1,4}[./\-]\d{1,2}[./\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?[\s\u202f\u00a0]?(?:[APap]\.?[Mm]\.?)?)\]?\s*(?:-|\u2013|\u2014)?\s*/;

/**
 * Parse time string into 24-hour hour, minute, second
 */
function parseTimeParts(timeStr) {
  const cleanTime = timeStr.replace(/[\u202f\u00a0]/g, ' ').trim();
  const ampmMatch = cleanTime.match(/([APap])\.?[Mm]\.?$/i);
  let ampm = null;
  let core = cleanTime;

  if (ampmMatch) {
    ampm = ampmMatch[1].toUpperCase();
    core = cleanTime.slice(0, cleanTime.length - ampmMatch[0].length).trim();
  }

  const parts = core.split(':').map(p => parseInt(p, 10));
  let h = isNaN(parts[0]) ? 0 : parts[0];
  let mnt = isNaN(parts[1]) ? 0 : parts[1];
  let s = isNaN(parts[2]) ? 0 : parts[2];

  if (ampm === 'P' && h < 12) h += 12;
  if (ampm === 'A' && h === 12) h = 0;

  return { h, mnt, s };
}

/**
 * Heuristic to detect whether dates are Day-first (e.g. 31/12/2022) or Month-first (e.g. 12/31/2022)
 */
function detectDayFirst(dateStrings) {
  for (const ds of dateStrings) {
    const parts = ds.split(/[./\-]/).map(p => parseInt(p, 10));
    // If format is YYYY-MM-DD
    if (parts[0] > 1000) return false;
    if (parts[0] > 12) return true;
    if (parts[1] > 12) return false;
  }
  // Default to true (International standard for WhatsApp exports)
  return true;
}

/**
 * Convert parsed date & time strings to JS Date object
 */
function buildDate(dateStr, timeStr, dayFirst) {
  const parts = dateStr.split(/[./\-]/).map(p => parseInt(p, 10));
  let year, month, day;

  if (parts[0] > 1000) {
    // YYYY/MM/DD
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else if (dayFirst) {
    // DD/MM/YYYY
    day = parts[0];
    month = parts[1];
    year = parts[2];
  } else {
    // MM/DD/YYYY
    month = parts[0];
    day = parts[1];
    year = parts[2];
  }

  if (year < 100) year += 2000;
  const t = parseTimeParts(timeStr);
  return new Date(year, (month || 1) - 1, day || 1, t.h, t.mnt, t.s || 0);
}

/**
 * Extract attached filename from message body
 */
export function extractMediaFilename(text) {
  if (!text) return null;
  // iOS format: <attached: filename.jpg>
  let m = text.match(/<attached:\s*(.+?)>/i);
  if (m) return m[1].trim();
  // Android format: filename.jpg (file attached)
  m = text.match(/^(.+?)\s*\((?:file\s+)?attached\)\s*$/i);
  if (m) return m[1].trim();
  // Alternative: filename.jpg <attached>
  m = text.match(/^(.+?)\s*<attached>\s*$/i);
  if (m) return m[1].trim();
  return null;
}

/**
 * Check if media was omitted during WhatsApp export
 */
export function isMediaOmitted(text) {
  if (!text) return false;
  const trimmed = text.trim();
  return /(?:^|\s)<?[\w\s]{0,12}media omitted>?/i.test(trimmed) ||
         /^(image|video|audio|gif|sticker|document|contact card)\s+omitted$/i.test(trimmed) ||
         /^<media omitted>$/i.test(trimmed);
}

/**
 * Check if message was deleted or contains null/revoked content
 */
export function isDeleted(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed === 'null' || trimmed === '<null>' || trimmed === '') return true;
  return /this message was deleted/i.test(trimmed) ||
         /you deleted this message/i.test(trimmed) ||
         /message deleted/i.test(trimmed) ||
         /this message was revoked/i.test(trimmed) ||
         /message was deleted by an admin/i.test(trimmed) ||
         /este mensaje fue eliminado/i.test(trimmed) ||
         /esta mensagem foi apagada/i.test(trimmed) ||
         /ce message a été supprimé/i.test(trimmed) ||
         /diese nachricht wurde gelöscht/i.test(trimmed);
}

/**
 * Strip edited notice from message text
 */
export function stripEdited(text) {
  if (!text) return { edited: false, cleaned: '' };
  const edited = /<this message was edited>/i.test(text);
  const cleaned = text.replace(/\s*<this message was edited>\s*$/i, '');
  return { edited, cleaned };
}

/**
 * Main function to parse exported WhatsApp chat text
 */
export function parseChat(rawText) {
  if (!rawText) return [];

  // Remove invisible formatting and zero-width characters
  const sanitized = rawText.replace(/[\u200e\u200f\uFEFF]/g, '');
  const lines = sanitized.split(/\r\n|\r|\n/);
  const rawEntries = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(LINE_START_REGEX);
    if (match) {
      if (current) rawEntries.push(current);
      const rest = line.slice(match[0].length);
      current = { dateStr: match[1], timeStr: match[2].trim(), rest };
    } else if (current) {
      current.rest += '\n' + line;
    }
  }
  if (current) rawEntries.push(current);

  const dayFirst = detectDayFirst(rawEntries.slice(0, 50).map(r => r.dateStr));
  const messages = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const r = rawEntries[i];
    let sender = null;
    let msgText = r.rest;

    // Detect sender
    const firstLine = r.rest.split('\n')[0];
    const colonIdx = firstLine.indexOf(': ');
    if (colonIdx !== -1 && colonIdx < 50) {
      sender = firstLine.slice(0, colonIdx).trim();
      msgText = r.rest.slice(colonIdx + 2);
    }

    const date = buildDate(r.dateStr, r.timeStr, dayFirst);
    const mediaFile = extractMediaFilename(msgText);
    const omitted = !mediaFile && isMediaOmitted(msgText);
    const isExplicitlyNull = !msgText || msgText.trim() === 'null' || msgText.trim() === '<null>' || msgText.trim() === '';
    const deleted = (!mediaFile && !omitted && isExplicitlyNull) || isDeleted(msgText);
    const { edited, cleaned } = stripEdited(msgText);
    const finalCleaned = isExplicitlyNull ? '' : (cleaned.trim() === 'null' ? '' : cleaned);

    messages.push({
      id: i,
      sender,
      date,
      text: finalCleaned,
      mediaFile,
      omitted,
      deleted,
      edited,
      isSystem: sender === null
    });
  }

  return messages;
}
