/**
 * WhatsApp Chat Viewer - Search & Date Jump
 */

import { debounce, showToast } from './utils.js';

export class SearchController {
  constructor(app) {
    this.app = app;
    this.searchTerm = '';
    this.matches = []; // array of message indices
    this.currentIndex = -1;

    this.searchBar = document.getElementById('searchBar');
    this.searchInput = document.getElementById('searchInput');
    this.searchCount = document.getElementById('searchCount');
    this.searchDateInput = document.getElementById('searchDateInput');
    this.prevBtn = document.getElementById('searchPrevBtn');
    this.nextBtn = document.getElementById('searchNextBtn');
    this.closeBtn = document.getElementById('searchCloseBtn');

    this.bindEvents();
  }

  bindEvents() {
    const debouncedSearch = debounce((term) => this.performSearch(term), 150);

    this.searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigate(e.shiftKey ? -1 : 1);
      }
      if (e.key === 'Escape') {
        this.close();
      }
    });

    this.prevBtn.addEventListener('click', () => this.navigate(-1));
    this.nextBtn.addEventListener('click', () => this.navigate(1));
    this.closeBtn.addEventListener('click', () => this.close());

    this.searchDateInput.addEventListener('change', (e) => {
      this.jumpToDate(e.target.value);
    });
  }

  open() {
    if (!this.app.state.fileLoaded) return;
    this.searchBar.classList.add('open');
    setTimeout(() => this.searchInput.focus(), 200);
  }

  close() {
    this.searchBar.classList.remove('open');
    this.searchInput.value = '';
    this.searchDateInput.value = '';
    this.performSearch('');
  }

  toggle() {
    if (this.searchBar.classList.contains('open')) {
      this.close();
    } else {
      this.open();
    }
  }

  performSearch(term) {
    this.searchTerm = term.trim();
    this.app.state.searchTerm = this.searchTerm;
    this.app.renderer.updateSearchHighlight(this.searchTerm);

    if (!this.searchTerm) {
      this.matches = [];
      this.currentIndex = -1;
      this.searchCount.textContent = '';
      this.clearActiveHighlight();
      return;
    }

    const query = this.searchTerm.toLowerCase();
    this.matches = [];

    this.app.state.messages.forEach((msg, idx) => {
      const haystack = `${msg.text || ''} ${msg.sender || ''} ${msg.mediaFile || ''}`.toLowerCase();
      if (haystack.includes(query)) {
        this.matches.push(idx);
      }
    });

    this.currentIndex = this.matches.length > 0 ? 0 : -1;
    this.updateCounterAndScroll();
  }

  navigate(direction) {
    if (this.matches.length === 0) return;
    this.currentIndex = (this.currentIndex + direction + this.matches.length) % this.matches.length;
    this.updateCounterAndScroll();
  }

  clearActiveHighlight() {
    document.querySelectorAll('.msg-row.search-active').forEach(r => r.classList.remove('search-active'));
  }

  updateCounterAndScroll() {
    this.clearActiveHighlight();

    if (this.matches.length === 0) {
      this.searchCount.textContent = this.searchTerm ? '0 / 0' : '';
      return;
    }

    this.searchCount.textContent = `${this.currentIndex + 1} / ${this.matches.length}`;
    const targetMsgIdx = this.matches[this.currentIndex];
    const rowEl = document.getElementById(`msgrow-${targetMsgIdx}`);

    if (rowEl) {
      rowEl.classList.add('search-active');
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  jumpToDate(dateStr) {
    if (!dateStr) return;
    const targetTime = new Date(`${dateStr}T00:00:00`).getTime();
    const dateSeps = Array.from(document.querySelectorAll('.date-sep-wrap'));

    if (dateSeps.length === 0) return;

    let targetSep = dateSeps.find(s => parseInt(s.dataset.timestamp, 10) >= targetTime);
    if (!targetSep) targetSep = dateSeps[dateSeps.length - 1];

    targetSep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const pill = targetSep.querySelector('.date-sep');
    if (pill) {
      pill.classList.remove('flash');
      void pill.offsetWidth;
      pill.classList.add('flash');
      showToast(`Jumped to ${pill.textContent}`);
    }
  }
}
