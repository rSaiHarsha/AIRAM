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
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin: 0;">Projects ({{ filteredProjects.length }})</h2>
        <div style="display: flex; gap: 12px; align-items: center; position: relative;">
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
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Search Project</label>
                <div style="position: relative; margin-bottom: 6px;">
                  <input type="text" [(ngModel)]="projectSearchTerm" placeholder="🔍 Search projects..." style="width: 100%; padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.8rem; background-color: #fff;" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div *ngIf="filteredProjects.length === 0" class="no-runs" style="color: var(--text-secondary); font-size: 0.85rem; padding: 12px 0;">
        No projects found matching the filters.
      </div>

      <div *ngIf="filteredProjects.length > 0" class="minimized-shelf">
        <div *ngFor="let p of filteredProjects" class="history-card" [class.minimized]="!expandedProjects[p.id]">
          <div class="history-header" (click)="toggleProjectExpand(p.id)" style="cursor: pointer; user-select: none;">
            <div class="history-meta" style="display: flex; gap: 16px; align-items: center;">
              <div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">{{ p.name }}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; max-width: 400px;">{{ p.description || 'No description provided' }}</div>
              </div>
            </div>
            <div class="history-actions" style="display: flex; align-items: center; gap: 16px;">
               <div style="font-size: 0.75rem; color: var(--text-secondary);">Updated: {{ p.created_at | date:'MMM d, yyyy' }}</div>
               <svg [style.transform]="expandedProjects[p.id] ? 'rotate(180deg)' : 'rotate(0deg)'" style="transition: transform 0.2s; color: var(--text-secondary);" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          
          <!-- Expanded content -->
          <div class="history-body" *ngIf="expandedProjects[p.id]" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            
            <!-- Metadata Bar (like projects.ts) -->
            <div style="display: flex; gap: 32px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Created
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                  {{ p.created_at | date:'MMM d, yyyy' }}
                </div>
              </div>
              <div style="width: 1px; background-color: var(--border-color);"></div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Documents
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                  <ng-container *ngIf="projectReqs[p.id]">
                     {{ (projectReqs[p.id].sys1?.length ? 1 : 0) + (projectReqs[p.id].sys2?.length ? 1 : 0) + (projectReqs[p.id].sys3?.length ? 1 : 0) + (projectReqs[p.id].swe1?.length ? 1 : 0) + (projectReqs[p.id].swe2?.length ? 1 : 0) }}
                  </ng-container>
                  <ng-container *ngIf="!projectReqs[p.id]">-</ng-container>
                </div>
              </div>
              <div style="width: 1px; background-color: var(--border-color);"></div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  Total Requirements
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                  <ng-container *ngIf="projectReqs[p.id]">
                    {{ (projectReqs[p.id].sys1?.length || 0) + (projectReqs[p.id].sys2?.length || 0) + (projectReqs[p.id].sys3?.length || 0) + (projectReqs[p.id].swe1?.length || 0) + (projectReqs[p.id].swe2?.length || 0) }}
                  </ng-container>
                  <ng-container *ngIf="!projectReqs[p.id]">-</ng-container>
                </div>
              </div>
            </div>

            <!-- Overview Section -->
            <h3 style="margin: 0 0 16px 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Overview</h3>
            
            <div *ngIf="isLoadingProjectReqs[p.id]" style="color: var(--text-secondary); padding: 20px; text-align: center;">
              <div class="spinner" style="margin-bottom: 12px; width: 20px; height: 20px;"></div>
              <div>Loading project requirements...</div>
            </div>
            
            <div *ngIf="!isLoadingProjectReqs[p.id] && projectReqs[p.id]" style="display: flex; gap: 16px; flex-wrap: wrap;">
              
              <!-- SYS 1 Card -->
              <div class="document-card" *ngIf="projectReqs[p.id].sys1 && projectReqs[p.id].sys1.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #f0fdf4);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                  <div style="display: flex; gap: 9px; align-items: flex-start;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SYS.1 Requirements</div>
                      <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">Requirements Elicitation</div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                  <div>
                    <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ projectReqs[p.id].sys1.length }}</div>
                  </div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.68rem; color: var(--text-secondary);">System Level 1</span>
                  <button class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); viewProjectDetails.emit({projectId: p.id, tab: 'sys1'})" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                    View Details →
                  </button>
                </div>
              </div>

              <!-- SYS 2 Card -->
              <div class="document-card" *ngIf="projectReqs[p.id].sys2 && projectReqs[p.id].sys2.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #eff6ff);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                  <div style="display: flex; gap: 9px; align-items: flex-start;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SYS.2 Requirements</div>
                      <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">System Req Analysis</div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                  <div>
                    <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ projectReqs[p.id].sys2.length }}</div>
                  </div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.68rem; color: var(--text-secondary);">System Level 2</span>
                  <button class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); viewProjectDetails.emit({projectId: p.id, tab: 'sys2'})" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                    View Details →
                  </button>
                </div>
              </div>

              <!-- SYS 3 Card -->
              <div class="document-card" *ngIf="projectReqs[p.id].sys3 && projectReqs[p.id].sys3.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #faf5ff);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                  <div style="display: flex; gap: 9px; align-items: flex-start;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SYS.3 Requirements</div>
                      <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">System Arch Design</div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                  <div>
                    <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ projectReqs[p.id].sys3.length }}</div>
                  </div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.68rem; color: var(--text-secondary);">System Level 3</span>
                  <button class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); viewProjectDetails.emit({projectId: p.id, tab: 'sys3'})" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                    View Details →
                  </button>
                </div>
              </div>

              <!-- SWE 1 Card -->
              <div class="document-card" *ngIf="projectReqs[p.id].swe1 && projectReqs[p.id].swe1.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #fdf4ff);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                  <div style="display: flex; gap: 9px; align-items: flex-start;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c026d3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SWE.1 Requirements</div>
                      <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">Software Req Analysis</div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                  <div>
                    <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ projectReqs[p.id].swe1.length }}</div>
                  </div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.68rem; color: var(--text-secondary);">Software Level 1</span>
                  <button class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); viewProjectDetails.emit({projectId: p.id, tab: 'swe1'})" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                    View Details →
                  </button>
                </div>
              </div>

              <!-- SWE 2 Card -->
              <div class="document-card" *ngIf="projectReqs[p.id].swe2 && projectReqs[p.id].swe2.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #fffbeb);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                  <div style="display: flex; gap: 9px; align-items: flex-start;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SWE.2 Requirements</div>
                      <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">Software Arch Design</div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                  <div>
                    <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ projectReqs[p.id].swe2.length }}</div>
                  </div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.68rem; color: var(--text-secondary);">Software Level 2</span>
                  <button class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); viewProjectDetails.emit({projectId: p.id, tab: 'swe2'})" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                    View Details →
                  </button>
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
  @Output() viewProjectDetails = new EventEmitter<{projectId: string, tab: string}>();
  expandedProjects: { [projectId: string]: boolean } = {};
  projectReqs: { [projectId: string]: any } = {};
  isLoadingProjectReqs: { [projectId: string]: boolean } = {};

  toggleProjectExpand(projectId: string) {
    this.expandedProjects[projectId] = !this.expandedProjects[projectId];
    if (this.expandedProjects[projectId] && !this.projectReqs[projectId]) {
      this.isLoadingProjectReqs[projectId] = true;
      this.apiService.getProjectRequirements(projectId).subscribe({
        next: (res: any) => {
          this.projectReqs[projectId] = res;
          this.isLoadingProjectReqs[projectId] = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.isLoadingProjectReqs[projectId] = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

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
