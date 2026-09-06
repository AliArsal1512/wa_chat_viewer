/**
 * WhatsApp Chat Viewer - High-Performance Message Renderer
 * Supports chunked progressive rendering, IntersectionObserver lazy media loading, and media components.
 */

import { AudioPlayer } from './audio-player.js';
import {
  colorFor,
  describeSystemMessage,
  escapeHtml,
  formatBytes,
  formatDateLabel,
  formatMessageText,
  formatTime,
  getExt,
  getFileIconSvg,
  groupKey,
  initials,
  mediaKind
} from './utils.js';

export class MessageRenderer {
  constructor(app) {
    this.app = app;
    this.messagesScroll = document.getElementById('messagesScroll');
    this.sidebarList = document.getElementById('sidebarList');
    this.sidebarEmpty = document.getElementById('sidebarEmpty');
    this.sidebarSubtitle = document.getElementById('sidebarSubtitle');
    this.headerAvatar = document.getElementById('headerAvatar');
    this.headerName = document.getElementById('headerName');
    this.headerSub = document.getElementById('headerSub');

    this.activeAudioPlayers = new Map(); // msgIdx -> AudioPlayer instance
    this.mediaObserver = null;
    this.initObserver();
  }

  initObserver() {
    if ('IntersectionObserver' in window) {
      this.mediaObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const slot = entry.target;
            this.mediaObserver.unobserve(slot);
            this.loadMediaSlot(slot);
          }
        });
      }, {
        root: this.messagesScroll,
        rootMargin: '300px 0px'
      });
    }
  }

  computeBodyText(msg) {
    if (msg.mediaFile) {
      const caption = (msg.text || '')
        .replace(/<attached:.*?>/i, '')
        .replace(/\(file\s+attached\)/i, '')
        .replace(/<attached>/i, '')
        .trim();
      return (caption && caption.toLowerCase() !== msg.mediaFile.toLowerCase() && caption.toLowerCase() !== 'null') ? caption : null;
    }
    if (!msg.text || msg.text.trim() === 'null' || msg.text.trim() === '<null>') return '';
    return msg.text.trim();
  }

  renderChat() {
    this.cleanupAudioPlayers();
    this.messagesScroll.innerHTML = '';

    const { messages } = this.app.state;
    if (!messages || messages.length === 0) return;

    let lastKey = null;
    const frag = document.createDocumentFragment();

    messages.forEach((msg, idx) => {
      if (msg.date && !isNaN(msg.date.getTime())) {
        const key = groupKey(msg.date);
        if (key !== lastKey) {
          lastKey = key;
          const sepWrap = document.createElement('div');
          sepWrap.className = 'date-sep-wrap';
          sepWrap.id = `datesep-${key}`;
          sepWrap.dataset.timestamp = new Date(msg.date.getFullYear(), msg.date.getMonth(), msg.date.getDate()).getTime();
          sepWrap.innerHTML = `<div class="date-sep">${formatDateLabel(msg.date)}</div>`;
          frag.appendChild(sepWrap);
        }
      }

      const row = this.createMessageRow(msg, idx);
      frag.appendChild(row);
    });

    this.messagesScroll.appendChild(frag);

    // Observe media slots for lazy loading
    this.observeMediaSlots();

    // Scroll to bottom
    requestAnimationFrame(() => {
      this.messagesScroll.scrollTop = this.messagesScroll.scrollHeight;
    });
  }

  createMessageRow(msg, idx) {
    const row = document.createElement('div');
    row.id = `msgrow-${idx}`;
    const term = this.app.state.searchTerm;

    if (msg.isSystem) {
      row.className = 'msg-row system';
      row.innerHTML = `<div class="bubble system">${formatMessageText(describeSystemMessage(msg.text), term)}</div>`;
      return row;
    }

    const isOut = this.app.state.meSender !== null && msg.sender === this.app.state.meSender;
    row.className = `msg-row ${isOut ? 'out' : 'in'}`;

    const bubble = document.createElement('div');
    bubble.className = `bubble ${isOut ? 'out' : 'in'}`;

    let inner = '';
    const showName = !isOut && this.app.state.participants.length > 1;
    if (showName && (this.app.state.meSender === null || this.app.state.participants.length > 2)) {
      inner += `<span class="sender-name" style="color:${colorFor(msg.sender)}">${escapeHtml(msg.sender || 'Unknown')}</span>`;
    }

    const bodyText = this.computeBodyText(msg);

    if (msg.deleted || (!bodyText && !msg.mediaFile && !msg.omitted)) {
      inner += `
        <div class="deleted-text">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/></svg>
          <span>This message was deleted</span>
        </div>
      `;
    } else if (msg.mediaFile) {
      const kind = mediaKind(msg.mediaFile);
      const isStandalone = !bodyText;
      inner += `<div class="media-slot ${isStandalone ? 'is-standalone' : ''}" data-filename="${escapeHtml(msg.mediaFile)}" data-kind="${kind}" data-idx="${idx}"></div>`;

      if (bodyText) {
        inner += `<div class="msg-text">${formatMessageText(bodyText, term)}</div>`;
      }
    } else if (msg.omitted) {
      inner += `
        <div class="media-placeholder">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          <span>Media omitted in WhatsApp export</span>
        </div>
      `;
    } else {
      if (bodyText) {
        inner += `<div class="msg-text">${formatMessageText(bodyText, term)}</div>`;
      }
    }

    // Meta Timestamp & Ticks
    inner += `
      <span class="meta-row">
        ${msg.edited ? '<span class="edited-tag">edited</span>' : ''}
        ${formatTime(msg.date)}
        ${isOut ? `
          <svg class="tick-blue" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17l-3.29-3.29-1.41 1.41 4.7 4.7 12-12-1.42-1.41zM.41 13.29L5.11 18l1.41-1.41-4.7-4.7-1.41 1.4z"/>
          </svg>
        ` : ''}
      </span>
    `;

    bubble.innerHTML = inner;
    row.appendChild(bubble);
    return row;
  }

  observeMediaSlots() {
    const slots = this.messagesScroll.querySelectorAll('.media-slot');
    slots.forEach(slot => {
      if (this.mediaObserver) {
        this.mediaObserver.observe(slot);
      } else {
        this.loadMediaSlot(slot);
      }
    });
  }

  async loadMediaSlot(slot) {
    const filename = slot.getAttribute('data-filename');
    const kind = slot.getAttribute('data-kind');
    const idx = parseInt(slot.getAttribute('data-idx'), 10);

    slot.className = 'media-loading';
    slot.innerHTML = '<div class="spinner sm"></div><span>Loading media...</span>';

    const hasFile = this.app.zipHandler.hasMedia(filename);
    if (!hasFile) {
      slot.className = 'media-placeholder';
      slot.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
        <div>
          <b>${escapeHtml(filename)}</b>
          <div style="font-size:11.5px; color:var(--text-secondary);">Media file not included in export</div>
        </div>
      `;
      return;
    }

    try {
      const url = await this.app.zipHandler.getMediaUrl(filename);
      const ext = getExt(filename);

      if (kind === 'image' || kind === 'sticker') {
        slot.className = kind === 'sticker' ? 'media-wrap media-sticker-wrap' : 'media-wrap media-img-wrap';
        slot.innerHTML = `
          <img src="${url}" alt="${escapeHtml(filename)}" loading="lazy">
          <div class="media-zoom-overlay">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5L20.49 19l-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14zM12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></svg>
          </div>
        `;
        slot.addEventListener('click', () => {
          this.app.mediaViewer.openLightbox(filename);
        });
      } else if (kind === 'video') {
        slot.className = 'media-wrap media-video-wrap';
        slot.innerHTML = `<video src="${url}" controls preload="metadata" playsinline></video>`;
      } else if (kind === 'audio') {
        slot.className = 'media-wrap';
        slot.style.background = 'transparent';
        const msg = this.app.state.messages[idx];
        const player = new AudioPlayer(slot, url, msg ? msg.sender : '');
        this.activeAudioPlayers.set(idx, player);
      } else {
        // Document / File Card
        const entry = this.app.zipHandler.getEntry(filename);
        const sizeText = entry && entry._data ? formatBytes(entry._data.uncompressedSize) : '';

        slot.className = 'file-card';
        slot.innerHTML = `
          <div class="file-icon ${kind}">${getFileIconSvg(kind)}</div>
          <div class="file-info">
            <b>${escapeHtml(filename)}</b>
            <span>${ext.toUpperCase()} ${sizeText ? `• ${sizeText}` : ''} • Tap to open</span>
          </div>
          <svg class="file-download-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.49 7.49 0 0 0-7.35 6.04A5.994 5.994 0 0 0 0 16a6 6 0 0 0 6 6h13a5 5 0 0 0 5-5c0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" transform="rotate(180 12 13)"/>
          </svg>
        `;
        slot.addEventListener('click', async () => {
          const blob = await this.app.zipHandler.getMediaBlob(filename);
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            a.click();
          }
        });
      }
    } catch (err) {
      console.error('Error rendering media slot:', err);
      slot.className = 'media-placeholder';
      slot.innerHTML = `<span>Could not load ${escapeHtml(filename)}</span>`;
    }
  }

  updateSearchHighlight(term) {
    this.app.state.messages.forEach((msg, idx) => {
      const row = document.getElementById(`msgrow-${idx}`);
      if (!row) return;

      if (msg.isSystem) {
        const b = row.querySelector('.bubble.system');
        if (b) b.innerHTML = formatMessageText(describeSystemMessage(msg.text), term);
        return;
      }

      const bodyText = this.computeBodyText(msg);
      const textEl = row.querySelector('.msg-text');
      if (bodyText && textEl) {
        textEl.innerHTML = formatMessageText(bodyText, term);
      }
    });
  }

  renderHeaderAndSidebar() {
    const { participants, meSender, messages } = this.app.state;
    const others = participants.filter(p => p !== meSender);
    let title, subtitle, isGroup;

    if (meSender === null) {
      title = participants.length > 2 ? 'Group chat' : (participants[0] || 'Chat');
      subtitle = participants.join(', ');
      isGroup = participants.length > 2;
    } else if (others.length <= 1) {
      title = others[0] || 'Chat';
      subtitle = `Viewing as ${meSender}`;
      isGroup = false;
    } else {
      title = 'Group chat';
      subtitle = `Viewing as ${meSender} • ${others.join(', ')}`;
      isGroup = true;
    }

    this.app.state.chatTitle = title;

    // Header updates
    this.headerAvatar.style.background = colorFor(title);
    this.headerAvatar.className = `avatar${isGroup ? ' group' : ''}`;
    this.headerAvatar.textContent = isGroup ? '👥' : initials(title);
    this.headerName.textContent = title;
    this.headerSub.textContent = subtitle;

    // Sidebar updates
    this.sidebarEmpty.style.display = 'none';
    this.sidebarSubtitle.textContent = `${participants.length} participant${participants.length === 1 ? '' : 's'}`;

    const lastMsg = [...messages].reverse().find(m => !m.isSystem) || messages[messages.length - 1];
    const preview = lastMsg ? (lastMsg.mediaFile ? '📎 Media' : lastMsg.text.slice(0, 40)) : '';
    const time = lastMsg && lastMsg.date ? formatTime(lastMsg.date) : '';

    let item = this.sidebarList.querySelector('.chat-item');
    if (!item) {
      item = document.createElement('div');
      item.className = 'chat-item active';
      this.sidebarList.appendChild(item);
      item.addEventListener('click', () => {
        document.body.classList.add('chat-open');
      });
    }

    item.innerHTML = `
      <div class="avatar${isGroup ? ' group' : ''}" style="background:${colorFor(title)}">
        ${isGroup ? '👥' : initials(title)}
      </div>
      <div class="meta">
        <div class="row1">
          <span class="name">${escapeHtml(title)}</span>
          <span class="time">${time}</span>
        </div>
        <div class="row2">
          <span class="preview">${escapeHtml(preview)}</span>
          <span class="badge">${messages.length.toLocaleString()}</span>
        </div>
      </div>
    `;
  }

  cleanupAudioPlayers() {
    this.activeAudioPlayers.forEach(p => p.destroy());
    this.activeAudioPlayers.clear();
  }
}
