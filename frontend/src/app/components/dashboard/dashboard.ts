import { Component, OnInit, EventEmitter, Output, Input, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <div class="grid grid-4" style="margin-bottom: 40px;">
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
          <div class="metric-footer">{{ (hasMoreHistory || isLoadingMoreHistory) ? 'Calculating (still loading)...' : 'Calculated from all history' }}</div>
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
          <div class="metric-value">{{ totalHistoryCount }}</div>
          <div class="metric-footer">{{ (hasMoreHistory || isLoadingMoreHistory) ? 'Loading full history...' : 'Total stored runs' }}</div>
        </div>

        <!-- Metric Card 3: Total Projects -->
        <div class="card metric-card" style="margin-bottom: 0;">
          <div class="metric-header">
            <span class="metric-title">TOTAL PROJECTS</span>
            <span class="metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>
          </div>
          <div class="metric-value">{{ totalProjectsCount }}</div>
          <div class="metric-footer">Workspace projects</div>
        </div>

        <!-- Metric Card 4: RAG Guidelines Chunk count -->
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
        <div style="display: flex; gap: 12px; align-items: center; position: relative;">

          <!-- History now loads all batches automatically in the background; this is just a passive indicator, not a button -->
          <div *ngIf="isLoadingMoreHistory" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-secondary);">
            <span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span>
            Loading more runs...
          </div>

          <!-- Prev / Next quick-page control, shown next to the heading -->
          <div *ngIf="!isLoadingHistory && filteredHistory.length > historyPageSize" style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-secondary);">
            <button class="btn btn-secondary btn-sm" [disabled]="historyPage === 1" (click)="prevHistoryPage()" style="padding: 4px 10px;" title="Previous page">
              ‹ Prev
            </button>
            <span style="font-weight: 500; color: var(--text-primary);">{{ historyPage }} / {{ getHistoryTotalPages() }}</span>
            <button class="btn btn-secondary btn-sm" [disabled]="historyPage === getHistoryTotalPages() && !hasMoreHistory" (click)="nextHistoryPage()" style="padding: 4px 10px;" title="Next page">
              Next ›
            </button>
          </div>

          <!-- Filter Button & Dropdown Container -->
          <div style="position: relative;" #filterContainer>
            <button class="btn btn-secondary" (click)="toggleFilterPanel($event)" [class.active]="showFilterPanel" style="position: relative; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter
              <span *ngIf="activeFilterCount > 0" class="filter-count-badge">{{ activeFilterCount }}</span>
              <span *ngIf="activeFilterCount > 0" (click)="clearFilters($event)" title="Clear all filters" style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #ef4444; color: #fff; font-size: 11px; font-weight: bold; margin-left: 2px; cursor: pointer; line-height: 1;">
                ✕
              </span>
            </button>
            
            <!-- Filter Dropdown -->
            <div *ngIf="showFilterPanel" class="filter-dropdown" style="position: absolute; top: calc(100% + 8px); right: 0; background: white; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; width: 280px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; display: flex; flex-direction: column; gap: 12px;">
              <!-- 1. Search Project (TOP Option) -->
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Search Project</label>
                <div style="position: relative; margin-bottom: 6px;">
                  <input type="text" [(ngModel)]="projectSearchTerm" placeholder="🔍 Search projects..." style="width: 100%; padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.8rem; background-color: #fff;" />
                </div>
                <select [(ngModel)]="filterProject" (ngModelChange)="onFilterChange()" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; background-color: #f8fafc;">
                  <option value="all">All Projects</option>
                  <option *ngFor="let p of filteredProjects" [value]="p.name">{{ p.name }}</option>
                </select>
              </div>
              <!-- 2. Status -->
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Status</label>
                <select [(ngModel)]="filterStatus" (ngModelChange)="onFilterChange()" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; background-color: #f8fafc;">
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="running">Running / Paused</option>
                  <option value="stopped">Stopped / Failed</option>
                </select>
              </div>
              <!-- 3. Run Type -->
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Run Type</label>
                <select [(ngModel)]="filterType" (ngModelChange)="onFilterChange()" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; background-color: #f8fafc;">
                  <option value="all">All Types</option>
                  <option value="quality_analysis">Quality Analysis</option>
                  <option value="quality_correction">Quality Correction</option>
                  <option value="traceability_analysis">Traceability Analysis</option>
                  <option value="traceability_correction">Traceability Correction</option>
                </select>
              </div>
              <!-- 4. Date Filter -->
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Date Filter</label>
                <select [(ngModel)]="filterDate" (ngModelChange)="onFilterChange()" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; background-color: #f8fafc;">
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          <button class="btn btn-primary" (click)="newExecution.emit()">
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

      <div *ngIf="!isLoadingHistory && filteredHistory.length === 0" class="no-runs" style="color: var(--text-secondary); font-size: 0.85rem; padding: 12px 0;">
        No execution runs found matching the filters.
      </div>

      <div *ngIf="!isLoadingHistory && filteredHistory.length > 0" class="minimized-shelf">
        <div *ngFor="let run of pagedHistory" class="history-card" [class.minimized]="run.minimized === 1">
          <div class="history-header" (click)="toggleMinimize(run.run_id, run.minimized === 1)" style="cursor: pointer; user-select: none;">
            <div class="history-meta" style="display: flex; gap: 16px; align-items: center;">
              <div style="display: flex; gap: 8px;">
                <span class="badge" [ngStyle]="getRunTypeBadgeStyle(run.type)">{{ getRunTypeTag(run.type) }}</span>
              </div>
              <div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">{{ getRunHeaderTitle(run) }}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">{{ run.timestamp | date:'medium' }}</div>
              </div>
            </div>
            <div class="history-actions" style="display: flex; align-items: center; gap: 16px;">
              <span class="badge" [class.badge-pass]="run.status === 'completed'" [class.badge-fail]="run.status === 'stopped'" [class.badge-running]="run.status === 'running' || run.status === 'paused'">
                {{ run.status }}
              </span>
            </div>
          </div>
          
          <!-- Expanded content -->
          <div class="history-body" *ngIf="run.minimized !== 1">
            <div style="display: flex; gap: 24px;">
              
              <!-- Left Column: Summary Metrics -->
              <div class="summary-col" style="flex: 0 0 320px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">Summary Metrics</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn btn-primary btn-sm" (click)="$event.stopPropagation(); viewRun.emit(run.run_id)" title="View in details" style="padding: 4px 10px; font-size: 0.75rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      View Details
                    </button>
                    <button *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0" (click)="exportRun(run.run_id)" style="background: none; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; color: var(--color-primary); font-size: 0.78rem; font-weight: 500; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Export CSV
                    </button>
                  </div>
                </div>
                
                <div *ngIf="run.project_name" style="margin-bottom: 8px; font-size: 0.8rem; color: var(--text-secondary); background: #f1f5f9; padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-color);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  <span><strong style="color: var(--text-primary);">Project:</strong> {{ run.project_name }}</span>
                </div>

                <div *ngIf="isQualityRun(run.type)" style="margin-bottom: 16px; font-size: 0.8rem; color: var(--text-secondary); background: #f1f5f9; padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-color);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <span><strong style="color: var(--text-primary);">Rules File:</strong> {{ run.guideline_name || 'None' }}</span>
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
                  <div class="bar-segment bar-pass" [style.width.%]="getPercentage(run.pass_count, run.total_count)" title="Pass" style="background-color: var(--color-success); height: 100%;"></div>
                  <div class="bar-segment bar-review" [style.width.%]="getPercentage(run.review_count + run.fail_count, run.total_count)" title="Review" style="background-color: #d97706; height: 100%;"></div>
                </div>
              </div>

              <!-- Right Column: Mini table -->
              <div class="table-col" style="flex: 1; min-width: 0;" *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0">
                <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                  <!-- Quality Table -->
                  <table *ngIf="!isTraceabilityRun(run.type)" style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; background: #fff;">
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

                  <!-- Traceability Table -->
                  <table *ngIf="isTraceabilityRun(run.type)" style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; background: #fff;">
                    <thead>
                      <tr style="background-color: #f8fafc;">
                        <th style="padding: 12px 16px; width: 40%;">SYS.1 ID</th>
                        <th style="padding: 12px 16px; width: 60%;">SYS.2 IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of expandedResults[run.run_id] | slice:(getCurrentPage(run.run_id) - 1) * 3:getCurrentPage(run.run_id) * 3" style="border-top: 1px solid var(--border-color);">
                        <td style="padding: 16px; vertical-align: top;">
                          <a href="javascript:void(0)" (click)="openTraceDetails(row)" style="font-weight: 600; color: var(--color-primary); text-decoration: underline;">
                            {{ row.swe1_id || '-' }}
                          </a>
                        </td>
                        <td style="padding: 16px; vertical-align: top;">
                          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <a *ngFor="let swe2 of row.parsed_swe2_list" href="javascript:void(0)" (click)="openTraceDetails(row)" style="font-weight: 600; color: #0f766e; text-decoration: underline;">
                              {{ swe2.id || '-' }}
                            </a>
                          </div>
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
      
      <!-- History Pagination (client-side, 8 per page, kept in sync with the header control) -->
      <div *ngIf="!isLoadingHistory && filteredHistory.length > historyPageSize" style="display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; margin-bottom: 24px;">
        <button class="btn btn-secondary btn-sm" [disabled]="historyPage === 1" (click)="prevHistoryPage()" style="padding: 4px 14px;">
          ‹ Prev
        </button>
        <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">
          Page {{ historyPage }} of {{ getHistoryTotalPages() }} <span style="color: var(--text-primary);">({{ filteredHistory.length }} matching runs)</span>
        </span>
        <button class="btn btn-secondary btn-sm" [disabled]="historyPage === getHistoryTotalPages()" (click)="nextHistoryPage()" style="padding: 4px 14px;">
          Next ›
        </button>
      </div>
      
      <!-- Traceability Details Modal -->
      <div class="modal-overlay" *ngIf="showTraceModal" (click)="closeTraceDetails()">
        <div class="modal-content" style="max-width: 600px; padding: 24px;" (click)="$event.stopPropagation()">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600;">Traceability Links</h3>
            <button class="icon-btn-minimal" (click)="closeTraceDetails()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div *ngIf="traceModalData" style="display: flex; flex-direction: column; gap: 20px; max-height: 60vh; overflow-y: auto;">
            <div>
              <div style="font-weight: 700; color: #0369a1; margin-bottom: 8px; font-size: 0.9rem;">SYS.1: {{ traceModalData.swe1_id || '-' }}</div>
              
              <div *ngIf="traceModalData.swe1_id" style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-primary);">
                {{ traceModalData.swe1_text || '-' }}
              </div>
              <div *ngIf="!traceModalData.swe1_id" style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; color: #94a3b8; font-style: italic;">
                No requirement found (Orphaned in SYS.2)
              </div>
            </div>
            
            <div>
              <div style="font-weight: 700; color: #0f766e; margin-bottom: 8px; font-size: 0.9rem;">Linked SYS.2 Requirements</div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <ng-container *ngIf="traceModalData.req_id">
                  <div *ngFor="let swe2 of traceModalData.parsed_swe2_list" style="background: #f0fdfa; padding: 12px; border-radius: 6px; border: 1px solid #ccfbf1;">
                    <div style="font-weight: 600; color: #0f766e; font-size: 0.8rem; margin-bottom: 4px;">{{ swe2.id || '-' }}</div>
                    <div style="font-size: 0.85rem; color: var(--text-primary);">{{ swe2.text || '-' }}</div>
                  </div>
                </ng-container>
                
                <div *ngIf="!traceModalData.req_id" style="background: #f0fdfa; padding: 12px; border-radius: 6px; border: 1px solid #ccfbf1;">
                  <span style="color: #94a3b8; font-style: italic; font-size: 0.85rem;">No requirement found (Orphaned in SYS.1)</span>
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
    .stop-run-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #ef4444;
      background: #fff;
      border: 1.5px solid #ef4444;
      border-radius: 999px;
      cursor: pointer;
      transition: var(--transition);
      line-height: 1.2;
    }
    .stop-run-btn:hover {
      background-color: #ef4444;
      color: #fff;
    }
    .stop-run-btn svg {
      flex-shrink: 0;
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
    .filter-count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      margin-left: 6px;
      background-color: var(--color-primary);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      border-radius: 999px;
      line-height: 1;
    }
    
    .modal-overlay {
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
    
    .modal-content {
      background: var(--bg-card);
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
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
  @Output() newExecution = new EventEmitter<void>();
  
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
  totalProjectsCount: number = 0;
  expandedResults: { [runId: string]: any[] } = {};
  currentPage: { [runId: string]: number } = {};
  isLoadingHistory: boolean = true;

  // Client-side pagination over whatever has been LOADED so far. The
  // backend caps a bare getHistory() call at its own default limit (15),
  // so we fetch explicitly in batches of `loadBatchSize` and append each
  // batch to `history` via the "+ Load More" button. The "Prev 8 / Next 8"
  // controls then just slice that growing, already-filtered array — no
  // network round-trip needed just to page through what's already loaded.
  historyPage: number = 1;
  historyPageSize: number = 5;
  loadBatchSize: number = 15;
  totalHistoryCount: number = 0;
  hasMoreHistory: boolean = true;
  isLoadingMoreHistory: boolean = false;
  private isFetchingHistoryBatch: boolean = false;

  // Filter State
  showFilterPanel: boolean = false;
  filterStatus: string = 'all';
  filterType: string = 'all';
  filterDate: string = 'all';
  filterProject: string = 'all';
  projectSearchTerm: string = '';
  projectsList: any[] = [];
  
  showTraceModal: boolean = false;
  traceModalData: any = null;

  // Number of filters currently set away from their "all" default — drives
  // the badge shown on the Filter button. Only non-zero when something is
  // actually filtered.
  get activeFilterCount(): number {
    let count = 0;
    if (this.filterStatus !== 'all') count++;
    if (this.filterType !== 'all') count++;
    if (this.filterDate !== 'all') count++;
    if (this.filterProject !== 'all') count++;
    return count;
  }

  get filteredProjects(): any[] {
    if (!this.projectsList) return [];
    if (!this.projectSearchTerm || !this.projectSearchTerm.trim()) {
      return this.projectsList;
    }
    const term = this.projectSearchTerm.toLowerCase().trim();
    return this.projectsList.filter(p => p.name && p.name.toLowerCase().includes(term));
  }

  openTraceDetails(row: any) {
    this.traceModalData = row;
    this.showTraceModal = true;
  }

  closeTraceDetails() {
    this.showTraceModal = false;
    this.traceModalData = null;
  }

  getParsedSwe2List(row: any): any[] {
    if (!row.req_id || row.req_id === '-' || row.req_id.trim() === '') {
      return [{ id: '-', text: row.input_req || '-' }];
    }
    
    const ids = row.req_id.split(',').map((id: string) => id.trim());
    const texts = row.input_req ? row.input_req.split('\n').map((t: string) => t.trim()) : [];
    
    const parsedList = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let text = '-';
      
      const prefix = `• ${id}:`;
      const match = texts.find((t: string) => t.startsWith(prefix));
      if (match) {
        text = match.substring(prefix.length).trim();
      } else if (texts[i]) {
        text = texts[i].replace(/^•\s*[A-Za-z0-9_\-\.]+:\s*/, '').trim();
      }
      
      parsedList.push({ id, text });
    }
    
    return parsedList.length > 0 ? parsedList : [{ id: '-', text: row.input_req || '-' }];
  }

  get filteredHistory(): any[] {
    return this.history.filter(run => {
      // 1. Status Filter
      if (this.filterStatus !== 'all') {
        if (this.filterStatus === 'running' && run.status !== 'running' && run.status !== 'paused') return false;
        if (this.filterStatus === 'completed' && run.status !== 'completed') return false;
        if (this.filterStatus === 'stopped' && run.status !== 'stopped' && run.status !== 'failed') return false;
      }
      
      // 2. Type Filter
      if (this.filterType !== 'all') {
        const runType = (run.type || '').toLowerCase();
        if (this.filterType === 'quality_analysis') {
          if (runType !== 'quality_analysis' && runType !== 'quality') return false;
        } else if (this.filterType === 'quality_correction') {
          if (runType !== 'quality_correction') return false;
        } else if (this.filterType === 'traceability_analysis') {
          if (runType !== 'traceability_analysis' && runType !== 'traceability') return false;
        } else if (this.filterType === 'traceability_correction') {
          if (runType !== 'traceability_correction') return false;
        } else if (this.filterType === 'quality') {
          if (!this.isQualityRun(runType)) return false;
        } else if (this.filterType === 'traceability') {
          if (!this.isTraceabilityRun(runType)) return false;
        } else if (runType !== this.filterType) {
          return false;
        }
      }
      
      // 3. Date Filter
      if (this.filterDate !== 'all') {
        const runDate = new Date(run.timestamp);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - runDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (this.filterDate === 'today' && diffDays > 1) return false;
        if (this.filterDate === 'week' && diffDays > 7) return false;
        if (this.filterDate === 'month' && diffDays > 30) return false;
      }
      
      // 4. Project Filter
      if (this.filterProject !== 'all') {
        const runProject = (run.project_name || '').toLowerCase();
        if (runProject !== this.filterProject.toLowerCase()) return false;
      }
      
      return true;
    });
  }

  // NEW: slice of filteredHistory shown on the current 8-item page. This is
  // what the *ngFor in the template iterates over now instead of the full
  // filteredHistory array.
  get pagedHistory(): any[] {
    const start = (this.historyPage - 1) * this.historyPageSize;
    return this.filteredHistory.slice(start, start + this.historyPageSize);
  }

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef, private eRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (this.showFilterPanel) {
      const clickedInside = this.eRef.nativeElement.querySelector('.runs-history-header')?.contains(event.target);
      if (!clickedInside) {
        this.showFilterPanel = false;
        this.cdr.detectChanges();
      }
    }
  }

  toggleFilterPanel(event: Event) {
    this.showFilterPanel = !this.showFilterPanel;
    event.stopPropagation();
  }

  // NEW: whenever a filter changes, jump back to page 1 and re-run the
  // expanded-results prefetch for whatever is now visible.
  onFilterChange() {
    this.historyPage = 1;
    this.prefetchVisibleExpanded();
  }

  clearFilters(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.filterStatus = 'all';
    this.filterType = 'all';
    this.filterDate = 'all';
    this.filterProject = 'all';
    this.projectSearchTerm = '';
    this.historyPage = 1;
    this.prefetchVisibleExpanded();
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.historyPage = 1;
    this.history = [];
    this.hasMoreHistory = true;
    this.totalHistoryCount = 0;
    this.overallPassRate = 0;
    this.isLoadingHistory = true;
    this.loadMoreHistory();

    this.apiService.getRagMetrics().subscribe({
      next: (res) => {
        this.ragMetrics = res;
      }
    });

    this.apiService.getProjects().subscribe({
      next: (projects: any[]) => {
        this.projectsList = projects || [];
        this.totalProjectsCount = this.projectsList.length;
        this.cdr.detectChanges();
      }
    });
  }

  // Fetches the NEXT batch of runs (offset = however many are already
  // loaded, limit = loadBatchSize), appends it to `history`, and — instead
  // of waiting for another click — immediately kicks off the following
  // batch as well. This repeats until the backend returns a short batch
  // (meaning we've reached the end), so the full history loads in one
  // automatic pass while the list is already visible and usable.
  loadMoreHistory() {
    if (this.isFetchingHistoryBatch || !this.hasMoreHistory) return;
    this.isFetchingHistoryBatch = true;

    const isInitialLoad = this.history.length === 0;
    if (!isInitialLoad) {
      this.isLoadingMoreHistory = true;
    }

    const offset = this.history.length;
    this.apiService.getHistory(this.loadBatchSize, offset).subscribe({
      next: (batch: any[]) => {
        this.history = this.history.concat(batch);
        this.totalHistoryCount = this.history.length;
        this.hasMoreHistory = batch.length === this.loadBatchSize;

        // Recompute the pass-rate metric across everything loaded so far.
        let total = 0;
        let passes = 0;
        this.history.forEach(run => {
          total += run.total_count;
          passes += run.pass_count;
        });
        this.overallPassRate = total > 0 ? Math.round((passes / total) * 100) : 0;

        this.isLoadingHistory = false;
        this.isFetchingHistoryBatch = false;
        this.prefetchVisibleExpanded();
        this.cdr.detectChanges();

        if (this.hasMoreHistory) {
          this.loadMoreHistory();
        } else {
          this.isLoadingMoreHistory = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.isLoadingHistory = false;
        this.isLoadingMoreHistory = false;
        this.isFetchingHistoryBatch = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Pre-fetches result details for any non-minimized run that is currently
  // visible on the active 8-item page (equivalent of the old per-page
  // prefetch loop, just driven off pagedHistory instead of the server page).
  prefetchVisibleExpanded() {
    this.pagedHistory.forEach(run => {
      if (run.minimized !== 1 && !this.expandedResults[run.run_id]) {
        this.apiService.getRunResults(run.run_id).subscribe(details => {
          if (this.isTraceabilityRun(run.type)) {
            details.forEach((r: any) => r.parsed_swe2_list = this.getParsedSwe2List(r));
          }
          this.expandedResults[run.run_id] = details;
          this.cdr.detectChanges();
        });
      }
    });
  }

  getHistoryTotalPages(): number {
    return Math.ceil(this.filteredHistory.length / this.historyPageSize) || 1;
  }

  goToHistoryPage(page: number) {
    const totalPages = this.getHistoryTotalPages();
    if (page < 1 || page > totalPages || page === this.historyPage) return;
    this.historyPage = page;
    this.prefetchVisibleExpanded();
  }

  // NEW: convenience wrappers used by both the heading control and the
  // bottom pager so "Next 8" / "Prev 8" always move exactly one page
  // (historyPageSize = 8 records) in either direction. If the user pages
  // past the end of what's currently loaded and more is available on the
  // backend, this fetches the next batch automatically instead of just
  // sitting disabled.
  nextHistoryPage() {
    const totalPages = this.getHistoryTotalPages();
    if (this.historyPage >= totalPages && this.hasMoreHistory) {
      this.historyPage++;
      this.loadMoreHistory();
      return;
    }
    this.goToHistoryPage(this.historyPage + 1);
  }

  prevHistoryPage() {
    this.goToHistoryPage(this.historyPage - 1);
  }

  getPercentage(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }

  toggleMinimize(runId: string, currentlyMinimized: boolean) {
    const run = this.history.find(r => r.run_id === runId);
    if (run) {
      run.minimized = currentlyMinimized ? 0 : 1;
    }

    this.apiService.minimizeRun(runId, !currentlyMinimized).subscribe(() => {
      if (currentlyMinimized) { // was minimized, now expanding
        this.apiService.getRunResults(runId).subscribe(res => {
          const runType = this.history.find(r => r.run_id === runId)?.type;
          if (runType === 'traceability') {
            res.forEach((r: any) => r.parsed_swe2_list = this.getParsedSwe2List(r));
          }
          this.expandedResults[runId] = res;
          this.currentPage[runId] = 1;
          this.cdr.detectChanges();
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

  // NEW: Stop a still-running/paused run directly from the history card.
  // Mirrors RequirementsComponent.stopRun() — same API call, same intent —
  // but updates the row in place instead of relying on an active polling
  // loop, since the Dashboard doesn't poll individual runs.
  stopRun(runId: string) {
    this.apiService.stopAnalysis(runId).subscribe({
      next: () => {
        const run = this.history.find(r => r.run_id === runId);
        if (run) {
          run.status = 'stopped';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Failed to stop run: ' + (err.error?.detail || err.message));
      }
    });
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

  getRunTypeTag(type: string): string {
    if (!type) return 'ANALYSIS RUN';
    const t = type.toLowerCase();
    if (t === 'quality_correction' || t.includes('quality_corr')) {
      return 'QUALITY CORRECTION';
    } else if (t === 'quality_analysis' || t === 'quality') {
      return 'QUALITY ANALYSIS';
    } else if (t === 'traceability_correction' || t.includes('trace_corr') || t.includes('traceability_corr')) {
      return 'TRACEABILITY CORRECTION';
    } else if (t === 'traceability_analysis' || t === 'traceability') {
      return 'TRACEABILITY ANALYSIS';
    }
    return type.toUpperCase() + ' RUN';
  }

  getRunTypeBadgeStyle(type: string): { [key: string]: string } {
    const t = (type || '').toLowerCase();
    const baseStyle = {
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'width': '170px',
      'min-width': '170px',
      'height': '26px',
      'padding': '0 8px',
      'font-size': '0.63rem',
      'font-weight': '700',
      'letter-spacing': '0.3px',
      'border-radius': '6px',
      'box-sizing': 'border-box',
      'text-transform': 'uppercase',
      'white-space': 'nowrap',
      'text-align': 'center',
      'box-shadow': '0 1px 2px rgba(0,0,0,0.03)'
    };

    if (t.includes('quality_correction')) {
      return {
        ...baseStyle,
        'background-color': '#f3e8ff',
        'color': '#6b21a8',
        'border': '1px solid #d8b4fe'
      };
    } else if (t.includes('quality')) {
      return {
        ...baseStyle,
        'background-color': '#eff6ff',
        'color': '#1d4ed8',
        'border': '1px solid #bfdbfe'
      };
    } else if (t.includes('traceability_correction')) {
      return {
        ...baseStyle,
        'background-color': '#fffbeb',
        'color': '#b45309',
        'border': '1px solid #fde68a'
      };
    } else if (t.includes('traceability')) {
      return {
        ...baseStyle,
        'background-color': '#f0fdf4',
        'color': '#15803d',
        'border': '1px solid #bbf7d0'
      };
    }
    return {
      ...baseStyle,
      'background-color': '#eff6ff',
      'color': '#1d4ed8',
      'border': '1px solid #bfdbfe'
    };
  }

  getRunHeaderTitle(run: any): string {
    if (!run) return 'Execution Suite';
    const suiteName = this.isQualityRun(run.type) ? 'Requirement Validation Suite' : 'Traceability Mapping Audit';
    if (run.project_name) {
      return `${run.project_name} — ${suiteName}`;
    }
    return suiteName;
  }

  isQualityRun(type: string): boolean {
    return !!type && type.toLowerCase().includes('quality');
  }

  isTraceabilityRun(type: string): boolean {
    return !!type && type.toLowerCase().includes('traceability');
  }
}
