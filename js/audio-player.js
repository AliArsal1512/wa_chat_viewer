/**
 * WhatsApp Chat Viewer - Voice Note & Audio Player
 * Custom WhatsApp-style audio player with waveform, scrubbing and speed control.
 */

import { formatDuration } from './utils.js';

let currentActivePlayer = null;

export class AudioPlayer {
  constructor(containerEl, audioUrl, senderName = '') {
    this.container = containerEl;
    this.audioUrl = audioUrl;
    this.senderName = senderName;
    this.audio = new Audio(audioUrl);
    this.isPlaying = false;
    this.playbackRate = 1.0;
    this.duration = 0;
    this.currentTime = 0;
    this.barCount = 30;
    this.bars = [];

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="wa-audio-player">
        <div class="wa-audio-avatar">
          <span>🎤</span>
          <div class="wa-audio-mic-badge">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
        </div>
        <div class="wa-audio-controls">
          <div class="wa-audio-top-row">
            <button class="wa-audio-play-btn" aria-label="Play voice note">
              <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <div class="wa-audio-waveform" role="slider" aria-label="Audio progress" tabindex="0"></div>
          </div>
          <div class="wa-audio-bottom-row">
            <span class="wa-audio-time">0:00</span>
            <button class="wa-audio-speed-btn" title="Toggle playback speed">1x</button>
          </div>
        </div>
      </div>
    `;

    this.playBtn = this.container.querySelector('.wa-audio-play-btn');
    this.playIcon = this.container.querySelector('.play-icon');
    this.pauseIcon = this.container.querySelector('.pause-icon');
    this.waveformEl = this.container.querySelector('.wa-audio-waveform');
    this.timeEl = this.container.querySelector('.wa-audio-time');
    this.speedBtn = this.container.querySelector('.wa-audio-speed-btn');

    // Generate simulated waveform bars
    this.waveformEl.innerHTML = '';
    this.bars = [];
    // Pseudo-random deterministic heights based on URL
    let seed = 0;
    for (let i = 0; i < this.audioUrl.length; i++) seed += this.audioUrl.charCodeAt(i);

    for (let i = 0; i < this.barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'wa-wave-bar';
      // Pseudo random bar height between 4px and 22px
      const h = Math.max(4, Math.floor(((Math.sin(seed * (i + 1)) + 1) / 2) * 18 + 4));
      bar.style.setProperty('--bar-h', `${h}px`);
      this.waveformEl.appendChild(bar);
      this.bars.push(bar);
    }
  }

  bindEvents() {
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio.duration || 0;
      this.timeEl.textContent = formatDuration(this.duration);
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
      this.updateProgress();
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.playIcon.style.display = 'block';
      this.pauseIcon.style.display = 'none';
      this.currentTime = 0;
      this.updateProgress();
      this.timeEl.textContent = formatDuration(this.duration);
    });

    this.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlay();
    });

    this.waveformEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = this.waveformEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (this.duration) {
        this.audio.currentTime = ratio * this.duration;
      }
    });

    this.speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSpeed();
    });
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (currentActivePlayer && currentActivePlayer !== this) {
      currentActivePlayer.pause();
    }
    currentActivePlayer = this;

    this.audio.playbackRate = this.playbackRate;
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.playIcon.style.display = 'none';
      this.pauseIcon.style.display = 'block';
    }).catch(err => {
      console.warn('Audio play failed:', err);
    });
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.playIcon.style.display = 'block';
    this.pauseIcon.style.display = 'none';
  }

  toggleSpeed() {
    if (this.playbackRate === 1.0) {
      this.playbackRate = 1.5;
    } else if (this.playbackRate === 1.5) {
      this.playbackRate = 2.0;
    } else {
      this.playbackRate = 1.0;
    }
    this.audio.playbackRate = this.playbackRate;
    this.speedBtn.textContent = `${this.playbackRate}x`;
  }

  updateProgress() {
    if (!this.duration) return;
    const progress = this.currentTime / this.duration;
    const activeBarIndex = Math.floor(progress * this.barCount);

    this.bars.forEach((bar, idx) => {
      bar.classList.toggle('played', idx <= activeBarIndex);
    });

    this.timeEl.textContent = formatDuration(this.currentTime);
  }

  destroy() {
    this.pause();
    this.audio.src = '';
    this.audio.load();
  }
}
