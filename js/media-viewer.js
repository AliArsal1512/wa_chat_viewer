/**
 * WhatsApp Chat Viewer - Lightbox & Media Gallery
 */

import { formatBytes, getExt, getFileIconSvg } from './utils.js';

export class MediaViewer {
  constructor(zipHandler) {
    this.zipHandler = zipHandler;
    this.mediaList = []; // list of { name, kind, url, msgIndex, date }
    this.currentIndex = -1;
    this.zoomLevel = 1;
    this.rotation = 0;

    this.initLightboxDom();
    this.initGalleryDom();
    this.bindEvents();
  }

  initLightboxDom() {
    this.lightboxEl = document.createElement('div');
    this.lightboxEl.className = 'lightbox-overlay';
    this.lightboxEl.id = 'lightboxOverlay';
    this.lightboxEl.innerHTML = `
      <div class="lightbox-topbar">
        <div class="lightbox-info">
          <span class="lightbox-title" id="lightboxTitle">Media</span>
          <span class="lightbox-sub" id="lightboxSub">1 of 1</span>
        </div>
        <div class="lightbox-actions">
          <button class="icon-btn" id="lightboxZoomIn" title="Zoom in">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button class="icon-btn" id="lightboxZoomOut" title="Zoom out">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
          </button>
          <button class="icon-btn" id="lightboxRotate" title="Rotate 90°">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72.98-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.86-1.6-.99-2.47zm1.01 5.36c1.16.9 2.51 1.44 3.9 1.61V17.95c-.87-.15-1.71-.49-2.46-.99L7.1 18.36zM13 4.07V1L8.45 5.55 13 10V6.09c3.37 0 6.09 2.72 6.09 6.09s-2.72 6.09-6.09 6.09v2.02c4.48 0 8.11-3.63 8.11-8.11S17.48 4.07 13 4.07z"/></svg>
          </button>
          <button class="icon-btn" id="lightboxDownload" title="Download">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.49 7.49 0 0 0-7.35 6.04A5.994 5.994 0 0 0 0 16a6 6 0 0 0 6 6h13a5 5 0 0 0 5-5c0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" transform="rotate(180 12 13)"/></svg>
          </button>
          <button class="icon-btn" id="lightboxClose" title="Close (Esc)">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>
      <div class="lightbox-content" id="lightboxContent">
        <div class="lightbox-media-container" id="lightboxMediaContainer"></div>
        <div class="lightbox-nav-btn lightbox-prev" id="lightboxPrev" title="Previous (Left arrow)">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </div>
        <div class="lightbox-nav-btn lightbox-next" id="lightboxNext" title="Next (Right arrow)">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </div>
      </div>
    `;
    document.body.appendChild(this.lightboxEl);
  }

  initGalleryDom() {
    this.galleryEl = document.createElement('div');
    this.galleryEl.className = 'modal-overlay';
    this.galleryEl.id = 'galleryModalOverlay';
    this.galleryEl.innerHTML = `
      <div class="modal-box gallery-modal-box">
        <div class="gallery-header">
          <h2>Media, Links & Docs</h2>
          <button class="icon-btn" id="galleryCloseBtn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div class="gallery-tabs">
          <button class="gallery-tab active" data-filter="all">All Media</button>
          <button class="gallery-tab" data-filter="image">Photos</button>
          <button class="gallery-tab" data-filter="video">Videos</button>
          <button class="gallery-tab" data-filter="audio">Voice & Audio</button>
          <button class="gallery-tab" data-filter="doc">Documents</button>
        </div>
        <div class="gallery-grid-scroll">
          <div class="gallery-grid" id="galleryGrid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this.galleryEl);
  }

  bindEvents() {
    // Lightbox Controls
    document.getElementById('lightboxClose').addEventListener('click', () => this.closeLightbox());
    document.getElementById('lightboxPrev').addEventListener('click', () => this.prev());
    document.getElementById('lightboxNext').addEventListener('click', () => this.next());
    document.getElementById('lightboxZoomIn').addEventListener('click', () => this.zoom(0.25));
    document.getElementById('lightboxZoomOut').addEventListener('click', () => this.zoom(-0.25));
    document.getElementById('lightboxRotate').addEventListener('click', () => this.rotate());
    document.getElementById('lightboxDownload').addEventListener('click', () => this.downloadCurrent());

    // Lightbox backdrop click to close
    this.lightboxEl.addEventListener('click', (e) => {
      if (e.target.id === 'lightboxContent' || e.target.id === 'lightboxMediaContainer') {
        this.closeLightbox();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.lightboxEl.classList.contains('open')) return;
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
      if (e.key === '+' || e.key === '=') this.zoom(0.25);
      if (e.key === '-') this.zoom(-0.25);
      if (e.key.toLowerCase() === 'r') this.rotate();
    });

    // Gallery Controls
    document.getElementById('galleryCloseBtn').addEventListener('click', () => this.closeGallery());
    this.galleryEl.addEventListener('click', (e) => {
      if (e.target === this.galleryEl) this.closeGallery();
    });

    this.galleryEl.querySelectorAll('.gallery-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.galleryEl.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderGalleryGrid(tab.dataset.filter);
      });
    });
  }

  setMediaList(list) {
    this.mediaList = list;
  }

  openLightbox(filename) {
    const idx = this.mediaList.findIndex(m => m.name.toLowerCase() === filename.toLowerCase());
    if (idx !== -1) {
      this.currentIndex = idx;
    } else {
      this.currentIndex = 0;
    }
    this.zoomLevel = 1;
    this.rotation = 0;
    this.renderLightboxCurrent();
    this.lightboxEl.classList.add('open');
  }

  closeLightbox() {
    this.lightboxEl.classList.remove('open');
    const container = document.getElementById('lightboxMediaContainer');
    container.innerHTML = '';
  }

  async renderLightboxCurrent() {
    if (this.currentIndex < 0 || this.currentIndex >= this.mediaList.length) return;

    const item = this.mediaList[this.currentIndex];
    const container = document.getElementById('lightboxMediaContainer');
    const titleEl = document.getElementById('lightboxTitle');
    const subEl = document.getElementById('lightboxSub');

    titleEl.textContent = item.name;
    subEl.textContent = `${this.currentIndex + 1} of ${this.mediaList.length}`;

    container.innerHTML = '<div class="spinner"></div>';
    this.applyTransform();

    const url = item.url || await this.zipHandler.getMediaUrl(item.name);
    if (!url) {
      container.innerHTML = `<span style="color:#fff;">Could not load ${item.name}</span>`;
      return;
    }

    if (item.kind === 'video') {
      container.innerHTML = `<video src="${url}" controls autoplay playsinline style="max-height:80vh; max-width:90vw;"></video>`;
    } else {
      container.innerHTML = `<img src="${url}" alt="${item.name}" draggable="false">`;
    }
  }

  prev() {
    if (this.mediaList.length <= 1) return;
    this.currentIndex = (this.currentIndex - 1 + this.mediaList.length) % this.mediaList.length;
    this.zoomLevel = 1;
    this.rotation = 0;
    this.renderLightboxCurrent();
  }

  next() {
    if (this.mediaList.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.mediaList.length;
    this.zoomLevel = 1;
    this.rotation = 0;
    this.renderLightboxCurrent();
  }

  zoom(delta) {
    this.zoomLevel = Math.max(0.5, Math.min(3.5, this.zoomLevel + delta));
    this.applyTransform();
  }

  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.applyTransform();
  }

  applyTransform() {
    const container = document.getElementById('lightboxMediaContainer');
    if (container) {
      container.style.transform = `scale(${this.zoomLevel}) rotate(${this.rotation}deg)`;
    }
  }

  async downloadCurrent() {
    if (this.currentIndex < 0 || this.currentIndex >= this.mediaList.length) return;
    const item = this.mediaList[this.currentIndex];
    const blob = await this.zipHandler.getMediaBlob(item.name);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ================= Gallery Modal Methods =================
  openGallery() {
    this.galleryEl.classList.add('open');
    this.renderGalleryGrid('all');
  }

  closeGallery() {
    this.galleryEl.classList.remove('open');
  }

  async renderGalleryGrid(filter = 'all') {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:30px;"><div class="spinner sm" style="margin:0 auto 10px;"></div>Loading media items...</div>';

    let items = this.mediaList;
    if (filter === 'image') items = items.filter(m => m.kind === 'image' || m.kind === 'sticker');
    else if (filter === 'video') items = items.filter(m => m.kind === 'video');
    else if (filter === 'audio') items = items.filter(m => m.kind === 'audio');
    else if (filter === 'doc') items = items.filter(m => ['pdf', 'document', 'vcf', 'archive', 'file'].includes(m.kind));

    if (items.length === 0) {
      grid.innerHTML = '<div class="gallery-empty" style="grid-column: 1/-1;"><span>No media items found in this category.</span></div>';
      return;
    }

    grid.innerHTML = '';
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'gallery-item';

      const url = await this.zipHandler.getMediaUrl(item.name);
      if (item.kind === 'image' || item.kind === 'sticker') {
        card.innerHTML = `<img src="${url}" alt="${item.name}" loading="lazy">`;
        card.addEventListener('click', () => {
          this.closeGallery();
          this.openLightbox(item.name);
        });
      } else if (item.kind === 'video') {
        card.innerHTML = `
          <video src="${url}" preload="metadata"></video>
          <div class="gallery-item-video-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Video</div>
        `;
        card.addEventListener('click', () => {
          this.closeGallery();
          this.openLightbox(item.name);
        });
      } else if (item.kind === 'audio') {
        card.innerHTML = `
          <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; gap:6px; background:var(--audio-bg);">
            <div class="wa-audio-avatar" style="width:34px; height:34px; font-size:14px;">🎤</div>
            <b style="font-size:11px; text-align:center; overflow:hidden; text-overflow:ellipsis; width:100%;">${item.name}</b>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; gap:6px;">
            <div class="file-icon ${item.kind}" style="width:34px; height:34px;">${getFileIconSvg(item.kind)}</div>
            <b style="font-size:11px; text-align:center; overflow:hidden; text-overflow:ellipsis; width:100%;">${item.name}</b>
          </div>
        `;
        card.addEventListener('click', async () => {
          const blob = await this.zipHandler.getMediaBlob(item.name);
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = item.name;
            a.click();
          }
        });
      }

      grid.appendChild(card);
    }
  }
}
