import { Component, OnInit, EventEmitter, Output, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="grid grid-3" style="margin-bottom: 40px;">
        <!-- Metric Card 1: Pass Rate -->
        <div class="card metric-card" style="margin-bottom: 0;">
          <div class="metric-header">
            <span class="metric-title">REQUIREMENTS PASS RATE</span>
            <span class="metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </span>
          </div>
          <div class="metric-value">{{ overallPassRate }}% <span style="font-size: 1rem; font-weight: 500; color: var(--text-secondary);">avg</span></div>
          <div class="metric-footer">Calculated from all history</div>
        </div>

        <!-- Metric Card 2: Total Runs -->
        <div class="card metric-card" style="margin-bottom: 0;">
          <div class="metric-header">
            <span class="metric-title">TOTAL EXECUTIONS</span>
            <span class="metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.27l5.25 4.7"></path>
              </svg>
            </span>
          </div>
          <div class="metric-value">{{ history.length }}</div>
          <div class="metric-footer">Total stored runs</div>
        </div>

        <!-- Metric Card 3: RAG Guidelines Chunk count -->
        <div class="card metric-card" style="margin-bottom: 0;">
          <div class="metric-header">
            <span class="metric-title">ACTIVE RAG CHUNKS</span>
            <span class="metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
            </span>
          </div>
          <div class="metric-value">{{ ragMetrics.total_chunks || 0 | number }}</div>
          <div class="metric-footer">Qdrant vector chunks</div>
        </div>
      </div>

      <div class="runs-history-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin: 0;">Execution Runs History</h2>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Filter
          </button>
          <button class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            New Execution
          </button>
        </div>
      </div>
      
      <div *ngIf="isLoadingHistory" class="loading-state" style="padding: 32px; text-align: center; color: var(--text-secondary);">
        <div class="spinner"></div>
        <div style="font-size: 0.9rem; font-weight: 500;">Loading data please wait...</div>
      </div>

      <div *ngIf="!isLoadingHistory && history.length === 0" class="no-runs" style="color: var(--text-secondary); font-size: 0.85rem; padding: 12px 0;">
        No previous analysis execution runs found. Go to the <strong>Requirement Analysis</strong> tab to upload and evaluate requirements!
      </div>

      <div *ngIf="!isLoadingHistory && history.length > 0" class="minimized-shelf">
        <div *ngFor="let run of history" class="history-card" [class.minimized]="run.minimized === 1">
          <div class="history-header">
            <div class="history-meta" style="display: flex; gap: 16px; align-items: center;">
              <span class="badge badge-blue-pill" style="font-size: 0.65rem;">{{ run.type }} RUN</span>
              <div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">{{ run.type === 'quality' ? 'Requirement Validation Suite' : 'Traceability Mapping Audit' }}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">{{ run.timestamp | date:'medium' }}</div>
              </div>
            </div>
            <div class="history-actions" style="display: flex; align-items: center; gap: 16px;">
              <span class="badge" [class.badge-pass]="run.status === 'completed'" [class.badge-fail]="run.status === 'stopped'" [class.badge-running]="run.status === 'running' || run.status === 'paused'" style="margin-right: 8px;">
                {{ run.status }}
              </span>
              
              <button class="icon-btn-minimal" (click)="toggleMinimize(run.run_id, run.minimized === 1)">
                <svg *ngIf="run.minimized === 1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                <svg *ngIf="run.minimized !== 1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              
              <button class="btn btn-primary" style="padding: 6px 16px; font-size: 0.8rem; border-radius: 4px;" (click)="viewRun.emit(run.run_id)" >
                Load Result
              </button>
              
              <button class="icon-btn-minimal text-danger" (click)="deleteRun(run.run_id)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
          
          <!-- Expanded content -->
          <div class="history-body" *ngIf="run.minimized !== 1">
            <div style="display: flex; gap: 24px;">
              
              <!-- Left Column: Summary Metrics -->
              <div class="summary-col" style="flex: 0 0 320px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">Summary Metrics</span>
                  <button *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0" (click)="exportRun(run.run_id)" style="background: none; border: none; color: var(--color-primary); font-size: 0.8rem; font-weight: 500; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export CSV
                  </button>
                </div>
                
                <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                  <div style="flex: 1; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Pass</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: var(--color-success);">{{ run.pass_count }}</div>
                  </div>
                  <div style="flex: 1; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Review</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #d97706;">{{ run.review_count + run.fail_count }}</div>
                  </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Overall Progress</span>
                  <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary);">{{ getPercentage(run.pass_count, run.total_count) | number:'1.0-0' }}% Success</span>
                </div>
                <div class="run-bar" style="display: flex; height: 10px; border-radius: 5px; overflow: hidden; background-color: #e2e8f0; width: 100%;">
                  <div class="bar-segment bar-pass" [style.width.%]="getPercentage(run.pass_count, run.total_count)" title="Pass"></div>
                  <div class="bar-segment bar-review" [style.width.%]="getPercentage(run.review_count + run.fail_count, run.total_count)" title="Review" style="background-color: #d97706;"></div>
                </div>
              </div>

              <!-- Right Column: Mini table -->
              <div class="table-col" style="flex: 1; min-width: 0;" *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0">
                <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; background: #fff;">
                    <thead>
                      <tr style="background-color: #f8fafc;">
                        <th style="padding: 12px 16px; width: 80px;">ID</th>
                        <th style="padding: 12px 16px;">Requirement</th>
                        <th style="padding: 12px 16px; width: 100px;">Status</th>
                        <th style="padding: 12px 16px;">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of expandedResults[run.run_id] | slice:(getCurrentPage(run.run_id) - 1) * 3:getCurrentPage(run.run_id) * 3" style="border-top: 1px solid var(--border-color);">
                        <td style="padding: 16px; font-weight: 600; color: var(--color-primary); white-space: nowrap; vertical-align: top;">{{ row.req_id }}</td>
                        <td style="padding: 16px; color: var(--text-primary); vertical-align: top;">{{ row.input_req }}</td>
                        <td style="padding: 16px; vertical-align: top; font-weight: 700;" [ngStyle]="{'color': row.status === 'PASS' ? 'var(--color-success)' : (row.status === 'FAIL' || row.status === 'REVIEW' ? '#d97706' : 'var(--text-primary)')}">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </td>
                        <td style="padding: 16px; color: var(--text-secondary); vertical-align: top;">
                          {{ row.rationale || 'N/A' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Pagination Footer -->
                  <div class="pagination-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid var(--border-color); background: #f8fafc; font-size: 0.75rem; color: var(--text-secondary);">
                    <div>
                      Showing {{ (getCurrentPage(run.run_id) - 1) * 3 + 1 }}-{{ getMin((getCurrentPage(run.run_id) * 3), expandedResults[run.run_id].length) }} of {{ expandedResults[run.run_id].length }} items
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button class="icon-btn-minimal" [disabled]="getCurrentPage(run.run_id) === 1" (click)="setPage(run.run_id, getCurrentPage(run.run_id) - 1)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      <button class="icon-btn-minimal" [disabled]="getCurrentPage(run.run_id) === getTotalPages(run.run_id)" (click)="setPage(run.run_id, getCurrentPage(run.run_id) + 1)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .metric-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-left: 4px solid var(--color-primary);
    }
    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-secondary);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 16px 0;
      line-height: 1;
    }
    .metric-footer {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
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
    .icon-btn-minimal:hover:not(:disabled) {
      color: var(--text-primary);
      background-color: #f1f5f9;
    }
    .icon-btn-minimal:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .text-danger:hover:not(:disabled) {
      background-color: #fee2e2;
    }
    .no-runs {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }
    .minimized-shelf {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .history-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      background-color: var(--bg-card);
      transition: var(--transition);
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .history-card.minimized {
      padding: 16px 20px;
    }
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .history-body {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .spinner {
      display: inline-block;
      width: 28px;
      height: 28px;
      border: 3px solid rgba(0, 82, 204, 0.2);
      border-radius: 50%;
      border-top-color: var(--color-primary);
      animation: spin 1s linear infinite;
      margin-bottom: 12px;
    }
  `]
})
export class DashboardComponent implements OnInit {
  @Output() viewRun = new EventEmitter<string>();
  
  @Input() set active(val: boolean) {
    if (val) {
      this.loadData();
    } else {
      this.expandedResults = {};
    }
  }

  history: any[] = [];
  ragMetrics: any = {};
  overallPassRate: number = 0;
  expandedResults: { [runId: string]: any[] } = {};
  currentPage: { [runId: string]: number } = {};
  isLoadingHistory: boolean = true;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.isLoadingHistory = true;
    this.apiService.getHistory().subscribe({
      next: (res) => {
        this.history = res;
        this.isLoadingHistory = false;
        this.calculatePassRate();
        
        // Pre-fetch results for any already expanded cards
        this.history.forEach(run => {
          if (run.minimized !== 1) {
            this.apiService.getRunResults(run.run_id).subscribe(details => {
              this.expandedResults[run.run_id] = details;
              this.cdr.detectChanges();
            });
          }
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });

    this.apiService.getRagMetrics().subscribe({
      next: (res) => {
        this.ragMetrics = res;
      }
    });
  }

  calculatePassRate() {
    let total = 0;
    let passes = 0;
    this.history.forEach(run => {
      total += run.total_count;
      passes += run.pass_count;
    });
    this.overallPassRate = total > 0 ? Math.round((passes / total) * 100) : 0;
  }

  getPercentage(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }

  toggleMinimize(runId: string, currentlyMinimized: boolean) {
    this.apiService.minimizeRun(runId, !currentlyMinimized).subscribe(() => {
      this.loadData();
      if (currentlyMinimized) { // was minimized, now expanding
        this.apiService.getRunResults(runId).subscribe(res => {
          this.expandedResults[runId] = res;
          this.currentPage[runId] = 1;
        });
      }
    });
  }

  deleteRun(runId: string) {
    if (confirm('Are you sure you want to permanently delete this execution run history?')) {
      this.apiService.deleteRun(runId).subscribe(() => {
        this.loadData();
      });
    }
  }

  getCurrentPage(runId: string): number {
    return this.currentPage[runId] || 1;
  }

  getTotalPages(runId: string): number {
    const total = this.expandedResults[runId]?.length || 0;
    return Math.ceil(total / 3) || 1;
  }

  setPage(runId: string, page: number) {
    const totalPages = this.getTotalPages(runId);
    if (page >= 1 && page <= totalPages) {
      this.currentPage[runId] = page;
    }
  }

  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  hasCorrections(rows: any[]): boolean {
    if (!rows || rows.length === 0) return false;
    return rows.some(row => row.corrected_req && row.corrected_req !== '-' && row.corrected_req.trim() !== '');
  }

  exportRun(runId: string) {
    const results = this.expandedResults[runId];
    if (!results || results.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Input Requirement,Status,Rule/Trace Target,Rationale,Corrected Requirement\n";
    results.forEach(row => {
      const line = [
        row.req_id || '',
        `"${(row.input_req || '').replace(/"/g, '""')}"`,
        row.status || '',
        row.failed_rule || 'N/A',
        `"${(row.rationale || '').replace(/"/g, '""')}"`,
        `"${(row.corrected_req || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += line + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AIRAM_Run_${runId.substring(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
