import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-copilot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="copilot-container">
      <div class="copilot-header">
        <div class="header-title">
          <div class="bot-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="12" cy="5" r="2"></circle>
              <path d="M12 7v4"></path>
              <line x1="8" y1="16" x2="8" y2="16"></line>
              <line x1="16" y1="16" x2="16" y2="16"></line>
            </svg>
          </div>
          <div>
            <h2>AIRAM Copilot</h2>
            <p>Ask anything about your requirements, traceability, or impact analysis.</p>
          </div>
        </div>
        
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="project-selector">
            <select [(ngModel)]="selectedProjectId" (change)="onProjectChange()">
              <option [ngValue]="null">Select Project Context (Global)</option>
              <option *ngFor="let p of projects" [value]="p.id">{{ p.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="chat-history" #scrollContainer>
        <!-- Empty State -->
        <div *ngIf="messages.length === 0" style="text-align: center; margin-top: 40px; color: var(--text-muted);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5; margin-bottom: 16px;">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <h3>How can I help you today?</h3>
          <p>Try asking about requirements coverage, finding orphans, or summarizing quality runs.</p>
        </div>

        <div *ngFor="let msg of messages" class="message-row" [ngClass]="msg.role">
          <div *ngIf="msg.role === 'bot'" class="bot-avatar" style="margin-right: 12px; width: 32px; height: 32px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="12" cy="5" r="2"></circle>
              <path d="M12 7v4"></path>
            </svg>
          </div>
          
          <div class="message-bubble-wrapper">
            <div class="bot-message-header" *ngIf="msg.role === 'bot'">
              <span class="bot-name">AIRAM Copilot</span>
              <span class="message-time">{{ msg.timestamp | date:'shortTime' }}</span>
            </div>
            <div class="message-bubble" [innerHTML]="formatMessage(msg.content)"></div>
          </div>
        </div>
        
        <div *ngIf="isLoading" class="message-row bot">
           <div class="bot-avatar" style="margin-right: 12px; width: 32px; height: 32px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
          </div>
          <div class="message-bubble-wrapper">
            <div class="bot-message-header">
              <span class="bot-name">AIRAM Copilot</span>
            </div>
            <div class="message-bubble">
              <div *ngFor="let step of thinkingSteps" class="thinking-step" style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {{ step }}
              </div>
              <div class="loading-indicator" style="padding: 4px 0;">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Suggestions -->
      <div class="suggestions" *ngIf="messages.length === 0">
        <div class="suggestion-chip" (click)="sendSuggestion('Find Orphans')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          Find Orphans
        </div>
        <div class="suggestion-chip" (click)="sendSuggestion('Traceability Gap Analysis')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          Traceability Gap Analysis
        </div>
        <div class="suggestion-chip" (click)="sendSuggestion('Summarize SWE.1')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Summarize SWE.1
        </div>
      </div>

      <div class="chat-input-area">
        <div class="input-container">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          <input 
            type="text" 
            [(ngModel)]="currentInput" 
            (keyup.enter)="sendMessage()" 
            placeholder="Ask Copilot about requirements, traceability, or impact analysis..."
            [disabled]="isLoading"
          />
          <button *ngIf="!isLoading" class="send-btn" (click)="sendMessage()" [disabled]="!currentInput.trim()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
          <button *ngIf="isLoading" class="send-btn stop-btn-input" (click)="stopGeneration()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"></rect></svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./copilot.css']
})
export class CopilotComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  
  projects: any[] = [];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  get messages() { return this.api.copilotMessages; }
  set messages(val) { this.api.copilotMessages = val; }

  get currentInput() { return this.api.copilotCurrentInput; }
  set currentInput(val) { this.api.copilotCurrentInput = val; }

  get isLoading() { return this.api.copilotIsLoading; }
  set isLoading(val) { this.api.copilotIsLoading = val; }

  get thinkingSteps() { return this.api.copilotThinkingSteps; }
  set thinkingSteps(val) { this.api.copilotThinkingSteps = val; }

  get abortController() { return this.api.copilotAbortController; }
  set abortController(val) { this.api.copilotAbortController = val; }

  get selectedProjectId() { return this.api.copilotProjectId; }
  set selectedProjectId(val) { this.api.copilotProjectId = val; }

  ngOnInit() {
    this.loadProjects();
  }
  
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  loadProjects() {
    this.api.getProjects().subscribe(data => {
      this.projects = data;
      if (this.projects.length > 0) {
        this.selectedProjectId = this.projects[0].id;
      }
      this.cdr.detectChanges();
    });
  }
  
  onProjectChange() {
    // Optionally clear chat or just change context
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  sendSuggestion(text: string) {
    this.currentInput = text;
    this.sendMessage();
  }

  isAborted = false;

  stopGeneration() {
    if (this.abortController) {
      this.isAborted = true;
      this.abortController.abort();
      this.isLoading = false;
      this.messages.push({
        role: 'bot',
        content: 'Generation stopped.',
        timestamp: new Date()
      });
      this.thinkingSteps = [];
      this.cdr.detectChanges();
      setTimeout(() => this.scrollToBottom(), 50);
    }
  }

  sendMessage() {
    const text = this.currentInput.trim();
    if (!text) return;

    this.messages.push({
      role: 'user',
      content: text,
      timestamp: new Date()
    });
    this.currentInput = '';
    this.isLoading = true;
    this.isAborted = false;
    this.thinkingSteps = [];
    this.abortController = new AbortController();

    // Convert internal message history to what the API expects
    const apiHistory = this.messages.slice(0, -1).map(m => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));

    this.api.sendCopilotMessage(this.selectedProjectId, text, apiHistory, this.abortController.signal).subscribe({
      next: (res) => {
        if (res.type === 'thinking') {
          this.thinkingSteps.push(res.message);
        } else if (res.type === 'final' || res.type === 'error') {
          this.isLoading = false;
          this.messages.push({
            role: 'bot',
            content: res.text || 'Received an empty response.',
            timestamp: new Date()
          });
          this.thinkingSteps = [];
        }
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: (err) => {
        this.isLoading = false;
        console.error(err);
        this.messages.push({
          role: 'bot',
          content: this.isAborted ? 'Generation stopped.' : 'Sorry, I encountered an error communicating with the server.',
          timestamp: new Date()
        });
        this.thinkingSteps = [];
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let html = content;

    // 1. Code blocks
    const codeBlocks: string[] = [];
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
      codeBlocks.push(`<pre><code>${this.escapeHtml(code.trim())}</code></pre>`);
      return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
    });

    // 2. Inline code
    const inlineCodes: string[] = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      inlineCodes.push(`<code>${this.escapeHtml(code)}</code>`);
      return `___INLINE_CODE_${inlineCodes.length - 1}___`;
    });

    // 3. Markdown Tables
    const tableRegex = /(?:(?:\|[^\n]+\|\r?\n){2,}(?:\|[^\n]+\|\r?\n?)*)/g;
    html = html.replace(tableRegex, (tableMatch) => {
      const rows = tableMatch.trim().split('\n').map(r => r.trim()).filter(r => r);
      if (rows.length < 2) return tableMatch;

      const parseRow = (rowStr: string) => {
        return rowStr
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map(cell => cell.trim());
      };

      const headerCells = parseRow(rows[0]);
      const isDivider = /^\|?[\s:-]+(?:\|[\s:-]+)*\|?$/.test(rows[1]);
      const dataRows = isDivider ? rows.slice(2) : rows.slice(1);

      let tableHtml = '<div class="table-wrapper"><table class="copilot-table"><thead><tr>';
      headerCells.forEach(cell => {
        tableHtml += `<th>${cell}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      dataRows.forEach(rowStr => {
        const cells = parseRow(rowStr);
        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<td>${cell}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table></div>';
      return tableHtml;
    });

    // 4. Headings
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 5. Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 6. Unordered & Ordered Lists
    html = html.replace(/^\s*[\*\-] (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // 7. Line breaks for regular text sections
    const parts = html.split(/(<div class="table-wrapper">[\s\S]*?<\/div>|<pre>[\s\S]*?<\/pre>|<ul>[\s\S]*?<\/ul>|<h[1-4]>.*?<\/h[1-4]>)/g);
    html = parts.map(part => {
      if (part.startsWith('<div class="table-wrapper">') || part.startsWith('<pre>') || part.startsWith('<ul>') || part.startsWith('<h')) {
        return part;
      }
      return part.replace(/\n/g, '<br>');
    }).join('');

    // Restore inline codes and code blocks
    inlineCodes.forEach((code, idx) => {
      html = html.replace(`___INLINE_CODE_${idx}___`, code);
    });
    codeBlocks.forEach((block, idx) => {
      html = html.replace(`___CODE_BLOCK_${idx}___`, block);
    });

    return `<div class="message-content">${html}</div>`;
  }
}
