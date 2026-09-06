/**
 * WhatsApp Chat Viewer - Main Application Orchestrator
 */

import { ExportController } from './export.js';
import { MediaViewer } from './media-viewer.js';
import { parseChat } from './parser.js';
import { MessageRenderer } from './renderer.js';
import { SearchController } from './search.js';
import { ChatStats } from './stats.js';
import { colorFor, escapeHtml, initials, showToast } from './utils.js';
import { ZipHandler } from './zip-handler.js';

class App {
  constructor() {
    this.state = {
      theme: localStorage.getItem('wa_theme') || 'light',
      messages: [],
      participants: [],
      meSender: null,
      chatTitle: 'Chat',
      fileLoaded: false,
      searchTerm: ''
    };

    // Instantiate Sub-Systems
    this.zipHandler = new ZipHandler();
    this.renderer = new MessageRenderer(this);
    this.mediaViewer = new MediaViewer(this.zipHandler);
    this.stats = new ChatStats();
    this.exporter = new ExportController(this);

    this.initDomRefs();
    this.bindEvents();
    this.applyTheme(this.state.theme);

    // Initialized after DOM ready
    this.search = new SearchController(this);
  }

  initDomRefs() {
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('fileInput');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingText = document.getElementById('loadingText');
    this.uploadScreen = document.getElementById('uploadScreen');
    this.chatHeader = document.getElementById('chatHeader');
    this.messagesScroll = document.getElementById('messagesScroll');
    this.inputBar = document.getElementById('inputBar');
    this.sidebar = document.getElementById('sidebar');
    this.sidebarResizer = document.getElementById('sidebarResizer');
    this.sidebarList = document.getElementById('sidebarList');
    this.sidebarEmpty = document.getElementById('sidebarEmpty');
    this.sidebarSubtitle = document.getElementById('sidebarSubtitle');
    this.fabBottom = document.getElementById('fabBottom');
    this.fabTop = document.getElementById('fabTop');
    this.privacyBanner = document.getElementById('privacyBanner');
    this.privacyBannerClose = document.getElementById('privacyBannerClose');

    // Perspective Modal
    this.perspModalOverlay = document.getElementById('perspModalOverlay');
    this.perspOptions = document.getElementById('perspOptions');
    this.perspContinue = document.getElementById('perspContinue');
    this.perspSkip = document.getElementById('perspSkip');

    // Header Actions
    this.menuBtn = document.getElementById('menuBtn');
    this.menuDropdown = document.getElementById('menuDropdown');
    this.backBtn = document.getElementById('backBtn');
    this.searchToggleBtn = document.getElementById('searchToggleBtn');
    this.galleryBtn = document.getElementById('galleryBtn');
    this.statsBtn = document.getElementById('statsBtn');
  }

  bindEvents() {
    // Theme Toggles
    document.getElementById('themeToggleSidebar')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('themeToggleHeader')?.addEventListener('click', () => this.toggleTheme());

    // Sidebar Horizontal Resizer
    this.initSidebarResizer();

    // Privacy Banner Dismiss
    this.privacyBannerClose?.addEventListener('click', () => {
      this.privacyBanner.style.display = 'none';
      sessionStorage.setItem('wa_privacy_banner_dismissed', 'true');
    });

    // File Drag & Drop
    ['dragenter', 'dragover'].forEach(evt => {
      this.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        this.dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      this.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('dragover');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
    });

    // Perspective Modal Handlers
    this.perspContinue.addEventListener('click', () => {
      if (this.pendingPersp !== undefined) {
        this.state.meSender = this.pendingPersp;
        this.finishLoadingChat();
      }
    });

    this.perspSkip.addEventListener('click', () => {
      this.state.meSender = null;
      this.finishLoadingChat();
    });

    // Mobile Back Button
    this.backBtn.addEventListener('click', () => {
      document.body.classList.remove('chat-open');
    });

    // Search Toggle
    this.searchToggleBtn.addEventListener('click', () => {
      this.search.toggle();
    });

    // Gallery & Stats Buttons
    this.galleryBtn?.addEventListener('click', () => this.mediaViewer.openGallery());
    this.statsBtn?.addEventListener('click', () => this.stats.open(this.state.messages, this.state.participants));

    // Dropdown Menu
    this.menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.menuDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      this.menuDropdown.classList.remove('open');
    });

    document.getElementById('menuChangePersp')?.addEventListener('click', () => {
      this.menuDropdown.classList.remove('open');
      this.openPerspectiveModal();
    });

    document.getElementById('menuViewGallery')?.addEventListener('click', () => {
      this.menuDropdown.classList.remove('open');
      this.mediaViewer.openGallery();
    });

    document.getElementById('menuViewStats')?.addEventListener('click', () => {
      this.menuDropdown.classList.remove('open');
      this.stats.open(this.state.messages, this.state.participants);
    });

    document.getElementById('menuPrint')?.addEventListener('click', () => {
      this.menuDropdown.classList.remove('open');
      this.exporter.printChat();
    });

    document.getElementById('menuExportHtml')?.addEventListener('click', () => {
      this.menuDropdown.classList.remove('open');
      this.exporter.exportHtml();
    });

    document.getElementById('menuExportJson')?.addEventListener('click', () => {
      this.menuDropdown.classList.remove('open');
      this.exporter.exportJson();
    });

    document.getElementById('menuUploadNew')?.addEventListener('click', () => this.resetApp());
    document.getElementById('newChatBtn')?.addEventListener('click', () => this.fileInput.click());

    // Scroll Floating Buttons
    this.messagesScroll.addEventListener('scroll', () => {
      const distFromBottom = this.messagesScroll.scrollHeight - this.messagesScroll.scrollTop - this.messagesScroll.clientHeight;
      this.fabBottom.classList.toggle('show', distFromBottom > 350);
      this.fabTop.classList.toggle('show', this.messagesScroll.scrollTop > 350);
    });

    this.fabBottom.addEventListener('click', () => {
      this.messagesScroll.scrollTo({ top: this.messagesScroll.scrollHeight, behavior: 'smooth' });
    });

    this.fabTop.addEventListener('click', () => {
      this.messagesScroll.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  initSidebarResizer() {
    if (!this.sidebar || !this.sidebarResizer) return;

    // Load saved sidebar width
    const savedWidth = localStorage.getItem('wa_sidebar_width');
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (w >= 280 && w <= 650) {
        this.sidebar.style.width = `${w}px`;
      }
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    this.sidebarResizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startWidth = this.sidebar.getBoundingClientRect().width;
      this.sidebarResizer.classList.add('is-resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent) => {
        if (!isResizing) return;
        const deltaX = moveEvent.clientX - startX;
        const minW = 280;
        const maxW = Math.min(650, window.innerWidth * 0.6);
        const newWidth = Math.max(minW, Math.min(maxW, startWidth + deltaX));
        this.sidebar.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        if (!isResizing) return;
        isResizing = false;
        this.sidebarResizer.classList.remove('is-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const currentWidth = parseInt(this.sidebar.style.width, 10);
        if (!isNaN(currentWidth)) {
          localStorage.setItem('wa_sidebar_width', currentWidth);
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  setLoading(show, text = 'Processing...') {
    this.loadingOverlay.style.display = show ? 'flex' : 'none';
    if (text) this.loadingText.textContent = text;
  }

  toggleTheme() {
    const nextTheme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  }

  applyTheme(theme) {
    this.state.theme = theme;
    localStorage.setItem('wa_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    const sunSvg = '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
    const moonSvg = '<path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>';

    const iconHtml = theme === 'dark' ? moonSvg : sunSvg;
    const sidebarIcon = document.getElementById('themeIconSidebar');
    const headerIcon = document.getElementById('themeIconHeader');

    if (sidebarIcon) sidebarIcon.innerHTML = iconHtml;
    if (headerIcon) headerIcon.innerHTML = iconHtml;
  }

  async handleFile(file) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.txt') && !name.endsWith('.zip')) {
      showToast('Please upload a .txt or .zip WhatsApp export.');
      return;
    }

    this.setLoading(true, 'Reading uploaded export...');

    try {
      let rawChatText = '';

      if (name.endsWith('.zip')) {
        const result = await this.zipHandler.loadZip(file, (msg) => this.setLoading(true, msg));
        rawChatText = result.chatText;
      } else {
        this.zipHandler.cleanup();
        rawChatText = await file.text();
      }

      this.setLoading(true, 'Parsing messages & media links...');
      await new Promise(r => setTimeout(r, 40));

      const messages = parseChat(rawChatText);
      if (messages.length === 0) {
        this.setLoading(false);
        showToast("Couldn't find any WhatsApp messages in this file.");
        return;
      }

      this.state.messages = messages;

      // Extract unique participants
      const seen = new Set();
      this.state.participants = [];
      messages.forEach(m => {
        if (m.sender && !seen.has(m.sender)) {
          seen.add(m.sender);
          this.state.participants.push(m.sender);
        }
      });

      // Prepare MediaViewer list
      const mediaEntries = [];
      messages.forEach(m => {
        if (m.mediaFile) {
          mediaEntries.push({
            name: m.mediaFile,
            kind: this.zipHandler.getEntry(m.mediaFile) ? undefined : 'file',
            msgIndex: m.id,
            date: m.date
          });
        }
      });
      this.mediaViewer.setMediaList(this.zipHandler.getAllMedia());

      this.setLoading(false);
      this.openPerspectiveModal();
    } catch (err) {
      console.error(err);
      this.setLoading(false);
      showToast(err.message || 'Error processing this file.');
    }
  }

  openPerspectiveModal() {
    this.perspOptions.innerHTML = '';
    this.pendingPersp = undefined;
    this.perspContinue.disabled = true;

    this.state.participants.forEach(p => {
      const opt = document.createElement('div');
      opt.className = 'persp-option';
      if (this.state.meSender === p) {
        opt.classList.add('selected');
        this.pendingPersp = p;
        this.perspContinue.disabled = false;
      }

      opt.innerHTML = `
        <div class="avatar sm" style="background:${colorFor(p)}">${initials(p)}</div>
        <div class="label">${escapeHtml(p)}</div>
        <div class="radio"></div>
      `;

      opt.addEventListener('click', () => {
        this.perspOptions.querySelectorAll('.persp-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.pendingPersp = p;
        this.perspContinue.disabled = false;
      });

      this.perspOptions.appendChild(opt);
    });

    this.perspModalOverlay.classList.add('open');
  }

  finishLoadingChat() {
    this.perspModalOverlay.classList.remove('open');
    this.uploadScreen.style.display = 'none';
    this.chatHeader.style.display = 'flex';
    this.messagesScroll.style.display = 'flex';
    this.inputBar.style.display = 'flex';
    this.state.fileLoaded = true;

    // Show Privacy Banner if not dismissed in this session
    if (sessionStorage.getItem('wa_privacy_banner_dismissed') !== 'true' && this.privacyBanner) {
      this.privacyBanner.style.display = 'flex';
    }

    this.renderer.renderHeaderAndSidebar();
    this.renderer.renderChat();

    document.body.classList.add('chat-open');
    showToast(`Loaded ${this.state.messages.length.toLocaleString()} messages successfully!`);
  }

  resetApp() {
    this.menuDropdown.classList.remove('open');
    this.zipHandler.cleanup();
    this.renderer.cleanupAudioPlayers();

    if (this.privacyBanner) {
      this.privacyBanner.style.display = 'none';
    }

    this.state.messages = [];
    this.state.participants = [];
    this.state.meSender = null;
    this.state.fileLoaded = false;
    this.state.searchTerm = '';

    this.search.close();
    this.uploadScreen.style.display = 'flex';
    this.chatHeader.style.display = 'none';
    this.messagesScroll.style.display = 'none';
    this.inputBar.style.display = 'none';
    this.messagesScroll.innerHTML = '';

    const item = this.sidebarList.querySelector('.chat-item');
    if (item) item.remove();

    this.sidebarEmpty.style.display = 'flex';
    this.sidebarSubtitle.textContent = 'No chat loaded';
    this.fileInput.value = '';
    document.body.classList.remove('chat-open');
  }
}

// Initialize on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
