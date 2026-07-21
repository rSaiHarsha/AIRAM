import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-rag-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rag-container">
      <div style="margin-bottom: 24px;">
        <h2 class="section-title" style="margin-bottom: 4px;">Knowledge Engine Configuration</h2>
        <p class="section-desc">Ingest standards and evaluate semantic search retrieval.</p>
      </div>

      <!-- Top Section: Manual Retrieval Evaluation -->
      <div class="card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
          <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0;">
            Manual Retrieval Evaluation
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">Target Collection:</span>
            <select [(ngModel)]="searchCollection" (change)="onSearchCollectionChanged()" style="font-size: 0.8rem; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; cursor: pointer;">
              <option *ngFor="let col of collections" [value]="col">{{ col }}</option>
            </select>
          </div>
        </div>
        <p class="section-desc" style="margin-bottom: 16px;">Search guidelines to check semantic relevance and retrieval accuracy.</p>
        
        <div class="search-box" style="display: flex; gap: 12px; margin-bottom: 16px;">
          <input type="text" [(ngModel)]="searchQuery" placeholder="Enter keyword or requirement sentence to test vector search..." (keyup.enter)="evaluateSearch()" style="flex: 1; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem;" [disabled]="isSearching">
          <button class="btn btn-primary" (click)="evaluateSearch()" [disabled]="!searchQuery || isSearching" style="padding: 0 24px; display: inline-flex; align-items: center; gap: 8px;">
            <span *ngIf="isSearching" class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0; border-top-color: white;"></span>
            <span>{{ isSearching ? 'Searching...' : 'Search' }}</span>
          </button>
        </div>
        
        <div *ngIf="isSearching" style="text-align: center; padding: 24px; color: var(--text-secondary); font-size: 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border-color);">
          <div class="spinner" style="width: 22px; height: 22px; border-width: 2px; margin-bottom: 8px;"></div>
          <div>Searching vector database for matching guideline chunks...</div>
        </div>

        <div *ngIf="!isSearching && searchResults.length > 0" class="search-results" style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 4px;">
          <div *ngFor="let result of searchResults" class="result-card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; background: #fafafa;">
            <div class="result-text" style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 8px; line-height: 1.5;">"{{ result.text }}"</div>
            <div class="result-footer" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
              <span class="result-doc" style="display: flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                {{ result.doc_name }}
              </span>
              <span class="result-score">Score: <strong style="color: var(--color-primary);">{{ result.score | number:'1.3-3' }}</strong></span>
            </div>
          </div>
        </div>
        <div *ngIf="!isSearching && searched && searchResults.length === 0" class="no-results" style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 0.85rem; background: #f8fafc; border-radius: 6px; border: 1px dashed var(--border-color);">
          No matching guideline chunks found. Ensure you have trained guidelines!
        </div>
      </div>

      <!-- Bottom Grid: Metrics & Logs -->
      <div class="grid grid-2" style="align-items: start; gap: 24px;">
        
        <!-- Left Column: Chunking Metrics with Ingestion Action -->
        <div class="card" style="margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0;">
              Chunking Metrics
            </div>
            <button class="btn btn-primary" (click)="fileInput.click()" [disabled]="isTraining" style="display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.85rem; padding: 6px 14px; border-radius: 20px; background: var(--color-primary); color: white; border: none; cursor: pointer;">
              <span style="font-size: 1.1rem; line-height: 1; font-weight: 700;">+</span> Ingest Document
            </button>
            <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none;" accept=".json,.pdf,.txt">
          </div>

          <!-- Progressive Training Bar inside Metrics card -->
          <div *ngIf="isTraining || logs.length > 0" class="progress-section" style="margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border-color);">
            <div class="progress-meta" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 6px;">
              <span>Ingestion Progress {{ selectedFile ? '(' + selectedFile.name + ')' : '' }}</span>
              <span>{{ progressPercent }}% ({{ processedChunks }}/{{ totalChunks }} chunks)</span>
            </div>
            <div class="progress-bar-bg" style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
              <div class="progress-bar" [style.width.%]="progressPercent" style="height: 100%; background: var(--color-primary); transition: width 0.2s ease;"></div>
            </div>
          </div>
          
          <div style="display: flex; gap: 16px;">
            <div style="flex: 1; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; background: var(--bg-card);">
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Collections</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: var(--color-primary);">{{ metrics.total_collections || 0 }}</div>
            </div>
            
            <div style="flex: 1; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; background: var(--bg-card);">
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Total Chunks</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: var(--text-primary);">{{ metrics.total_chunks }}</div>
            </div>
            
            <div style="flex: 1; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; background: var(--bg-card);">
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Total Tokens</div>
              <div style="font-size: 1.8rem; font-weight: 700; color: var(--text-primary);">{{ metrics.total_tokens | number }}</div>
            </div>
          </div>

          <!-- Scrollable Per-collection chunk breakdown -->
          <div *ngIf="metrics.collections && metrics.collections.length > 0" style="margin-top: 20px;">
            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.3px;">
              Collection Chunks Breakdown
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto; padding-right: 4px;">
                <div *ngFor="let col of metrics.collections" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 6px; background: #f8fafc; font-size: 0.8rem;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    <span style="font-weight: 600; color: var(--text-primary);">{{ col.name }}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="badge" style="font-size: 0.7rem; background: #e0f2fe; color: #0369a1; font-weight: 700; padding: 2px 8px; border-radius: 12px;">{{ col.chunks }} chunks</span>
                    <button class="icon-btn-minimal" (click)="deleteCollection(col.name, $event)" title="Delete Collection" style="padding: 2px 6px; color: #ef4444; border: none; background: none; cursor: pointer;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
            </div>
          </div>
          <div *ngIf="!metrics.collections || metrics.collections.length === 0" style="margin-top: 16px; font-size: 0.8rem; color: var(--text-secondary); font-style: italic;">
            No collections found. Click + Ingest Document to get started.
          </div>
        </div>

        <!-- Right Column: Training Progress Log -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 12px;">
            Training Progress Log
          </div>
          <div class="log-container">
            <div class="log-window" style="min-height: 280px;">
              <div *ngFor="let log of logs" class="log-entry">
                <span class="log-time">[{{ log.time | date:'HH:mm:ss' }}]</span>
                <span class="log-msg">{{ log.message }}</span>
              </div>
              <div *ngIf="logs.length === 0" style="color: #64748b; font-style: italic;">Awaiting ingestion task...</div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Configure Collection & Extraction Parameters Modal Dialog -->
    <div class="modal-backdrop" *ngIf="showConfigDialog">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Configure Ingestion Parameters</h3>
          <button class="modal-close" (click)="closeDialog()">&times;</button>
        </div>
        
        <div class="modal-body">
          <p>📂 <strong>File Uploaded:</strong> <code>{{ selectedFile?.name }}</code></p>
          
          <!-- 1. Target Collection Section -->
          <h4 style="margin-top: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">🗃️ 1. Target Collection</h4>
          <div class="radio-group" style="margin-bottom: 12px; display: flex; gap: 16px; margin-top: 6px;">
            <label class="radio-lbl">
              <input type="radio" name="col_mode" value="add" [(ngModel)]="collectionMode"> Add to Existing
            </label>
            <label class="radio-lbl">
              <input type="radio" name="col_mode" value="create" [(ngModel)]="collectionMode"> Create New
            </label>
          </div>
          
          <div class="form-group" *ngIf="collectionMode === 'add'">
            <label class="form-label">Select Target Collection:</label>
            <select [(ngModel)]="selectedCollection" style="width: 100%;">
              <option *ngFor="let col of collections" [value]="col">{{ col }}</option>
              <option *ngIf="collections.length === 0" value="airam_guidelines">airam_guidelines (Default)</option>
            </select>
          </div>
          
          <div class="form-group" *ngIf="collectionMode === 'create'">
            <label class="form-label">Enter New Collection Name:</label>
            <input type="text" [(ngModel)]="newCollectionName" placeholder="e.g. autosar_manuals" style="width: 100%;">
          </div>
          
          <!-- 2. Extraction Parameters Section -->
          <div *ngIf="isPdf" style="margin-top: 16px;">
            <h4 style="border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">⚙️ 2. PDF Extraction Parameters</h4>
            <p class="section-desc" *ngIf="totalPages > 0">Loaded document contains {{ totalPages }} pages.</p>
            <div class="grid grid-2" style="margin-top: 8px; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Start Page:</label>
                <input type="number" [(ngModel)]="startPage" min="1" [max]="totalPages" style="width: 100%;">
              </div>
              <div class="form-group">
                <label class="form-label">End Page:</label>
                <input type="number" [(ngModel)]="endPage" min="1" [max]="totalPages" style="width: 100%;">
              </div>
            </div>
            <div *ngIf="startPage > endPage" class="alert alert-danger" style="font-size: 0.8rem; color: var(--color-danger); padding: 8px; background: #fce8e6; border-radius: 4px; margin-top: 8px;">
              Start Page cannot be greater than End Page.
            </div>
          </div>
          
          <div *ngIf="!isPdf" style="margin-top: 16px;">
            <h4 style="border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">⚙️ 2. File Parameters</h4>
            <p class="section-desc" *ngIf="selectedFile?.name?.endsWith('.xlsx') || selectedFile?.name?.endsWith('.xls')">Excel binary row parsing will be used.</p>
            <p class="section-desc" *ngIf="!selectedFile?.name?.endsWith('.xlsx') && !selectedFile?.name?.endsWith('.xls')">Direct text content parsing will be used.</p>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeDialog()">Cancel</button>
          <button class="btn btn-primary" [disabled]="!isConfigValid()" (click)="confirmConfig()">🧱 Confirm & Ingest</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .icon-btn-minimal {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
      padding: 4px;
      border-radius: 4px;
    }
    .icon-btn-minimal:hover {
      color: var(--text-primary);
      background-color: #f1f5f9;
    }
    .file-details {
      margin-top: 20px;
    }
    .progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .progress-bar-bg {
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: var(--color-primary);
      transition: width 0.2s ease-in-out;
    }
    .log-container {
      border: 1px solid #334155;
      border-radius: 8px;
      background: #0f172a;
      color: #f8fafc;
      padding: 16px;
    }
    .log-window {
      height: 200px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .log-entry {
      display: flex;
      gap: 12px;
      line-height: 1.4;
    }
    .log-time {
      color: #64748b;
      flex-shrink: 0;
    }
    .log-msg {
      color: #10b981;
      word-break: break-word;
    }
    
    .search-box {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    .search-box input {
      flex-grow: 1;
    }
    .search-results {
      max-height: 350px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-right: 4px;
    }
    .result-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      background-color: var(--bg-card);
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .result-text {
      font-size: 0.85rem;
      color: var(--text-primary);
      font-style: italic;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .result-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      border-top: 1px solid var(--border-color);
      padding-top: 12px;
    }
    .result-doc {
      color: var(--text-secondary);
      font-weight: 500;
    }
    .result-score {
      color: var(--color-primary);
      background: #eff6ff;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
    }
    .no-results {
      font-size: 0.85rem;
      color: var(--text-secondary);
      text-align: center;
      padding: 24px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px dashed var(--border-color);
    }

    /* Modal dialog styling overlay */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    }
    
    .modal-card {
      background: var(--bg-card);
      border-radius: 12px;
      width: 90%;
      max-width: 550px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-header h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    
    .modal-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-secondary);
      line-height: 1;
      padding: 0;
    }
    
    .modal-close:hover {
      color: var(--text-primary);
    }
    
    .modal-body {
      padding: 24px;
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .modal-body h4 {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-top: 20px;
      margin-bottom: 12px;
    }
    
    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: #f8fafc;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }
    
    .radio-lbl {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      color: var(--text-primary);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class RAGConfigComponent implements OnInit {
  selectedFile: File | null = null;
  isTraining: boolean = false;
  progressPercent: number = 0;
  totalChunks: number = 0;
  processedChunks: number = 0;
  logs: Array<{ time: Date; message: string }> = [];
  
  metrics: any = {
    total_chunks: 0,
    total_tokens: 0,
    avg_tokens: 0,
    total_collections: 0,
    collections: []
  };

  searchQuery: string = '';
  searchResults: any[] = [];
  searched: boolean = false;
  isSearching: boolean = false;

  // Dialog parameters
  showConfigDialog = false;
  collections: string[] = [];
  collectionMode: 'add' | 'create' = 'add';
  selectedCollection: string = 'airam_guidelines';
  newCollectionName: string = '';
  isPdf = false;
  startPage = 1;
  endPage = 1;
  totalPages = 0;
  searchCollection = 'airam_guidelines';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadMetrics();
    this.loadCollections();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.isPdf = file.name.toLowerCase().endsWith('.pdf');
      
      this.loadCollections();

      if (this.isPdf) {
        this.apiService.inspectPdf(file).subscribe({
          next: (res) => {
            this.totalPages = res.pages;
            this.startPage = 1;
            this.endPage = res.pages;
            this.showConfigDialog = true;
          },
          error: (err) => {
            alert('Failed to inspect PDF: ' + (err.error?.detail || err.message));
          }
        });
      } else {
        this.showConfigDialog = true;
      }
    }
  }

  loadMetrics() {
    this.apiService.getRagMetrics().subscribe({
      next: (res) => {
        this.metrics = res;
        this.cdr.detectChanges();
      },
      error: () => this.cdr.detectChanges()
    });
  }

  loadCollections() {
    this.apiService.getRagCollections().subscribe({
      next: (cols) => {
        this.collections = cols;
        if (cols.includes('airam_guidelines')) {
          this.selectedCollection = 'airam_guidelines';
          this.searchCollection = 'airam_guidelines';
        } else if (cols.includes('requalitrace_guidelines')) {
          this.selectedCollection = 'requalitrace_guidelines';
          this.searchCollection = 'requalitrace_guidelines';
        } else if (cols.length > 0) {
          this.selectedCollection = cols[0];
          this.searchCollection = cols[0];
        } else {
          this.selectedCollection = 'airam_guidelines';
          this.searchCollection = 'airam_guidelines';
        }
        this.cdr.detectChanges();
      },
      error: () => this.cdr.detectChanges()
    });
  }

  deleteCollection(colName: string, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete the vector collection '${colName}'? All vector chunks stored inside it will be permanently deleted.`)) {
      this.apiService.deleteRagCollection(colName).subscribe({
        next: () => {
          this.loadMetrics();
          this.loadCollections();
          this.cdr.detectChanges();
        },
        error: (err) => {
          alert('Failed to delete collection: ' + (err.error?.detail || err.message));
          this.cdr.detectChanges();
        }
      });
    }
  }

  closeDialog() {
    this.showConfigDialog = false;
    this.selectedFile = null;
  }

  confirmConfig() {
    this.showConfigDialog = false;
    this.startIngestion();
  }

  isConfigValid(): boolean {
    if (this.collectionMode === 'create' && !this.newCollectionName.trim()) {
      return false;
    }
    if (this.isPdf) {
      if (this.startPage < 1 || this.endPage < 1 || this.startPage > this.totalPages || this.endPage > this.totalPages || this.startPage > this.endPage) {
        return false;
      }
    }
    return true;
  }

  startIngestion() {
    if (!this.selectedFile) return;
    this.isTraining = true;
    this.progressPercent = 0;
    this.processedChunks = 0;
    this.logs = [];
    
    const targetCol = this.collectionMode === 'create' ? this.newCollectionName.trim() : this.selectedCollection;
    
    this.addLog(`Starting document ingestion: ${this.selectedFile.name}...`);
    this.addLog(`Target Collection: ${targetCol} (Mode: ${this.collectionMode === 'create' ? 'Create' : 'Add'})`);
    if (this.isPdf) {
      this.addLog(`Slicing pages: ${this.startPage} to ${this.endPage}`);
    }
    
    this.apiService.trainRAG(
      this.selectedFile,
      targetCol,
      this.collectionMode === 'create' ? 'create' : 'add',
      this.isPdf ? this.startPage : undefined,
      this.isPdf ? this.endPage : undefined
    ).subscribe({
      next: (event) => {
        if (event.status === 'started') {
          this.totalChunks = event.total_chunks;
          this.addLog(`File parsed. Segmented into ${this.totalChunks} chunks.`);
        } else if (event.status === 'processing') {
          this.processedChunks = event.processed;
          this.progressPercent = Math.round((this.processedChunks / this.totalChunks) * 100);
          this.addLog(`Chunk ${this.processedChunks}/${this.totalChunks} saved progressively to Qdrant & SQLite database.`);
        } else if (event.status === 'completed') {
          this.isTraining = false;
          this.progressPercent = 100;
          this.addLog(`Training completed successfully! Progressive commits completed.`);
          this.loadMetrics(); // Refresh full metrics including Qdrant collection data
          this.loadCollections(); // Refresh collections list
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isTraining = false;
        this.addLog(`Error during training: ${err.message || err}`);
        this.cdr.detectChanges();
      }
    });
  }

  addLog(message: string) {
    this.logs.push({ time: new Date(), message });
    // Scroll window
    setTimeout(() => {
      const window = document.querySelector('.log-window');
      if (window) {
        window.scrollTop = window.scrollHeight;
      }
    }, 50);
  }

  onSearchCollectionChanged() {
    this.searchResults = [];
    this.searched = false;
  }

  evaluateSearch() {
    if (!this.searchQuery || this.isSearching) return;
    this.searched = true;
    this.isSearching = true;
    this.searchResults = [];
    this.cdr.detectChanges();

    this.apiService.searchRag(this.searchQuery, 5, this.searchCollection).subscribe({
      next: (res) => {
        this.searchResults = res;
        this.isSearching = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Vector search failed", err);
        this.isSearching = false;
        this.cdr.detectChanges();
      }
    });
  }
}
