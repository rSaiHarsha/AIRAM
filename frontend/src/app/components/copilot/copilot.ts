import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  imageBase64?: string;
  imageFormat?: string;
  plantumlCode?: string;
  _showCode?: boolean;
}

interface GroupedConversations {
  group: string;
  items: any[];
}

@Component({
  selector: 'app-copilot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="copilot-layout" [class.sidebar-collapsed]="isSidebarCollapsed">
      
      <!-- Left Sidebar: History -->
      <aside class="copilot-sidebar">
        <div class="sidebar-header">
          <button class="btn-new-chat" (click)="startNewChat()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Chat
          </button>
          
          <button class="sidebar-toggle-btn" (click)="toggleSidebar()" title="Collapse sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
        </div>

        <div class="sidebar-search">
          <div class="search-input-wrapper">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search history..." 
            />
          </div>
        </div>

        <div class="sidebar-history-list">
          <div *ngIf="conversations.length === 0" class="no-history-msg">
            No previous chats.
          </div>

          <div *ngFor="let g of groupedConversations" class="history-group">
            <div class="group-label">{{ g.group }}</div>
            
            <div 
              *ngFor="let conv of g.items" 
              class="history-item"
              [class.active]="conv.id === activeConversationId"
              (click)="selectConversation(conv.id)"
            >
              <div class="history-item-content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chat-icon">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>

                <div *ngIf="editingConvId !== conv.id" class="conv-title" [title]="conv.title">
                  {{ conv.title }}
                </div>

                <input 
                  *ngIf="editingConvId === conv.id" 
                  type="text" 
                  class="edit-title-input" 
                  [(ngModel)]="editingTitle" 
                  (keyup.enter)="saveTitle(conv, $event)"
                  (keyup.escape)="cancelEditing($event)"
                  (click)="$event.stopPropagation()"
                  #editInput
                />
              </div>

              <div class="history-item-actions">
                <ng-container *ngIf="editingConvId !== conv.id">
                  <button class="action-btn" (click)="startEditing(conv, $event)" title="Rename">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button class="action-btn delete-btn" (click)="deleteConversation(conv.id, $event)" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </ng-container>
                
                <ng-container *ngIf="editingConvId === conv.id">
                  <button class="action-btn confirm-btn" (click)="saveTitle(conv, $event)" title="Save">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </button>
                  <button class="action-btn" (click)="cancelEditing($event)" title="Cancel">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </ng-container>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Chat Container -->
      <div class="copilot-container">
        <div class="copilot-header">
          <div class="header-left-group">
            <button *ngIf="isSidebarCollapsed" class="sidebar-expand-btn" (click)="toggleSidebar()" title="Open conversation history">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
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
              <div *ngIf="msg.imageBase64" class="uml-image-container">
                <img [src]="getImageSrc(msg)" alt="UML Diagram" class="uml-diagram-img" (click)="openImageFullscreen(msg.imageBase64!, msg.imageFormat)" />
              </div>
              <div *ngIf="msg.plantumlCode" class="plantuml-toggle">
                <button class="btn-plantuml-toggle" (click)="msg._showCode = !msg._showCode">{{ msg._showCode ? 'Hide' : 'Show' }} PlantUML Source</button>
                <pre *ngIf="msg._showCode" class="plantuml-source">{{ msg.plantumlCode }}</pre>
              </div>
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
        <div class="suggestions">
          <div class="suggestion-chip" (click)="sendSuggestion('List all projects')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>
            List Projects
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Summarize this project')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            Project Summary
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Summarize SWE.1 requirements')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Summarize SWE.1
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Find requirements mentioning braking')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Search Reqs
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Find Orphans')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Find Orphans
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Traceability Gap Analysis')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            Gap Analysis
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Show quality results')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Quality Results
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Summarize rules with review status as review for quality analysis')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            Failed Rules
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('List available guidelines')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            List Guidelines
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Fetch the guidelines')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            Fetch Guidelines
          </div>
          <div class="suggestion-chip" (click)="sendSuggestion('Generate a sequence diagram from SWE.1 requirements')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
            Sequence Diagram
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

    </div>
  `,
  styleUrls: ['./copilot.css']
})
export class CopilotComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  
  projects: any[] = [];
  conversations: any[] = [];
  isSidebarCollapsed = false;
  searchQuery = '';
  editingConvId: string | null = null;
  editingTitle = '';

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

  get activeConversationId() { return this.api.copilotActiveConversationId; }
  set activeConversationId(val) { this.api.copilotActiveConversationId = val; }

  get groupedConversations(): GroupedConversations[] {
    if (!this.conversations || this.conversations.length === 0) return [];

    const search = this.searchQuery.trim().toLowerCase();
    const filtered = search 
      ? this.conversations.filter(c => c.title && c.title.toLowerCase().includes(search))
      : this.conversations;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysStart = todayStart - 86400000 * 7;

    const todayItems: any[] = [];
    const yesterdayItems: any[] = [];
    const past7DaysItems: any[] = [];
    const olderItems: any[] = [];

    filtered.forEach(c => {
      const timeStr = c.updated_at || c.created_at;
      const itemDate = timeStr ? new Date(timeStr).getTime() : 0;

      if (itemDate >= todayStart) {
        todayItems.push(c);
      } else if (itemDate >= yesterdayStart) {
        yesterdayItems.push(c);
      } else if (itemDate >= sevenDaysStart) {
        past7DaysItems.push(c);
      } else {
        olderItems.push(c);
      }
    });

    const groups: GroupedConversations[] = [];
    if (todayItems.length) groups.push({ group: 'Today', items: todayItems });
    if (yesterdayItems.length) groups.push({ group: 'Yesterday', items: yesterdayItems });
    if (past7DaysItems.length) groups.push({ group: 'Previous 7 Days', items: past7DaysItems });
    if (olderItems.length) groups.push({ group: 'Older', items: olderItems });

    return groups;
  }

  ngOnInit() {
    this.loadProjects();
    this.loadConversations();
  }
  
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  loadProjects() {
    this.api.getProjects().subscribe(data => {
      this.projects = data;
      if (this.projects.length > 0 && !this.selectedProjectId) {
        this.selectedProjectId = this.projects[0].id;
      }
      this.cdr.detectChanges();
    });
  }

  loadConversations() {
    this.api.getCopilotConversations().subscribe({
      next: (data) => {
        this.conversations = data || [];
        if (this.conversations.length > 0 && !this.activeConversationId) {
          this.selectConversation(this.conversations[0].id);
        } else if (this.activeConversationId) {
          const exists = this.conversations.some(c => c.id === this.activeConversationId);
          if (!exists && this.conversations.length > 0) {
            this.selectConversation(this.conversations[0].id);
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load conversations', err)
    });
  }

  selectConversation(convId: string) {
    if (this.editingConvId) {
      this.cancelEditing();
    }
    this.activeConversationId = convId;
    this.messages = [];
    this.isLoading = true;
    this.api.getCopilotConversationMessages(convId).subscribe({
      next: (res) => {
        this.isLoading = false;
        const rawMsgs = res.messages || [];
        this.messages = rawMsgs.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at ? new Date(m.created_at) : new Date(),
          imageBase64: m.image_base64 || undefined,
          imageFormat: m.image_format || 'png',
          plantumlCode: m.plantuml_code || undefined
        }));
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to load conversation messages', err);
        this.cdr.detectChanges();
      }
    });
  }

  startNewChat() {
    if (this.isLoading) return;
    this.api.createCopilotConversation('New Chat', this.selectedProjectId).subscribe({
      next: (conv) => {
        this.conversations.unshift(conv);
        this.activeConversationId = conv.id;
        this.messages = [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to create new conversation', err)
    });
  }

  startEditing(conv: any, event: Event) {
    event.stopPropagation();
    this.editingConvId = conv.id;
    this.editingTitle = conv.title;
  }

  saveTitle(conv: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.editingTitle.trim()) return;
    const newTitle = this.editingTitle.trim();
    this.api.updateCopilotConversationTitle(conv.id, newTitle).subscribe({
      next: () => {
        conv.title = newTitle;
        this.editingConvId = null;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to update title', err)
    });
  }

  cancelEditing(event?: Event) {
    if (event) event.stopPropagation();
    this.editingConvId = null;
    this.editingTitle = '';
  }

  deleteConversation(convId: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat history?')) return;

    this.api.deleteCopilotConversation(convId).subscribe({
      next: () => {
        this.conversations = this.conversations.filter(c => c.id !== convId);
        if (this.activeConversationId === convId) {
          if (this.conversations.length > 0) {
            this.selectConversation(this.conversations[0].id);
          } else {
            this.activeConversationId = null;
            this.messages = [];
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to delete conversation', err)
    });
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
  
  onProjectChange() {
    // Optionally context update
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

    if (!this.activeConversationId) {
      const tempTitle = text.slice(0, 45) + (text.length > 45 ? '...' : '');
      this.api.createCopilotConversation(tempTitle, this.selectedProjectId).subscribe({
        next: (conv) => {
          this.conversations.unshift(conv);
          this.activeConversationId = conv.id;
          this.executeSendMessage(text);
        },
        error: () => {
          this.executeSendMessage(text);
        }
      });
    } else {
      this.executeSendMessage(text);
    }
  }

  private executeSendMessage(text: string) {
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

    const apiHistory = this.messages.slice(0, -1).map(m => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));

    this.api.sendCopilotMessage(
      this.selectedProjectId, 
      text, 
      apiHistory, 
      this.abortController.signal,
      this.activeConversationId
    ).subscribe({
      next: (res) => {
        if (res.type === 'thinking') {
          this.thinkingSteps.push(res.message);
        } else if (res.type === 'image') {
          this.isLoading = false;
          this.messages.push({
            role: 'bot',
            content: res.text || 'Here is the generated UML diagram:',
            timestamp: new Date(),
            imageBase64: res.image_base64 || undefined,
            imageFormat: res.image_format || 'png',
            plantumlCode: res.plantuml_code || undefined
          });
          this.thinkingSteps = [];
          this.loadConversations();
        } else if (res.type === 'final' || res.type === 'error') {
          this.isLoading = false;
          this.messages.push({
            role: 'bot',
            content: res.text || 'Received an empty response.',
            timestamp: new Date()
          });
          this.thinkingSteps = [];
          this.loadConversations();
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

  getImageSrc(msg: Message): string {
    if (!msg.imageBase64) return '';
    const mime = msg.imageFormat === 'svg' ? 'image/svg+xml' : 'image/png';
    return `data:${mime};base64,${msg.imageBase64}`;
  }

  openImageFullscreen(base64: string, format?: string) {
    const mime = format === 'svg' ? 'image/svg+xml' : 'image/png';
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head><title>UML Diagram</title></head>
          <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a2e;">
            <img src="data:${mime};base64,${base64}" style="max-width: 95vw; max-height: 95vh; object-fit: contain; border-radius: 8px;" />
          </body>
        </html>
      `);
      win.document.close();
    }
  }
}
