import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="projects-container" style="padding: 24px; max-width: 1300px; margin: 0 auto; height: calc(100vh - 64px); display: flex; gap: 24px;">
      
      <!-- Left Sidebar: Project List -->
      <div class="sidebar card" style="width: 320px; flex-shrink: 0; padding: 0; display: flex; flex-direction: column; background: #fff;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">Available Projects</span>
          <button class="icon-btn-primary" (click)="openUploadModal()" title="New Project" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: 1.2rem; font-weight: 600;">
            +
          </button>
        </div>
        
        <div class="project-list" style="overflow-y: auto; flex: 1;">
          <div *ngIf="projects.length === 0" style="padding: 32px 20px; text-align: center; color: var(--text-secondary); font-size: 0.85rem;">
            No projects found. Click + to create one.
          </div>
          
          <div *ngFor="let p of projects" 
               class="project-item" 
               [class.active]="selectedProject?.id === p.id"
               (click)="selectProject(p)"
               style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 180px;">{{ p.name }}</div>
              <span class="badge" style="font-size: 0.6rem; padding: 2px 6px; background-color: #dcfce7; color: #166534; font-weight: 700; letter-spacing: 0.05em; border-radius: 4px;">ACTIVE</span>
            </div>
            <div *ngIf="p.description" style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">{{ p.description }}</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">Updated: {{ p.created_at | date:'MMM d, y, h:mm a' }}</div>
          </div>
        </div>
      </div>

      <!-- Right Main Area -->
      <div class="main-content" style="flex: 1; display: flex; flex-direction: column; gap: 24px; min-width: 0;">
        <ng-container *ngIf="selectedProject; else noSelection">
          
          <!-- Top Header Card -->
          <div class="card" style="padding: 24px; background: #fff; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; gap: 12px; margin-bottom: 12px; align-items: center;">
              <span class="badge" style="background: #f1f5f9; color: #64748b; font-family: monospace; font-size: 0.75rem; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 4px;">PRJ-{{ selectedProject.id }}</span>
              <span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.7rem; display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px;">
                <div style="width: 6px; height: 6px; background: #16a34a; border-radius: 50%;"></div>
                Analysis Active
              </span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h1 style="margin: 0 0 8px 0; font-size: 1.6rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">{{ selectedProject.name }}</h1>
                <p style="margin: 0; font-size: 0.95rem; color: var(--text-secondary); max-width: 600px; line-height: 1.5;">{{ selectedProject.description || 'Comprehensive analysis and traceability matrix for this project. Tracking functional requirements against system architecture constraints.' }}</p>
              </div>
              
              <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.85rem; padding: 8px 16px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export Report
                </button>
                <button class="btn btn-primary" (click)="openUploadModal()" style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.85rem; padding: 8px 16px;">
                  <span style="font-size: 1.1rem; line-height: 1;">+</span>
                  New Document
                </button>
              </div>
            </div>
          </div>
          
          <!-- Tabs & Content Card -->
          <div class="card" style="padding: 0; flex: 1; display: flex; flex-direction: column; background: #fff; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
            
            <!-- Tabs Nav -->
            <div style="padding: 0 24px; border-bottom: 1px solid var(--border-color); background: #f8fafc;">
              <div class="tabs-nav" style="display: flex; gap: 32px; margin-top: 8px;">
                <button class="tab-btn" [class.active]="activeTab === 'overview'" (click)="activeTab = 'overview'">Overview</button>
                <button class="tab-btn" [class.active]="activeTab === 'swe1'" (click)="activeTab = 'swe1'">SWE.1 Requirements ({{reqs.swe1.length}})</button>
                <button class="tab-btn" [class.active]="activeTab === 'swe2'" (click)="activeTab = 'swe2'">SWE.2 Requirements ({{reqs.swe2.length}})</button>
                <button class="tab-btn" [class.active]="activeTab === 'trace'" (click)="activeTab = 'trace'">Traceability</button>
              </div>
            </div>
            
            <!-- Tab Content -->
            <div style="flex: 1; overflow-y: auto; background: #fff;">
              
              <!-- Overview Tab -->
              <div *ngIf="activeTab === 'overview'" style="padding: 32px;">
                <h3 style="margin: 0 0 24px 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Recent Requirement Documents</h3>
                
                <div *ngIf="isLoadingReqs" style="color: var(--text-secondary); text-align: center; padding: 40px;">
                  <div class="spinner" style="margin-bottom: 16px;"></div>
                  <div>Loading documents...</div>
                </div>

                <div *ngIf="!isLoadingReqs" style="display: flex; gap: 24px; flex-wrap: wrap;">
                  <!-- SWE 1 Card -->
                  <div class="document-card" *ngIf="reqs.swe1.length > 0" style="width: 320px; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
                      <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <div>
                          <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">SWE.1 Requirements</div>
                          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">System / HLR</div>
                        </div>
                      </div>
                      <span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">ANALYZED</span>
                    </div>
                    
                    <div style="display: flex; gap: 24px; margin-bottom: 24px;">
                      <div>
                        <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">{{ reqs.swe1.length }}</div>
                      </div>
                      <div>
                        <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Conflicts</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">0</div>
                      </div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 16px; display: flex; justify-content: space-between; align-items: center;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; color: #64748b;">
                          S
                        </div>
                        <div>
                          <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary);">System</div>
                          <div style="font-size: 0.65rem; color: var(--text-secondary);">Extracted dataset</div>
                        </div>
                      </div>
                      <button class="btn btn-secondary btn-sm" (click)="activeTab = 'swe1'" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0;">
                        View Details →
                      </button>
                    </div>
                  </div>
                  
                  <!-- SWE 2 Card -->
                  <div class="document-card" *ngIf="reqs.swe2.length > 0" style="width: 320px; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #fffbeb);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
                      <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <div>
                          <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">SWE.2 Requirements</div>
                          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Software / LLR</div>
                        </div>
                      </div>
                      <span class="badge" style="background: #fef3c7; color: #b45309; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">ANALYZING</span>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">
                        <span>Processing Dataset...</span>
                        <span>100%</span>
                      </div>
                      <div style="height: 6px; background: #fde68a; border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: 100%; background: #f59e0b; border-radius: 3px;"></div>
                      </div>
                    </div>
                    
                    <div style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 16px; display: flex; justify-content: space-between; align-items: center;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; color: #64748b;">
                          S
                        </div>
                        <div>
                          <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary);">System</div>
                          <div style="font-size: 0.65rem; color: var(--text-secondary);">Extracted dataset</div>
                        </div>
                      </div>
                      <button class="btn btn-secondary btn-sm" (click)="activeTab = 'swe2'" style="border: none; background: none; color: var(--text-secondary); font-weight: 600; padding: 0;">
                        View Details
                      </button>
                    </div>
                  </div>
                  
                  <div *ngIf="reqs.swe1.length === 0 && reqs.swe2.length === 0" style="color: var(--text-secondary); font-size: 0.9rem;">
                    No requirements extracted for this project.
                  </div>
                </div>
              </div>
              
              <!-- Requirement Lists (SWE1 & SWE2) -->
              <div *ngIf="activeTab === 'swe1' || activeTab === 'swe2'" style="padding: 0;">
                <div *ngIf="isLoadingReqs" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                  Loading requirements...
                </div>
                
                <div *ngIf="!isLoadingReqs" class="table-container" style="border: none; border-radius: 0; margin: 0; box-shadow: none;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: #f8fafc; border-bottom: 1px solid var(--border-color);">
                        <th style="width: 15%; padding: 16px 24px; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">ID</th>
                        <th style="padding: 16px 24px; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Requirement Text</th>
                        <th style="width: 15%; padding: 16px 24px; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ng-container *ngIf="activeTab === 'swe1'">
                        <tr *ngFor="let r of reqs.swe1" style="border-bottom: 1px solid var(--border-color);">
                          <td style="padding: 16px 24px; font-weight: 600; color: var(--color-primary); white-space: nowrap; vertical-align: top;">{{ r.id }}</td>
                          <td style="padding: 16px 24px; color: var(--text-primary); vertical-align: top;">{{ r.text }}</td>
                          <td style="padding: 16px 24px; vertical-align: top;">
                            <span *ngIf="r.analysis?.status === 'PASS'" class="badge" style="background: #dcfce7; color: #16a34a; font-size: 0.7rem;">PASS</span>
                            <span *ngIf="r.analysis?.status === 'FAIL'" class="badge" style="background: #fee2e2; color: #dc2626; font-size: 0.7rem;">FAIL</span>
                            <span *ngIf="r.analysis?.status === 'REVIEW'" class="badge" style="background: #fef3c7; color: #d97706; font-size: 0.7rem;">REVIEW</span>
                            <span *ngIf="!r.analysis?.status" class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.7rem;">UNTESTED</span>
                          </td>
                        </tr>
                        <tr *ngIf="reqs.swe1.length === 0">
                          <td colspan="3" style="text-align: center; padding: 40px; color: var(--text-secondary);">No SWE.1 requirements found.</td>
                        </tr>
                      </ng-container>
                      <ng-container *ngIf="activeTab === 'swe2'">
                        <tr *ngFor="let r of reqs.swe2" style="border-bottom: 1px solid var(--border-color);">
                          <td style="padding: 16px 24px; font-weight: 600; color: var(--color-primary); white-space: nowrap; vertical-align: top;">{{ r.id }}</td>
                          <td style="padding: 16px 24px; color: var(--text-primary); vertical-align: top;">{{ r.text }}</td>
                          <td style="padding: 16px 24px; vertical-align: top;">
                            <span *ngIf="r.analysis?.status === 'PASS'" class="badge" style="background: #dcfce7; color: #16a34a; font-size: 0.7rem;">PASS</span>
                            <span *ngIf="r.analysis?.status === 'FAIL'" class="badge" style="background: #fee2e2; color: #dc2626; font-size: 0.7rem;">FAIL</span>
                            <span *ngIf="r.analysis?.status === 'REVIEW'" class="badge" style="background: #fef3c7; color: #d97706; font-size: 0.7rem;">REVIEW</span>
                            <span *ngIf="!r.analysis?.status" class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.7rem;">UNTESTED</span>
                          </td>
                        </tr>
                        <tr *ngIf="reqs.swe2.length === 0">
                          <td colspan="3" style="text-align: center; padding: 40px; color: var(--text-secondary);">No SWE.2 requirements found.</td>
                        </tr>
                      </ng-container>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Traceability Tab (Mock content) -->
              <div *ngIf="activeTab === 'trace'" style="padding: 32px; text-align: center; color: var(--text-secondary);">
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                 <h3 style="margin: 0 0 8px 0; color: var(--text-primary);">Traceability Matrix</h3>
                 <p style="margin: 0; font-size: 0.9rem;">The Traceability mapping graph will be generated here during Analysis.</p>
              </div>

            </div>
          </div>
        </ng-container>
        
        <ng-template #noSelection>
          <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); background: #fff; padding: 40px; border: 1px dashed var(--border-color); box-shadow: none;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-primary);">No Project Selected</h3>
            <p style="margin: 0 0 16px 0; font-size: 0.9rem;">Select a project from the sidebar to view its details and requirements.</p>
            <button class="btn btn-primary" (click)="openUploadModal()" style="margin-top: 16px;">
              Create Project
            </button>
          </div>
        </ng-template>
      </div>
    </div>

    <!-- Upload Modal -->
    <div class="modal-backdrop" *ngIf="showUploadModal">
      <div class="modal-card" style="max-width: 600px;">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0;">Upload New Project</h3>
          <button type="button" class="modal-close" (click)="closeUploadModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Project Name <span style="color: var(--color-danger);">*</span></label>
            <input type="text" [(ngModel)]="newProject.name" placeholder="e.g. BCM Requirements v2.1" style="width: 100%;">
          </div>
          <div class="form-group" style="margin-top: 16px;">
            <label class="form-label">Description (Optional)</label>
            <textarea [(ngModel)]="newProject.description" placeholder="Brief description of this project..." rows="3" style="width: 100%; resize: vertical; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; font-family: inherit; font-size: 0.9rem;"></textarea>
          </div>
          
          <div style="display: flex; gap: 16px; margin-top: 20px;">
            <!-- SWE.1 Upload -->
            <div style="flex: 1;">
              <label class="form-label">SWE 1 / HLR Document <span style="color: var(--color-danger);">*</span></label>
              <div class="dropzone" [class.has-file]="newProject.swe1File" style="height: 100px; padding: 16px; position: relative;" (click)="swe1Input.click()">
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.8rem; text-align: center; word-break: break-all;">
                    {{ newProject.swe1File ? newProject.swe1File.name : 'Click to upload CSV/XLSX' }}
                  </div>
                </div>
                <input #swe1Input type="file" (change)="onFileSelected($event, 'swe1')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>
            
            <!-- SWE.2 Upload -->
            <div style="flex: 1;">
              <label class="form-label">SWE 2 / LLR Document <span style="font-weight: normal; color: var(--text-secondary);">(Optional)</span></label>
              <div class="dropzone" [class.has-file]="newProject.swe2File" style="height: 100px; padding: 16px; position: relative;" (click)="swe2Input.click()">
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.8rem; text-align: center; word-break: break-all;">
                    {{ newProject.swe2File ? newProject.swe2File.name : 'Click to upload CSV/XLSX' }}
                  </div>
                </div>
                <input #swe2Input type="file" (change)="onFileSelected($event, 'swe2')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>
          </div>
          <div *ngIf="uploadedStatus" class="alert alert-success" style="margin-top: 16px; padding: 12px; background: #e6f4ea; color: var(--color-success); border-radius: 6px; font-size: 0.85rem;">
            {{ uploadedStatus }}
          </div>
          <div *ngIf="uploadError" class="alert alert-danger" style="margin-top: 16px; padding: 12px; background: #fee2e2; color: #ef4444; border-radius: 6px; font-size: 0.85rem;">
            {{ uploadError }}
          </div>
          
          <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
            <button class="btn btn-secondary" (click)="closeUploadModal()" [disabled]="isUploading">{{ uploadedStatus ? 'Close' : 'Cancel' }}</button>
            <button class="btn btn-primary" (click)="uploadProject()" [disabled]="isUploading || !newProject.name || !newProject.swe1File">
              {{ isUploading ? 'Uploading...' : 'Create Project' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .project-item:hover {
      background-color: #f8fafc;
    }
    .project-item.active {
      background-color: #f1f5f9;
      border-left: 3px solid var(--color-primary);
    }
    
    .tabs-nav {
      display: flex;
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
    
    .document-card {
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .document-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05) !important;
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      backdrop-filter: blur(4px);
    }
    .modal-card {
      background: #ffffff;
      border-radius: 12px;
      width: 500px;
      max-width: 90vw;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 1.2rem;
      padding: 4px;
      transition: color 0.2s;
    }
    .modal-close:hover {
      color: var(--text-primary);
    }
    .modal-body {
      padding: 24px;
    }
    
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class ProjectsComponent implements OnInit {
  projects: any[] = [];
  selectedProject: any = null;
  
  reqs = {
    swe1: [] as any[],
    swe2: [] as any[]
  };
  isLoadingReqs = false;
  activeTab: 'overview' | 'swe1' | 'swe2' | 'trace' = 'overview';
  
  showUploadModal = false;
  isUploading = false;
  
  newProject = {
    name: '',
    description: '',
    swe1File: null as File | null,
    swe2File: null as File | null
  };
  
  uploadedStatus: string = '';
  uploadError: string = '';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.apiService.getProjects().subscribe({
      next: (res) => {
        this.projects = res;
      },
      error: (err) => {
        console.error("Failed to load projects", err);
      }
    });
  }

  selectProject(project: any) {
    this.selectedProject = project;
    this.isLoadingReqs = true;
    this.activeTab = 'overview';
    this.reqs = { swe1: [], swe2: [] };
    
    this.apiService.getProjectRequirements(project.id).subscribe({
      next: (res) => {
        this.reqs = res;
        this.isLoadingReqs = false;
      },
      error: (err) => {
        console.error("Failed to load project requirements", err);
        this.isLoadingReqs = false;
      }
    });
  }

  openUploadModal() {
    this.newProject = { name: '', description: '', swe1File: null, swe2File: null };
    this.uploadedStatus = '';
    this.uploadError = '';
    this.showUploadModal = true;
  }
  
  closeUploadModal() {
    if (!this.isUploading) {
      this.showUploadModal = false;
      this.uploadedStatus = '';
      this.uploadError = '';
    }
  }

  onFileSelected(event: any, type: 'swe1' | 'swe2') {
    const file = event.target.files[0];
    if (file) {
      if (type === 'swe1') {
        this.newProject.swe1File = file;
        if (!this.newProject.name) {
          this.newProject.name = file.name.replace(/\.[^/.]+$/, '');
        }
      } else {
        this.newProject.swe2File = file;
      }
    }
  }

  uploadProject() {
    if (!this.newProject.name || !this.newProject.swe1File) return;
    
    this.isUploading = true;
    this.uploadedStatus = '';
    this.uploadError = '';
    
    this.apiService.createProject(
      this.newProject.name,
      this.newProject.description,
      this.newProject.swe1File,
      this.newProject.swe2File || undefined
    ).subscribe({
      next: (res) => {
        this.isUploading = false;
        this.uploadedStatus = `Successfully created project '${this.newProject.name}'!`;
        this.loadProjects();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isUploading = false;
        this.uploadError = 'Upload failed: ' + (err.error?.detail || err.message);
        this.cdr.detectChanges();
      }
    });
  }
}

