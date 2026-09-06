/**
 * WhatsApp Chat Viewer - ZIP & Media Handler
 * Manages extraction, indexing, caching, and Object URL lifecycles for exported media.
 */

import { getExt, mediaKind, mimeFor } from './utils.js';

export class ZipHandler {
  constructor() {
    this.zip = null;
    this.mediaMap = new Map(); // normalized key -> JSZip entry
    this.urlCache = new Map(); // normalized key -> Object URL
    this.blobCache = new Map(); // normalized key -> Blob
    this.chatText = '';
    this.chatFileName = '';
  }

  /**
   * Reset caches and revoke created Object URLs to prevent memory leaks
   */
  cleanup() {
    for (const url of this.urlCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    }
    this.zip = null;
    this.mediaMap.clear();
    this.urlCache.clear();
    this.blobCache.clear();
    this.chatText = '';
    this.chatFileName = '';
  }

  /**
   * Normalize filename for lookup (lowercase, stripped path, decoded)
   */
  normalizeKey(filename) {
    if (!filename) return '';
    try {
      filename = decodeURIComponent(filename);
    } catch (e) {
      // ignore
    }
    // Remove directory prefixes if any
    const base = filename.replace(/\\/g, '/').split('/').pop();
    return base.trim().toLowerCase();
  }

  /**
   * Load and index a ZIP file
   */
  async loadZip(fileOrBuffer, onProgress = () => {}) {
    this.cleanup();
    onProgress('Unpacking ZIP archive...');

    const JSZip = window.JSZip;
    if (!JSZip) {
      throw new Error('JSZip library is not loaded.');
    }

    const buffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    this.zip = await JSZip.loadAsync(buffer);

    let txtEntry = null;
    let txtSize = -1;
    const txtCandidates = [];

    onProgress('Indexing files in archive...');
    this.zip.forEach((relPath, entry) => {
      if (entry.dir) return;

      const baseName = entry.name.replace(/\\/g, '/').split('/').pop();
      const normKey = this.normalizeKey(entry.name);

      if (/\.txt$/i.test(baseName)) {
        txtCandidates.push(entry);
        // Priority to _chat.txt or WhatsApp Chat...
        if (baseName.toLowerCase() === '_chat.txt' || baseName.toLowerCase().startsWith('whatsapp chat')) {
          txtEntry = entry;
        }
      }

      this.mediaMap.set(normKey, entry);
      this.mediaMap.set(entry.name.toLowerCase(), entry);
    });

    if (!txtEntry && txtCandidates.length > 0) {
      // Pick the first or largest text file
      txtEntry = txtCandidates[0];
    }

    if (!txtEntry) {
      throw new Error('No WhatsApp chat .txt file found inside the zip archive.');
    }

    this.chatFileName = txtEntry.name;
    onProgress('Extracting chat messages...');
    this.chatText = await txtEntry.async('string');

    return {
      chatText: this.chatText,
      mediaCount: this.mediaMap.size,
      chatFileName: this.chatFileName
    };
  }

  /**
   * Check if a media file exists in the archive
   */
  hasMedia(filename) {
    const key = this.normalizeKey(filename);
    return this.mediaMap.has(key);
  }

  /**
   * Get JSZip entry for a given filename
   */
  getEntry(filename) {
    const key = this.normalizeKey(filename);
    return this.mediaMap.get(key) || null;
  }

  /**
   * Get or create a Blob for a media file
   */
  async getMediaBlob(filename) {
    const key = this.normalizeKey(filename);
    if (this.blobCache.has(key)) {
      return this.blobCache.get(key);
    }

    const entry = this.getEntry(filename);
    if (!entry) return null;

    const ext = getExt(filename);
    const mime = mimeFor(ext);
    const arrayBuffer = await entry.async('arraybuffer');
    const blob = new Blob([arrayBuffer], { type: mime });

    this.blobCache.set(key, blob);
    return blob;
  }

  /**
   * Get or create an Object URL for rendering media
   */
  async getMediaUrl(filename) {
    const key = this.normalizeKey(filename);
    if (this.urlCache.has(key)) {
      return this.urlCache.get(key);
    }

    const blob = await this.getMediaBlob(filename);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    this.urlCache.set(key, url);
    return url;
  }

  /**
   * List all media entries for the Media Gallery
   */
  getAllMedia() {
    const list = [];
    const seen = new Set();

    for (const [key, entry] of this.mediaMap.entries()) {
      const baseName = entry.name.replace(/\\/g, '/').split('/').pop();
      if (seen.has(baseName.toLowerCase()) || /\.txt$/i.test(baseName)) continue;
      seen.add(baseName.toLowerCase());

      const ext = getExt(baseName);
      const kind = mediaKind(baseName);
      list.push({
        name: baseName,
        key: this.normalizeKey(baseName),
        kind,
        ext,
        entry
      });
    }

    return list;
  }
}
