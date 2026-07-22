import { Component, OnInit, OnDestroy, Input, HostListener, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-requirements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="req-container">
      <div style="margin-bottom: 24px;">
        <h2 class="section-title" style="margin-bottom: 4px;">Requirement Evaluation Workspace</h2>
        <p class="section-desc">Upload requirements and evaluate them against standards.</p>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 20px;">
          Workspace Setup
        </div>
        
        <div class="grid grid-2" style="align-items: stretch; gap: 24px;">
          <!-- Left Configuration: Upload fields -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Select Project <span style="font-weight: normal; color: var(--color-primary);">*</span></label>
              <select [(ngModel)]="selectedProjectId" style="width: 100%;">
                <option value="" disabled>-- Select a Project --</option>
                <option *ngFor="let p of projects" [value]="p.id">{{ p.name }} ({{ p.created_at | date:'short' }})</option>
              </select>
              <div *ngIf="projects.length === 0" style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
                No projects found. Go to the Projects tab to create one.
              </div>
            </div>

            <!-- Analysis Model selector -->
            <div class="form-group">
              <label class="form-label">Analysis Model</label>
              <select [(ngModel)]="selectedAnalysisModel" style="width: 100%;">
                <option value="nvidia/llama-3.3-nemotron-super-49b-v1.5">Llama 3.3 Nemotron 49B (NVIDIA)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Select Analysis Actions</label>
              <div class="checkbox-group" style="display: flex; gap: 16px; flex-wrap: wrap;">
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.analyse" [disabled]="actions.correct"> Quality Analysis
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.correct" (ngModelChange)="onCorrectionToggle($event)"> Quality Correction
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.trace" [disabled]="actions.correctTrace"> Traceability Analysis (SWE.2 to SWE.1)
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.correctTrace" (ngModelChange)="onTraceCorrectionToggle($event)"> Traceability Correction
                </label>
              </div>
            </div>
          </div>

          <!-- Right Configuration: Actions & Settings -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Mode</label>
              <div class="segmented-control">
                <div class="segment" [class.active]="rulesMode === 'strict'" (click)="rulesMode = 'strict'">Strict Rules</div>
                <div class="segment" [class.active]="rulesMode === 'rag'" (click)="rulesMode = 'rag'">RAG Engine</div>
                <div class="segment" [class.active]="rulesMode === 'custom'" (click)="rulesMode = 'custom'">Custom LLM</div>
              </div>
            </div>

            <div *ngIf="rulesMode === 'custom'" style="margin-top: -8px; margin-bottom: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" (click)="openCustomContextModal()" style="width: 100%;">
                ⚙️ Configure Custom Context
              </button>
            </div>

            <!-- Guidelines File Selector if strict is chosen -->
            <div class="form-group" *ngIf="rulesMode === 'strict'">
              <label class="form-label">Strict Guidelines Reference</label>
              <div style="display: flex; gap: 8px; align-items: stretch; position: relative;">
                
                <!-- Custom Multi-select Dropdown -->
                <div class="custom-dropdown" style="flex: 1; position: relative;">
                  <!-- Dropdown Toggle Button -->
                  <div class="dropdown-toggle" (click)="toggleDropdown()" style="display: flex; justify-content: space-between; align-items: center; min-height: 38px; border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.85rem; user-select: none;">
                    <span>{{ getSelectedCountText() }}</span>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">▼</span>
                  </div>
                  
                  <!-- Dropdown Options List -->
                  <div class="dropdown-menu-panel" *ngIf="showDropdown" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #fff; border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 1500; max-height: 200px; overflow-y: auto; padding: 6px 0; display: flex; flex-direction: column;">
                    
                    <!-- Select All Option -->
                    <label class="dropdown-item" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                      <input type="checkbox" [checked]="isAllSelected()" (change)="toggleSelectAll()">
                      <span style="font-weight: 600;">Select All</span>
                    </label>
                    <div style="border-bottom: 1px solid var(--border-color); margin: 4px 0;"></div>
                    
                    <!-- Individual Guidelines -->
                    <label *ngFor="let g of guidelines" class="dropdown-item" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                      <input type="checkbox" [checked]="isSelectedGuideline(g.id)" (change)="toggleGuideline(g.id)">
                      <span style="flex: 1;">{{ g.name }}</span>
                      <button type="button" (click)="deleteGuideline(g.id, $event)" style="background: none; border: none; cursor: pointer; padding: 4px; color: #ef4444; opacity: 0.7; font-size: 1rem; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.opacity=1; this.style.transform='scale(1.1)';" onmouseout="this.style.opacity=0.7; this.style.transform='scale(1)';" title="Delete Guideline">
                        ✕
                      </button>
                    </label>
                    
                    <div *ngIf="guidelines.length === 0" style="padding: 8px 12px; color: var(--text-secondary); font-size: 0.85rem;">
                      No guidelines uploaded yet.
                    </div>
                  </div>
                </div>

                <button type="button" class="btn btn-secondary" (click)="openUploadModal()" style="padding: 0 14px; font-size: 0.85rem; height: 38px; display: inline-flex; align-items: center; gap: 4px;">
                  🔧 Manage
                </button>
              </div>
            </div>

            <!-- Embedding Model selector (Visible only if RAG search is chosen) -->
            <div class="form-group" *ngIf="rulesMode === 'rag'">
              <label class="form-label">RAG Embedding Model</label>
              <select [(ngModel)]="selectedEmbedModel" style="width: 100%;">
                <option value="nvidia/embeddings-nv-embed-qa-4">nv-embed-qa-4 (NVIDIA)</option>
              </select>
            </div>
            
            <div style="flex-grow: 1;"></div>
            
            <div class="execution-controls" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
              <div class="btn-group" style="display: flex; gap: 8px;">
                <button class="btn btn-primary" (click)="startRun()" *ngIf="!isRunning" [disabled]="!selectedProjectId" style="flex: 1;">
                  🚀 Start Execution
                </button>
                <button class="btn btn-warning" (click)="pauseRun()" *ngIf="isRunning && !isPaused" style="flex: 1;">
                  ⏸️ Pause
                </button>
                <button class="btn btn-success" (click)="resumeRun()" *ngIf="isRunning && isPaused" style="flex: 1;">
                  ▶️ Resume
                </button>
                <button class="btn btn-danger" (click)="stopRun()" *ngIf="isRunning" style="flex: 1;">
                  🛑 Stop
                </button>
              </div>

              <div *ngIf="isRunning || isFinished" class="progress-bar-container" style="margin-top: 16px;">
                <div class="progress-meta" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 6px;">
                  <span>Run ID: <code style="color: var(--text-primary);">{{ activeRunId }}</code></span>
                  <span *ngIf="isRunning">Processing Row: {{ currentRow }}/{{ totalRows }}</span>
                  <span *ngIf="isFinished">Run Status: <strong style="color: var(--text-primary);">{{ runStatus | uppercase }}</strong></span>
                </div>
                <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                  <div [class.bg-running]="runStatus === 'running'" [class.bg-paused]="runStatus === 'paused'" [style.width.%]="getProgressPercent()" style="height: 100%; transition: width 0.2s ease-in-out;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Results Datatable -->
      <div class="card" *ngIf="results.length > 0" style="padding: 0;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="font-weight: 600; font-size: 1.05rem;">📋 Analysis Matrix Results</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" (click)="clearResults()">🧹 Clear Results</button>
            <button class="btn btn-secondary btn-sm" (click)="exportResults()">📥 Export CSV</button>
          </div>
        </div>
        
        <div style="padding: 0 24px;">
          <div class="tabs-nav">
            <button class="tab-btn" [class.active]="activeTab === 'swe1'" (click)="activeTab = 'swe1'; currentPage = 1" *ngIf="!isTraceabilityRun && hasCategory('swe1')">SWE 1 Quality</button>
            <button class="tab-btn" [class.active]="activeTab === 'swe2'" (click)="activeTab = 'swe2'; currentPage = 1" *ngIf="!isTraceabilityRun && hasCategory('swe2')">SWE 2 Quality</button>
            <button class="tab-btn" [class.active]="activeTab === 'traceability'" (click)="activeTab = 'traceability'; currentPage = 1" *ngIf="isTraceabilityRun || hasCategory('traceability')">Traceability</button>
          </div>
        </div>
        
        <div class="table-container" style="padding: 0 24px 24px 24px; border: none; border-radius: 0;">
          <table>
            <thead>
              <tr *ngIf="!isTraceabilityRun">
                <th>ID</th>
                <th>Requirement</th>
                <th>Status</th>
                <th>Violated Rule</th>
                <th>Rationale / Reasoning</th>
                <th *ngIf="hasCorrections()">Corrected Requirement</th>
              </tr>
              <tr *ngIf="isTraceabilityRun">
                <th>SWE.1 ID</th>
                <th>SWE.1 Requirement</th>
                <th>SWE.2 ID</th>
                <th>SWE.2 Requirement</th>
                <th>Status</th>
                <th>Rationale / Reasoning</th>
                <th *ngIf="hasTraceCorrections()">Corrected Requirement</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let row of filteredResults | slice:(currentPage - 1) * pageSize : currentPage * pageSize">
                <!-- Quality Analysis View -->
                <ng-container *ngIf="!isTraceabilityRun">
                  <!-- Split Requirement / Corrections View -->
                  <ng-container *ngIf="hasCorrections() && splitCorrectedReq(row.corrected_req).length > 1; else singleRowView">
                    <tr *ngFor="let req of splitCorrectedReq(row.corrected_req); let i = index">
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="font-weight: 600; white-space: nowrap; vertical-align: top;">{{ row.req_id }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="max-width: 300px; vertical-align: top;">{{ row.input_req }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="vertical-align: top;">
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </span>
                      </td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="font-weight: 500; font-family: monospace; vertical-align: top;">{{ row.failed_rule || 'N/A' }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="color: var(--text-secondary); font-size: 0.8rem; vertical-align: top;">{{ row.rationale }}</td>
                      <td style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-bottom: 1px solid #e2e8f0; border-left: 3px solid #cbd5e1; padding-left: 10px; padding-top: 10px; padding-bottom: 10px; vertical-align: middle;">
                        <span style="color: var(--color-primary); font-weight: 600; margin-right: 6px;">{{i + 1}}.</span>{{ req }}
                      </td>
                    </tr>
                  </ng-container>

                  <!-- Standard Single Row view -->
                  <ng-template #singleRowView>
                    <tr>
                      <td style="font-weight: 600; white-space: nowrap;">{{ row.req_id }}</td>
                      <td style="max-width: 300px;">{{ row.input_req }}</td>
                      <td>
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </span>
                      </td>
                      <td style="font-weight: 500; font-family: monospace;">{{ row.failed_rule || 'N/A' }}</td>
                      <td style="color: var(--text-secondary); font-size: 0.8rem;">{{ row.rationale }}</td>
                      <td *ngIf="hasCorrections()" style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1; padding-left: 10px; padding-top: 10px; padding-bottom: 10px;">
                        <ng-container *ngIf="splitCorrectedReq(row.corrected_req).length > 0; else noQualCorr">
                          <div *ngFor="let corrReq of splitCorrectedReq(row.corrected_req); let cIdx = index" style="margin-bottom: 6px; line-height: 1.4;">
                            <span style="color: var(--color-primary); font-weight: 600; margin-right: 6px;">{{cIdx + 1}}.</span>{{ corrReq }}
                          </div>
                        </ng-container>
                        <ng-template #noQualCorr>-</ng-template>
                      </td>
                    </tr>
                  </ng-template>
                </ng-container>
                
                <!-- Traceability Matrix View -->
                <ng-container *ngIf="isTraceabilityRun">
                  <!-- Traceability with split corrected requirements -->
                  <ng-container *ngIf="hasTraceCorrections() && splitCorrectedReq(row.corrected_req).length > 1; else singleTraceRowView">
                    <tr *ngFor="let corrReq of splitCorrectedReq(row.corrected_req); let i = index">
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="font-weight: 600; white-space: nowrap; color: #0369a1; border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.swe1_id || '-' }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="max-width: 250px; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.swe1_text || '-' }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="font-weight: 600; max-width: 150px; font-size: 0.85rem; border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                        <div *ngFor="let swe2 of getSwe2List(row)" style="color: #15803d; margin-bottom: 4px;">{{ swe2.id }}</div>
                      </td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="max-width: 350px; font-size: 0.85rem; border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                        <div *ngFor="let swe2 of getSwe2List(row)" style="margin-bottom: 4px; line-height: 1.4;">
                          <span *ngIf="getSwe2List(row).length > 1" style="font-weight: 600; color: #15803d;">• </span>{{ swe2.text }}
                        </div>
                      </td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                          {{ row.status }}
                        </span>
                      </td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="color: var(--text-secondary); font-size: 0.8rem; border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.rationale }}</td>
                      <td style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-bottom: 1px solid #e2e8f0; border-left: 3px solid #cbd5e1; padding-left: 10px; padding-top: 10px; padding-bottom: 10px; vertical-align: middle;">
                        <span style="color: var(--color-primary); font-weight: 600; margin-right: 6px;">{{i + 1}}.</span>{{ corrReq }}
                      </td>
                    </tr>
                  </ng-container>

                  <!-- Standard single-row traceability view -->
                  <ng-template #singleTraceRowView>
                    <tr *ngFor="let swe2 of getSwe2List(row); let i = index">
                      <td *ngIf="i === 0" [attr.rowspan]="getSwe2List(row).length" style="font-weight: 600; white-space: nowrap; color: #0369a1; border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.swe1_id || '-' }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="getSwe2List(row).length" style="max-width: 250px; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.swe1_text || '-' }}</td>
                      <td style="font-weight: 600; max-width: 150px; font-size: 0.85rem; white-space: pre-wrap; color: #15803d; border-bottom: 1px solid var(--border-color);">{{ swe2.id }}</td>
                      <td style="max-width: 350px; font-size: 0.85rem; white-space: pre-wrap; border-bottom: 1px solid var(--border-color);">{{ swe2.text }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="getSwe2List(row).length" style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                          {{ row.status }}
                        </span>
                      </td>
                      <td *ngIf="i === 0" [attr.rowspan]="getSwe2List(row).length" style="color: var(--text-secondary); font-size: 0.8rem; border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.rationale }}</td>
                      <td *ngIf="hasTraceCorrections() && i === 0" [attr.rowspan]="getSwe2List(row).length" style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1; padding-left: 10px; padding-top: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                        <ng-container *ngIf="splitCorrectedReq(row.corrected_req).length > 0; else noTraceCorr">
                          <div *ngFor="let corrReq of splitCorrectedReq(row.corrected_req); let cIdx = index" style="margin-bottom: 6px; line-height: 1.4;">
                            <span style="color: var(--color-primary); font-weight: 600; margin-right: 6px;">{{cIdx + 1}}.</span>{{ corrReq }}
                          </div>
                        </ng-container>
                        <ng-template #noTraceCorr>-</ng-template>
                      </td>
                    </tr>
                  </ng-template>
                </ng-container>
              </ng-container>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Footer -->
        <div *ngIf="filteredResults.length > pageSize" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-secondary); border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
          <div>
            Showing <strong style="color: var(--text-primary);">{{ (currentPage - 1) * pageSize + 1 }}</strong> - <strong style="color: var(--text-primary);">{{ getMin(currentPage * pageSize, filteredResults.length) }}</strong> of <strong style="color: var(--text-primary);">{{ filteredResults.length }}</strong> requirements
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage === 1" (click)="setPage(currentPage - 1)" style="padding: 4px 12px;">
              ‹ Prev
            </button>
            <span style="font-weight: 500; color: var(--text-primary);">Page {{ currentPage }} of {{ getTotalPages() }}</span>
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage === getTotalPages()" (click)="setPage(currentPage + 1)" style="padding: 4px 12px;">
              Next ›
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Standards Setup Upload Modal -->
    <div class="modal-backdrop" *ngIf="showUploadModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0;">🔧 Manage & Upload Standards Guidelines</h3>
          <button type="button" class="modal-close" (click)="closeUploadModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="tabs-nav" style="margin-top: 0; margin-bottom: 20px;">
            <button class="tab-btn" [class.active]="activeModalTab === 'upload'" (click)="activeModalTab = 'upload'">📤 Upload New</button>
            <button class="tab-btn" [class.active]="activeModalTab === 'manage'" (click)="activeModalTab = 'manage'">📋 Available Rules</button>
          </div>

          <ng-container *ngIf="activeModalTab === 'upload'">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
              Configure strict standard documents in JSON format (e.g. INCOSE rules list, ASPICE guidelines) to enable validation.
            </p>

            <div class="form-group">
              <label class="form-label">Standards Document Name (e.g. INCOSE Rules, ASPICE SWE.1)</label>
              <input type="text" [(ngModel)]="newStandardName" placeholder="Enter name..." style="width: 100%;">
            </div>

            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label">Upload JSON Guidelines File</label>
              <div class="dropzone" (click)="stdInput.click()" [class.has-file]="standardFile" style="height: 100px; padding: 16px;">
                <div class="dropzone-icon" style="margin-bottom: 8px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                </div>
                <div class="dropzone-text" style="font-size: 0.8rem;">{{ standardFile ? standardFile.name : 'Choose JSON Guidelines File' }}</div>
                <input #stdInput type="file" (change)="onStandardFileSelected($event)" style="display: none;" accept=".json">
              </div>
            </div>

            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" (click)="closeUploadModal()">Cancel</button>
              <button 
                type="button"
                class="btn btn-primary" 
                [disabled]="!newStandardName || !standardFile || isUploadingStandard" 
                (click)="uploadStandard()">
                {{ isUploadingStandard ? 'Uploading...' : 'Upload Standards Document' }}
              </button>
            </div>

            <div *ngIf="uploadedStatus" class="alert alert-success" style="margin-top: 16px; padding: 12px; background: #e6f4ea; color: var(--color-success); border-radius: 6px; font-size: 0.85rem;">
              {{ uploadedStatus }}
            </div>
          </ng-container>

          <ng-container *ngIf="activeModalTab === 'manage'">
            <div style="max-height: 450px; overflow-y: auto; padding-right: 8px;">
              <div *ngFor="let g of guidelines" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #f8fafc;">
                
                <!-- Display Mode -->
                <ng-container *ngIf="editingGuidelineId !== g.id">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                      <h4 style="margin: 0 0 4px 0; font-size: 1rem; color: var(--text-primary);">{{ g.name }}</h4>
                      <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: {{ g.id }}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button class="btn btn-secondary btn-sm" (click)="downloadGuideline(g)" title="Download JSON" style="padding: 4px 8px;">
                        ⬇️
                      </button>
                      <button class="btn btn-secondary btn-sm" (click)="editGuideline(g)" title="Edit" style="padding: 4px 8px;">
                        ✏️
                      </button>
                      <button class="btn btn-secondary btn-sm" (click)="deleteGuideline(g.id, $event)" title="Delete" style="color: #ef4444; padding: 4px 8px;">
                        ✕
                      </button>
                    </div>
                  </div>
                </ng-container>

                <!-- Edit Mode -->
                <ng-container *ngIf="editingGuidelineId === g.id">
                  <div class="form-group" style="margin-bottom: 12px;">
                    <label class="form-label" style="font-size: 0.8rem;">Rule Name</label>
                    <input type="text" [(ngModel)]="editingGuidelineName" style="width: 100%; padding: 6px;">
                  </div>
                  <div class="form-group" style="margin-bottom: 12px;">
                    <label class="form-label" style="font-size: 0.8rem;">JSON Content</label>
                    <textarea [(ngModel)]="editingGuidelineContent" rows="12" style="width: 100%; border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; font-family: monospace; font-size: 0.8rem; resize: vertical; line-height: 1.4;"></textarea>
                  </div>
                  <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" (click)="cancelEdit()">Cancel</button>
                    <button class="btn btn-primary btn-sm" (click)="saveEditedGuideline()">Save Changes</button>
                  </div>
                </ng-container>
              </div>
              
              <div *ngIf="guidelines.length === 0" style="text-align: center; color: var(--text-secondary); padding: 24px; font-size: 0.9rem;">
                No guidelines uploaded yet.
              </div>
            </div>
          </ng-container>
        </div>
      </div>
    </div>

    <!-- Custom LLM Context Setup Modal -->
    <div class="modal-backdrop" *ngIf="showCustomContextModal">
      <div class="modal-card" style="width: 650px; max-width: 95%; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="flex-shrink: 0;">
          <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0;">⚙️ Configure Custom LLM Context</h3>
          <button type="button" class="modal-close" (click)="closeCustomContextModal()">✕</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 24px; overflow-y: auto; flex: 1;">
          
          <!-- Simple Tab Switcher (Only visible if Quality Correction is enabled) -->
          <div *ngIf="actions.correct" style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); margin-bottom: 8px;">
            <button type="button" (click)="activeConfigTab = 'analysis'" [style.border-bottom]="activeConfigTab === 'analysis' ? '2px solid var(--color-primary)' : 'none'" [style.color]="activeConfigTab === 'analysis' ? 'var(--color-primary)' : 'var(--text-secondary)'" style="background: none; border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 0.9rem; outline: none;">🔍 Auditor Config</button>
            <button type="button" (click)="activeConfigTab = 'correction'" [style.border-bottom]="activeConfigTab === 'correction' ? '2px solid var(--color-primary)' : 'none'" [style.color]="activeConfigTab === 'correction' ? 'var(--text-secondary)' : 'var(--text-secondary)'" style="background: none; border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 0.9rem; outline: none;">🛠️ Corrector Config</button>
          </div>

          <!-- Tab 1: Analysis Auditor Config -->
          <ng-container *ngIf="activeConfigTab === 'analysis'">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px; margin-top: 0;">
              Define your custom validation rules. This block is injected into the LLM system prompt for the Quality Auditor.
            </p>

            <!-- 1. Header (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">System Persona (Read-only Header)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptHeader }}</div>
            </div>

            <!-- 2. Custom Criteria (Editable) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem; color: var(--color-primary);">Custom Audit Rules (Editable Context)</label>
              <textarea [(ngModel)]="customContextText" rows="4" placeholder="Write your custom validation rules here..." style="width: 100%; border: 1px solid var(--color-primary); border-radius: 6px; padding: 12px; font-size: 0.85rem; font-family: inherit; resize: vertical; outline: none; box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.1);"></textarea>
            </div>

            <!-- 3. Footer (Read-only) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Output Format Constraint (Read-only Footer)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptFooter }}</div>
            </div>
          </ng-container>

          <!-- Tab 2: Correction Corrector Config -->
          <ng-container *ngIf="activeConfigTab === 'correction' && actions.correct">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px; margin-top: 0;">
              Define your custom instructions for rewriting requirements. This block is injected into the LLM system prompt for the Quality Corrector.
            </p>

            <!-- 1. Header (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Corrector Persona (Read-only Header)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptHeaderCorrection }}</div>
            </div>

            <!-- 2. Custom Criteria (Editable) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem; color: var(--color-primary);">Custom Correction Rules (Editable Context)</label>
              <textarea [(ngModel)]="customContextCorrectionText" rows="4" placeholder="Write your custom rewriting/correction guidelines here..." style="width: 100%; border: 1px solid var(--color-primary); border-radius: 6px; padding: 12px; font-size: 0.85rem; font-family: inherit; resize: vertical; outline: none; box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.1);"></textarea>
            </div>

            <!-- 3. Footer (Read-only) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Output Format Constraint (Read-only Footer)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptFooterCorrection }}</div>
            </div>
          </ng-container>

          <div style="display: flex; gap: 12px; margin-top: 16px; flex-shrink: 0; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" (click)="closeCustomContextModal()">Cancel</button>
            <button type="button" class="btn btn-primary" (click)="saveCustomContext()">Save Configurations</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .checkbox-lbl {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      color: var(--text-primary);
    }
    .segmented-control {
      display: flex;
      background-color: #f1f5f9;
      padding: 4px;
      border-radius: 8px;
      width: 100%;
    }
    .segment {
      flex: 1;
      text-align: center;
      padding: 8px 12px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      transition: var(--transition);
      user-select: none;
    }
    .segment.active {
      background-color: #fff;
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .segment:not(.active):hover {
      color: var(--text-primary);
    }
    .tabs-nav {
      display: flex;
      gap: 24px;
      border-bottom: 2px solid var(--border-color);
      margin-top: 16px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      padding: 12px 0;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      position: relative;
    }
    .tab-btn.active {
      color: var(--color-primary);
    }
    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 2px;
      background-color: var(--color-primary);
      border-radius: 2px 2px 0 0;
    }
    .tab-btn:hover:not(.active) {
      color: var(--text-primary);
    }
    
    .bg-running { background-color: var(--color-primary); }
    .bg-paused { background-color: var(--color-warning); }

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
    
    .modal-close {
      background: transparent;
      border: none;
      font-size: 1.2rem;
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

    .dropdown-item {
      background-color: transparent;
      transition: background-color 0.2s ease;
    }
    .dropdown-item:hover {
      background-color: #f1f3f5;
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
export class RequirementsComponent implements OnInit, OnDestroy {
  projects: any[] = [];
  selectedProjectId: string = '';
  
  actions = {
    analyse: true,
    correct: false,
    trace: false,
    correctTrace: false
  };

  rulesMode: 'strict' | 'rag' | 'custom' = 'strict';
  guidelines: any[] = [];
  selectedGuidelineIds: string[] = [];
  showDropdown = false;
  
  // Manage Guidelines Modal State
  activeModalTab: 'upload' | 'manage' = 'upload';
  editingGuidelineId: string | null = null;
  editingGuidelineName: string = '';
  editingGuidelineContent: string = '';
  
  // Custom LLM Context configurations
  showCustomContextModal = false;
  activeConfigTab: 'analysis' | 'correction' = 'analysis';
  customContextText = '1. The requirement must be written clearly.\n2. Do not use complex compound sentences.\n3. The statement must explicitly define an automotive subsystem name.';
  customContextCorrectionText = '1. Rewrite requirement to be clear and single-focused.\n2. Maintain EARS syntax pattern.\n3. Ensure all numbers use explicitly defined metric units.';
  
  fixedPromptHeader = `You are a strict, deterministic Systems Engineering Requirements Auditor.
Your task is to analyze an engineering requirement using INCOSE guidelines and EARS syntax.
You MUST:
- Identify structural components (trigger, condition, system response)
- Evaluate compliance against INCOSE guidelines, EARS syntax`;

  fixedPromptFooter = `Rules for Output:
1. Return ONLY valid JSON exactly matching the schema below.
2. Do NOT include any explanation or markdown formatting outside the JSON.
3. Do NOT invent information. Output must be perfectly reproducible.

JSON Schema:
{
  "status": "Passed" or "Review",
  "failed_rules": ["Rule name 1", "Rule name 2", ...] or [],
  "rationale": "Concise structured explanation"
}`;

  fixedPromptHeaderCorrection = `You are a strict, deterministic Senior Systems Engineer and Requirements Expert.
Your task is to analyze and correct engineering requirements using INCOSE guidelines and EARS syntax.
You MUST:
- Split the requirement if it contains multiple actions
- Clean up any grammatical or structural issues`;

  fixedPromptFooterCorrection = `Rules for Output:
1. Return ONLY valid JSON exactly matching the schema below.
2. Do NOT include any explanation or markdown formatting outside the JSON.
3. Do NOT invent information. Output must be perfectly reproducible.

JSON Schema:
{
  "split_required": boolean,
  "corrected_requirements": [string]
}`;
  
  // Modal Upload bindings
  showUploadModal = false;
  newStandardName = '';
  standardFile: File | null = null;
  isUploadingStandard = false;
  uploadedStatus = '';
  
  selectedEmbedModel = 'nvidia/embeddings-nv-embed-qa-4';
  selectedAnalysisModel = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';

  isRunning = false;
  isPaused = false;
  isFinished = false;
  
  activeRunId = '';
  currentRow = 0;
  totalRows = 0;
  runStatus = '';
  
  results: any[] = [];
  history: any[] = [];
  
  // Pagination
  currentPage = 1;
  pageSize = 15;
  
  isTraceabilityRun = false;
  
  // Tab state for output table
  activeTab: 'swe1' | 'swe2' | 'traceability' = 'swe1';
  
  private timerSubscription: any;

  constructor(private apiService: ApiService, private elementRef: ElementRef, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadProjects();
    this.loadGuidelines();
    this.loadHistory();
  }

  loadProjects() {
    this.apiService.getProjects().subscribe({
      next: (res) => {
        this.projects = res;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.elementRef.nativeElement.querySelector('.custom-dropdown')?.contains(event.target)) {
      this.showDropdown = false;
    }
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  getSelectedCountText(): string {
    if (this.selectedGuidelineIds.length === 0) {
      return '-- Select Guidelines --';
    }
    if (this.selectedGuidelineIds.length === this.guidelines.length && this.guidelines.length > 0) {
      return 'All Guidelines Selected';
    }
    return `${this.selectedGuidelineIds.length} Guideline(s) Selected`;
  }

  isAllSelected(): boolean {
    return this.guidelines.length > 0 && this.selectedGuidelineIds.length === this.guidelines.length;
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selectedGuidelineIds = [];
    } else {
      this.selectedGuidelineIds = this.guidelines.map(g => g.id);
    }
  }

  isSelectedGuideline(id: string): boolean {
    return this.selectedGuidelineIds.includes(id);
  }

  toggleGuideline(id: string) {
    const idx = this.selectedGuidelineIds.indexOf(id);
    if (idx > -1) {
      this.selectedGuidelineIds.splice(idx, 1);
    } else {
      this.selectedGuidelineIds.push(id);
    }
  }

  openUploadModal() {
    this.showUploadModal = true;
    this.uploadedStatus = '';
    this.newStandardName = '';
    this.standardFile = null;
  }

  closeUploadModal() {
    this.showUploadModal = false;
    this.loadGuidelines();
  }

  onStandardFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.standardFile = file;
      // Auto-populate the name field from filename (without extension)
      if (!this.newStandardName || this.newStandardName.trim() === '') {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        this.newStandardName = nameWithoutExt;
      }
    }
  }

  openCustomContextModal() {
    this.showCustomContextModal = true;
    if (!this.actions.correct) {
      this.activeConfigTab = 'analysis';
    }
  }

  closeCustomContextModal() {
    this.showCustomContextModal = false;
  }

  saveCustomContext() {
    this.showCustomContextModal = false;
    this.cdr.detectChanges();
  }

  deleteGuideline(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this strict guideline file?')) {
      this.apiService.deleteGuideline(id).subscribe({
        next: () => {
          this.selectedGuidelineIds = this.selectedGuidelineIds.filter(gId => gId !== id);
          this.loadGuidelines();
        },
        error: (err) => {
          alert('Failed to delete guideline: ' + (err.error?.detail || err.message));
        }
      });
    }
  }

  downloadGuideline(g: any) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(g.content, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", g.name + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  editGuideline(g: any) {
    this.editingGuidelineId = g.id;
    this.editingGuidelineName = g.name;
    this.editingGuidelineContent = JSON.stringify(g.content, null, 2);
  }

  cancelEdit() {
    this.editingGuidelineId = null;
    this.editingGuidelineName = '';
    this.editingGuidelineContent = '';
  }

  saveEditedGuideline() {
    if (!this.editingGuidelineId || !this.editingGuidelineName.trim() || !this.editingGuidelineContent.trim()) {
      alert("Name and Content cannot be empty.");
      return;
    }
    
    // Validate JSON
    try {
      JSON.parse(this.editingGuidelineContent);
    } catch (e) {
      alert("Invalid JSON content. Please ensure the rules are valid JSON format.");
      return;
    }

    this.apiService.updateGuideline(this.editingGuidelineId, this.editingGuidelineName, this.editingGuidelineContent).subscribe({
      next: () => {
        this.loadGuidelines();
        this.cancelEdit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Failed to update guideline: ' + (err.error?.detail || err.message));
      }
    });
  }

  uploadStandard() {
    if (!this.standardFile || !this.newStandardName) return;
    this.isUploadingStandard = true;
    this.uploadedStatus = '';

    this.apiService.uploadGuideline(this.newStandardName, this.standardFile).subscribe({
      next: (res) => {
        this.isUploadingStandard = false;
        this.uploadedStatus = `Successfully uploaded guideline '${res.name}'!`;
        this.newStandardName = '';
        this.standardFile = null;
        this.loadGuidelines();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isUploadingStandard = false;
        this.cdr.detectChanges();
        alert('Failed to upload guidelines: ' + (err.error?.detail || err.message));
      }
    });
  }

  loadGuidelines() {
    this.apiService.getGuidelines().subscribe({
      next: (res) => {
        this.guidelines = res;
        this.cdr.detectChanges();
      }
    });
  }

  loadHistory() {
    this.apiService.getHistory().subscribe({
      next: (res) => {
        this.history = res;
      }
    });
  }



  onCorrectionToggle(checked: boolean) {
    if (checked) {
      // Correction requires analysis — auto-enable it
      this.actions.analyse = true;
    }
  }

  onTraceCorrectionToggle(checked: boolean) {
    if (checked) {
      // Traceability correction requires traceability analysis — auto-enable it
      this.actions.trace = true;
    }
  }

  startRun() {
    if (!this.selectedProjectId) {
      alert('⚠️ Please select a project before starting execution.');
      return;
    }

    if ((this.actions.analyse || this.actions.correct) && this.rulesMode === 'strict' && this.selectedGuidelineIds.length === 0) {
      alert('⚠️ Please select at least one strict guideline document from the dropdown before starting execution.');
      return;
    }

    let runType = 'quality';
    if (this.actions.trace || this.actions.correctTrace) {
      runType = 'traceability';
      this.isTraceabilityRun = true;
      this.activeTab = 'traceability';
    } else {
      this.isTraceabilityRun = false;
      this.activeTab = 'swe1';
    }
    
    this.isRunning = true;
    this.isPaused = false;
    this.isFinished = false;
    this.runStatus = 'running';
    this.results = [];
    this.currentPage = 1;
    this.currentRow = 0;
    this.totalRows = 0;
    this.activeRunId = 'Initializing...';
 
    const useRagBool = this.rulesMode === 'rag';
    const customPromptVal = this.rulesMode === 'custom' ? this.customContextText : undefined;
    const customPromptCorrectionVal = this.rulesMode === 'custom' ? this.customContextCorrectionText : undefined;

    this.apiService.startAnalysis(
      runType,
      this.selectedProjectId,
      this.rulesMode === 'strict' ? (this.selectedGuidelineIds.join(',') || null) : null,
      useRagBool,
      this.selectedAnalysisModel,
      this.actions.correct,
      this.actions.correctTrace,
      customPromptVal,
      customPromptCorrectionVal
    ).subscribe({
      next: (res) => {
        this.activeRunId = res.run_id;
        this.startPolling();
      },
      error: (err) => {
        alert('Failed to start run: ' + (err.error?.detail || err.message));
        this.isRunning = false;
      }
    });
  }

  startPolling() {
    this.stopPolling();
    this.timerSubscription = setInterval(() => {
      this.apiService.getAnalysisStatus(this.activeRunId).subscribe({
        next: (status) => {
          this.currentRow = status.current_row;
          this.totalRows = status.total_rows;
          this.runStatus = status.status;

          // Fetch intermediate results periodically so user sees requirements committing in real time
          this.apiService.getRunResults(this.activeRunId).subscribe({
            next: (res) => {
              this.results = res.map((r: any) => {
                if (this.isTraceabilityRun && !r.parsed_swe2_list) {
                  r.parsed_swe2_list = this.getParsedSwe2List(r);
                }
                return r;
              });
              this.cdr.detectChanges();
            }
          });

          if (status.status === 'completed') {
            this.isFinished = true;
            this.isRunning = false;
            this.stopPolling();
            this.loadHistory();
          } else if (status.status === 'stopped') {
            this.isFinished = true;
            this.isRunning = false;
            this.stopPolling();
            this.loadHistory();
          } else if (status.status === 'paused') {
            this.isRunning = true;
            this.isPaused = true;
          } else {
            this.isRunning = true;
            this.isPaused = false;
          }
          this.cdr.detectChanges();
        }
      });
    }, 1000);
  }

  stopPolling() {
    if (this.timerSubscription) {
      clearInterval(this.timerSubscription);
      this.timerSubscription = null;
    }
  }

  pauseRun() {
    if (!this.activeRunId) return;
    this.apiService.pauseAnalysis(this.activeRunId).subscribe(() => {
      this.isPaused = true;
      this.runStatus = 'paused';
    });
  }

  resumeRun() {
    if (!this.activeRunId) return;
    this.apiService.resumeAnalysis(this.activeRunId).subscribe(() => {
      this.isPaused = false;
      this.runStatus = 'running';
    });
  }

  stopRun() {
    if (!this.activeRunId) return;
    this.apiService.stopAnalysis(this.activeRunId).subscribe(() => {
      this.isRunning = false;
      this.isPaused = false;
      this.isFinished = true;
      this.runStatus = 'stopped';
      this.stopPolling();
      this.loadHistory();
    });
  }

  // UPDATED: loadResults() now also restores the progress-bar / pause /
  // resume / stop controls when the loaded run is still running or paused
  // on the backend (e.g. user clicked "Load Result" on an in-progress run
  // from the Dashboard's history list). Previously this only populated the
  // results table and left isRunning/isPaused/isFinished untouched, so a
  // still-active run showed no controls at all until you started a brand
  // new execution.
  loadResults(runId: string) {
    // Stop any polling tied to a previously-active run before switching
    // context to the one being loaded.
    this.stopPolling();

    this.activeRunId = runId;
    const matchedRun = this.history.find(r => r.run_id === runId);
    this.currentPage = 1;

    this.apiService.getRunResults(runId).subscribe({
      next: (res) => {
        // FIX: previously this relied solely on `matchedRun` (a lookup into
        // the locally cached, possibly incomplete/differently-paginated
        // history array). If the run wasn't found there, isTraceabilityRun
        // silently defaulted to false and the traceability run rendered
        // using the quality-analysis table structure.
        //
        // Now we fall back to inspecting the actual row shape: traceability
        // rows always carry category='traceability'
        const looksLikeTraceability = res.length > 0 && res.some((r: any) => r.category === 'traceability');
        this.isTraceabilityRun = matchedRun ? matchedRun.type === 'traceability' : looksLikeTraceability;
        this.activeTab = this.isTraceabilityRun ? 'traceability' : 'swe1';

        this.results = res.map((r: any) => {
          if (this.isTraceabilityRun && !r.parsed_swe2_list) {
            r.parsed_swe2_list = this.getParsedSwe2List(r);
          }
          return r;
        });

        // Reflect the run's real status so the progress bar and the
        // Pause/Resume/Stop controls appear correctly for the run just
        // loaded, not just for runs started fresh in this session.
        const status = matchedRun?.status;

        if (status === 'running' || status === 'paused') {
          this.isRunning = true;
          this.isPaused = status === 'paused';
          this.isFinished = false;
          this.runStatus = status;
          this.totalRows = matchedRun?.total_count || this.results.length || 0;
          this.currentRow = this.results.length;
          // Resume live polling so the progress bar keeps advancing and the
          // Pause/Resume/Stop buttons stay in sync with backend state.
          this.startPolling();
        } else {
          this.isRunning = false;
          this.isPaused = false;
          this.isFinished = true;
          this.runStatus = status || 'completed';
        }

        this.cdr.detectChanges();
      }
    });
  }

  getSwe2List(row: any): { id: string, text: string }[] {
    if (!row) return [{ id: '-', text: '-' }];
    if (row.parsed_swe2_list && row.parsed_swe2_list.length > 0) {
      return row.parsed_swe2_list;
    }
    const parsed = this.getParsedSwe2List(row);
    row.parsed_swe2_list = parsed;
    return parsed;
  }

  getParsedSwe2List(row: any): any[] {
    if (!row || !row.req_id || row.req_id === '-' || !row.req_id.trim()) {
      return [{ id: '-', text: row?.input_req || '-' }];
    }
    
    const ids = row.req_id.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
    if (ids.length === 0) {
      return [{ id: '-', text: row.input_req || '-' }];
    }
    
    const lines = row.input_req ? row.input_req.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0) : [];
    
    const parsedList = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let text = '-';
      
      // Try prefix match: "• ID:" or "ID:" or "• ID -"
      const prefixRegex = new RegExp(`^(?:•|\\*|-)?\\s*${id}\\s*[:\\-]?\\s*`, 'i');
      const matchLine = lines.find((l: string) => prefixRegex.test(l));
      
      if (matchLine) {
        text = matchLine.replace(prefixRegex, '').trim();
      } else if (lines[i]) {
        // Fallback: use line corresponding to index, cleaning any leading bullet/ID
        text = lines[i].replace(/^(?:•|\*|-)?\s*[A-Za-z0-9_\-\.]+\s*[:\-]?\s*/, '').trim();
      }
      
      parsedList.push({ id, text: text || '-' });
    }
    
    return parsedList.length > 0 ? parsedList : [{ id: row.req_id, text: row.input_req || '-' }];
  }



  getProgressPercent(): number {
    return this.totalRows > 0 ? (this.currentRow / this.totalRows) * 100 : 0;
  }

  get filteredResults(): any[] {
    if (this.isTraceabilityRun) {
      return this.results.filter(r => r.category === 'traceability' || r.category == null);
    }
    return this.results.filter(r => r.category === this.activeTab || (this.activeTab === 'swe1' && r.category == null));
  }

  hasCategory(category: string): boolean {
    if (category === 'swe1' && !this.isTraceabilityRun) {
      return this.results.some(r => r.category === category || r.category == null);
    }
    return this.results.some(r => r.category === category);
  }

  exportResults() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Input Requirement,Status,Rule/Trace Target,Rationale,Corrected Requirement\n";
    
    this.results.forEach(row => {
      const correctedReqs = this.splitCorrectedReq(row.corrected_req);
      
      if (correctedReqs.length > 1) {
        // If split, create multiple rows
        correctedReqs.forEach((reqText: string, idx: number) => {
          const splitId = `${row.req_id || ''}.${idx + 1}`;
          const inputReq = idx === 0 ? `"${(row.input_req || '').replace(/"/g, '""')}"` : '""';
          const status = idx === 0 ? row.status || '' : '""';
          const rule = idx === 0 ? row.failed_rule || 'N/A' : '""';
          const rationale = idx === 0 ? `"${(row.rationale || '').replace(/"/g, '""')}"` : '""';
          
          const line = [
            splitId,
            inputReq,
            status,
            rule,
            rationale,
            `"${reqText.replace(/"/g, '""')}"`
          ].join(",");
          csvContent += line + "\n";
        });
      } else {
        // Single row
        const line = [
          row.req_id || '',
          `"${(row.input_req || '').replace(/"/g, '""')}"`,
          row.status || '',
          row.failed_rule || 'N/A',
          `"${(row.rationale || '').replace(/"/g, '""')}"`,
          `"${(row.corrected_req || '').replace(/"/g, '""')}"`
        ].join(",");
        csvContent += line + "\n";
      }
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AIRAM_Run_${this.activeRunId.substring(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  hasCorrections(): boolean {
    if (!this.filteredResults || this.filteredResults.length === 0) return false;
    return this.filteredResults.some(row => row.corrected_req && row.corrected_req !== '-' && row.corrected_req.trim() !== '');
  }

  hasTraceCorrections(): boolean {
    if (!this.filteredResults || this.filteredResults.length === 0) return false;
    return this.filteredResults.some(row => row.corrected_req && row.corrected_req !== '-' && row.corrected_req.trim() !== '');
  }

  splitCorrectedReq(text: string): string[] {
    if (!text || text === '-' || !text.trim()) return [];
    return text
      .split(/\r?\n/)
      .map(t => t.trim().replace(/^[\d+\.\•\-\*]+\s*/, ''))
      .filter(t => t.length > 0);
  }

  // Pagination & Reset Methods
  getTotalPages(): number {
    return Math.ceil(this.filteredResults.length / this.pageSize) || 1;
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
      this.cdr.detectChanges();
    }
  }

  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }



  clearResults() {
    this.stopPolling();
    this.results = [];
    this.activeRunId = '';
    this.runStatus = '';
    this.isRunning = false;
    this.isPaused = false;
    this.isFinished = false;
    this.currentRow = 0;
    this.totalRows = 0;
    this.currentPage = 1;
    this.cdr.detectChanges();
  }
}
