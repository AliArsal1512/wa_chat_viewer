/**
 * WhatsApp Chat Viewer - Export & Print Utilities
 */

import { escapeHtml, formatDateLabel, formatTime } from './utils.js';

export class ExportController {
  constructor(app) {
    this.app = app;
  }

  printChat() {
    window.print();
  }

  exportJson() {
    const { messages, participants, chatTitle } = this.app.state;
    if (!messages || messages.length === 0) return;

    const exportData = {
      title: chatTitle,
      exportDate: new Date().toISOString(),
      participants,
      totalMessages: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        sender: m.sender,
        date: m.date ? m.date.toISOString() : null,
        text: m.text,
        mediaFile: m.mediaFile,
        isSystem: m.isSystem,
        deleted: m.deleted,
        edited: m.edited
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    this.triggerDownload(blob, `${chatTitle || 'whatsapp-chat'}.json`);
  }

  exportHtml() {
    const { messages, chatTitle, meSender } = this.app.state;
    if (!messages || messages.length === 0) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(chatTitle)} - Exported WhatsApp Chat</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #efeae2; margin: 0; padding: 20px; }
  .chat-container { max-width: 800px; margin: 0 auto; background: #efeae2; display: flex; flex-direction: column; gap: 8px; }
  .header { text-align: center; margin-bottom: 20px; color: #54656f; font-size: 14px; }
  .msg-row { display: flex; width: 100%; }
  .msg-row.out { justify-content: flex-end; }
  .msg-row.in { justify-content: flex-start; }
  .msg-row.system { justify-content: center; margin: 8px 0; }
  .bubble { max-width: 70%; padding: 8px 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); font-size: 14px; line-height: 1.4; word-break: break-word; white-space: pre-wrap; }
  .bubble.in { background: #ffffff; color: #111b21; }
  .bubble.out { background: #d9fdd3; color: #111b21; }
  .bubble.system { background: #ffffff; color: #54656f; font-size: 12px; max-width: 80%; text-align: center; }
  .sender { font-weight: 600; font-size: 12px; margin-bottom: 2px; display: block; color: #00a884; }
  .meta { float: right; margin-left: 10px; font-size: 11px; color: #667781; }
</style>
</head>
<body>
<div class="chat-container">
  <div class="header">
    <h2>${escapeHtml(chatTitle)}</h2>
    <p>Exported ${messages.length} messages on ${new Date().toLocaleDateString()}</p>
  </div>
  ${messages.map(m => {
    if (m.isSystem) {
      return `<div class="msg-row system"><div class="bubble system">${escapeHtml(m.text)}</div></div>`;
    }
    const isOut = meSender !== null && m.sender === meSender;
    return `
      <div class="msg-row ${isOut ? 'out' : 'in'}">
        <div class="bubble ${isOut ? 'out' : 'in'}">
          ${!isOut && m.sender ? `<span class="sender">${escapeHtml(m.sender)}</span>` : ''}
          ${m.mediaFile ? `<div>📎 <i>[Attachment: ${escapeHtml(m.mediaFile)}]</i></div>` : ''}
          ${escapeHtml(m.text || '')}
          <span class="meta">${m.date ? formatTime(m.date) : ''}</span>
        </div>
      </div>
    `;
  }).join('')}
</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    this.triggerDownload(blob, `${chatTitle || 'whatsapp-chat'}.html`);
  }

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
