/**
 * WhatsApp Chat Viewer - Analytics & Statistics
 */

import { colorFor, formatDateLabel } from './utils.js';

export class ChatStats {
  constructor() {
    this.initModalDom();
  }

  initModalDom() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-overlay';
    this.modalEl.id = 'statsModalOverlay';
    this.modalEl.innerHTML = `
      <div class="modal-box stats-modal-box">
        <div class="modal-header">
          <h2>Conversation Insights</h2>
          <button class="icon-btn" id="statsCloseBtn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <p class="desc">A summary of activity, participant contributions, media, and top emojis.</p>
        <div id="statsContent"></div>
      </div>
    `;
    document.body.appendChild(this.modalEl);

    document.getElementById('statsCloseBtn').addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });
  }

  open(messages, participants) {
    if (!messages || messages.length === 0) return;
    this.computeAndRender(messages, participants);
    this.modalEl.classList.add('open');
  }

  close() {
    this.modalEl.classList.remove('open');
  }

  computeAndRender(messages, participants) {
    let totalWords = 0;
    let totalChars = 0;
    let mediaCount = 0;
    let deletedCount = 0;
    let editedCount = 0;
    const participantCounts = {};
    const participantWords = {};
    const hourlyDistribution = new Array(24).fill(0);
    const dayDistribution = new Array(7).fill(0);
    const emojiCounts = {};
    const activeDates = new Set();

    participants.forEach(p => {
      participantCounts[p] = 0;
      participantWords[p] = 0;
    });

    // Emoji detection regex
    const emojiRegex = /(\p{Extended_Pictographic})/gu;

    messages.forEach(m => {
      if (m.date instanceof Date && !isNaN(m.date.getTime())) {
        hourlyDistribution[m.date.getHours()]++;
        dayDistribution[m.date.getDay()]++;
        activeDates.add(`${m.date.getFullYear()}-${m.date.getMonth()}-${m.date.getDate()}`);
      }

      if (m.mediaFile) mediaCount++;
      if (m.deleted) deletedCount++;
      if (m.edited) editedCount++;

      if (m.text && !m.isSystem) {
        const words = m.text.trim().split(/\s+/).filter(Boolean);
        totalWords += words.length;
        totalChars += m.text.length;

        if (m.sender) {
          participantCounts[m.sender] = (participantCounts[m.sender] || 0) + 1;
          participantWords[m.sender] = (participantWords[m.sender] || 0) + words.length;
        }

        const emojis = m.text.match(emojiRegex);
        if (emojis) {
          emojis.forEach(e => {
            emojiCounts[e] = (emojiCounts[e] || 0) + 1;
          });
        }
      }
    });

    const firstDate = messages[0]?.date;
    const lastDate = messages[messages.length - 1]?.date;
    const daySpan = firstDate && lastDate ? Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24))) : 1;

    // Top Emojis
    const sortedEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Peak hour
    const maxHourCount = Math.max(...hourlyDistribution, 1);

    const contentEl = document.getElementById('statsContent');
    contentEl.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-card-title">Total Messages</span>
          <span class="stat-card-value">${messages.length.toLocaleString()}</span>
          <span class="stat-card-sub">${activeDates.size} active days</span>
        </div>
        <div class="stat-card">
          <span class="stat-card-title">Total Words</span>
          <span class="stat-card-value">${totalWords.toLocaleString()}</span>
          <span class="stat-card-sub">~${Math.round(totalWords / Math.max(1, messages.length))} words / msg</span>
        </div>
        <div class="stat-card">
          <span class="stat-card-title">Media Items</span>
          <span class="stat-card-value">${mediaCount.toLocaleString()}</span>
          <span class="stat-card-sub">${deletedCount} deleted</span>
        </div>
        <div class="stat-card">
          <span class="stat-card-title">Timeline</span>
          <span class="stat-card-value">${daySpan}d</span>
          <span class="stat-card-sub">${firstDate ? formatDateLabel(firstDate) : ''} – ${lastDate ? formatDateLabel(lastDate) : ''}</span>
        </div>
      </div>

      <div class="stats-section">
        <div class="stats-section-title">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          Participant Breakdown
        </div>
        ${participants.map(p => {
          const count = participantCounts[p] || 0;
          const pct = messages.length > 0 ? ((count / messages.length) * 100).toFixed(1) : 0;
          const color = colorFor(p);
          return `
            <div class="participant-bar-item">
              <div class="participant-bar-labels">
                <span class="p-name"><span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>${p}</span>
                <span class="p-count">${count.toLocaleString()} msgs (${pct}%)</span>
              </div>
              <div class="participant-progress-track">
                <div class="participant-progress-fill" style="width:${pct}%; background-color:${color};"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="stats-section">
        <div class="stats-section-title">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
          24-Hour Activity
        </div>
        <div class="hourly-chart">
          ${hourlyDistribution.map((count, hr) => {
            const hPct = Math.round((count / maxHourCount) * 100);
            const label = hr % 4 === 0 ? (hr === 0 ? '12a' : hr === 12 ? '12p' : `${hr % 12}${hr < 12 ? 'a' : 'p'}`) : '';
            return `
              <div class="hourly-bar-col" title="${hr}:00 – ${count} messages">
                <div class="hourly-bar" style="height:${Math.max(4, hPct)}%;"></div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary); margin-top:4px;">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>11 PM</span>
        </div>
      </div>

      ${sortedEmojis.length > 0 ? `
        <div class="stats-section">
          <div class="stats-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
            Top Emojis
          </div>
          <div class="emoji-grid">
            ${sortedEmojis.map(([em, cnt]) => `
              <div class="emoji-pill">
                <span class="emoji-char">${em}</span>
                <span class="emoji-count">${cnt}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }
}
