import { Component, OnInit, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="projects-container" (document:keydown.escape)="exitFullscreen()" [style.max-width]="isFullscreen ? '100%' : '1300px'" style="padding: 16px; margin: 0 auto; height: calc(100vh - 64px); display: flex; gap: 16px;">
      
      <!-- Left Sidebar: Project List -->
      <div class="sidebar card" *ngIf="!isFullscreen" style="width: 260px; flex-shrink: 0; padding: 0; display: flex; flex-direction: column; background: #fff;">
        <div style="padding: 12px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">Available Projects</span>
          <button class="icon-btn-primary" (click)="openUploadModal()" title="New Project" style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: 1.05rem; font-weight: 600;">
            +
          </button>
        </div>
        
        <div class="project-list" style="overflow-y: auto; flex: 1;">
          <div *ngIf="projects.length === 0" style="padding: 24px 14px; text-align: center; color: var(--text-secondary); font-size: 0.78rem;">
            No projects found. Click + to create one.
          </div>
          
          <div *ngFor="let p of projects" 
               class="project-item" 
               [class.active]="selectedProject?.id === p.id"
               (click)="selectProject(p)"
               style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px;">
              <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 130px;" [title]="p.name">{{ p.name }}</div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <button (click)="openEditModal(p, $event)" title="Edit Project Details" style="padding: 2px 4px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-secondary); cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; transition: all 0.2s;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <span class="badge" style="font-size: 0.55rem; padding: 2px 5px; background-color: #dcfce7; color: #166534; font-weight: 700; letter-spacing: 0.05em; border-radius: 4px;">ACTIVE</span>
              </div>
            </div>
            <div *ngIf="p.description" style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">{{ p.description }}</div>
            <div style="font-size: 0.65rem; color: var(--text-secondary);">Updated: {{ p.created_at | date:'MMM d, y, h:mm a' }}</div>
          </div>
        </div>
      </div>

      <!-- Right Main Area -->
      <div class="main-content" style="flex: 1; display: flex; flex-direction: column; gap: 16px; min-width: 0;">
        <ng-container *ngIf="selectedProject; else noSelection">
          
          <!-- Top Header Card -->
          <div class="card" style="padding: 24px; background: #fff; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 0;">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
              <div>
                <h1 style="margin: 0 0 12px 0; font-size: 1.4rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em;">{{ selectedProject.name }}</h1>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); max-width: 650px; line-height: 1.6;">{{ selectedProject.description || 'Comprehensive analysis and traceability matrix for this project. Tracking functional requirements against system architecture constraints.' }}</p>
              </div>
              
              <div style="display: flex; gap: 12px; align-items: center;">
                <button class="btn btn-secondary" (click)="openEditModal(selectedProject)" style="display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.8rem; padding: 8px 16px; border: 1px solid var(--border-color); background: #fff; border-radius: 6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit Details
                </button>
                <button class="btn btn-secondary" style="display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.8rem; padding: 8px 16px; border: 1px solid var(--border-color); background: #fff; border-radius: 6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export Report
                </button>
                <button class="btn btn-primary" (click)="openAppendModal()" title="Share / Upload" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border-radius: 6px; background-color: #2563eb; color: white; border: none;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                </button>
                <button class="btn btn-danger" (click)="deleteProject(selectedProject)" style="display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.8rem; padding: 8px 16px; background-color: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Delete Project
                </button>
              </div>
            </div>

            <!-- Metadata Bar -->
            <div style="display: flex; gap: 32px; border-top: 1px solid var(--border-color); padding-top: 16px;">
              
              <!-- Created -->
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Created
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                  {{ selectedProject.created_at | date:'MMM d, yyyy' }}
                </div>
              </div>
              
              <div style="width: 1px; background-color: var(--border-color);"></div>

              <!-- Last Updated -->
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Last Updated
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                  {{ selectedProject.created_at | date:'MMM d, yyyy, h:mm a' }}
                </div>
              </div>

              <div style="width: 1px; background-color: var(--border-color);"></div>

              <!-- Documents -->
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Documents
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                  {{ (reqs.sys1?.length ? 1 : 0) + (reqs.sys2?.length ? 1 : 0) + (reqs.sys3?.length ? 1 : 0) + (reqs.swe1?.length ? 1 : 0) + (reqs.swe2?.length ? 1 : 0) }}
                </div>
              </div>

              <div style="width: 1px; background-color: var(--border-color);"></div>

              <!-- Total Requirements -->
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.75rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  Total Requirements
                </div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                  {{ (reqs.sys1?.length || 0) + (reqs.sys2?.length || 0) + (reqs.sys3?.length || 0) + (reqs.swe1?.length || 0) + (reqs.swe2?.length || 0) }}
                </div>
              </div>

            </div>
          </div>
          
          <!-- Tabs & Content Card -->
          <div class="card" style="padding: 0; flex: 1; display: flex; flex-direction: column; background: #fff; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
            
            <!-- Tabs Nav -->
            <div style="padding: 0 16px; border-bottom: 1px solid var(--border-color); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
              <div class="tabs-nav" style="display: flex; gap: 16px; margin-top: 6px; overflow-x: auto;">
                <button class="tab-btn" [class.active]="activeTab === 'overview'" (click)="activeTab = 'overview'">Overview</button>
                <button class="tab-btn" [class.active]="activeTab === 'sys1'" (click)="activeTab = 'sys1'">SYS.1 Reqs ({{reqs.sys1?.length || 0}})</button>
                <button class="tab-btn" [class.active]="activeTab === 'sys2'" (click)="activeTab = 'sys2'">SYS.2 Reqs ({{reqs.sys2?.length || 0}})</button>
                <button class="tab-btn" [class.active]="activeTab === 'sys3'" (click)="activeTab = 'sys3'">SYS.3 Reqs ({{reqs.sys3?.length || 0}})</button>
                <button class="tab-btn" [class.active]="activeTab === 'swe1'" (click)="activeTab = 'swe1'">SWE.1 Reqs ({{reqs.swe1?.length || 0}})</button>
                <button class="tab-btn" [class.active]="activeTab === 'swe2'" (click)="activeTab = 'swe2'">SWE.2 Reqs ({{reqs.swe2?.length || 0}})</button>
                <button class="tab-btn" [class.active]="activeTab === 'trace'" (click)="activeTab = 'trace'">Traceability</button>
              </div>

              <!-- Fullscreen Button -->
              <button class="icon-btn-primary" (click)="toggleFullscreen()" title="Toggle Fullscreen" style="background: none; border: none; color: #2563eb; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; margin-left: 16px;">
                <svg *ngIf="!isFullscreen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                <svg *ngIf="isFullscreen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>
              </button>
            </div>
            
            <!-- Tab Content -->
            <div style="flex: 1; overflow-y: auto; background: #fff;">
              
              <!-- Overview Tab -->
              <div *ngIf="activeTab === 'overview'" style="padding: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Recent Requirement Documents</h3>
                
                <div *ngIf="isLoadingReqs" style="color: var(--text-secondary); text-align: center; padding: 32px;">
                  <div class="spinner" style="margin-bottom: 12px;"></div>
                  <div>Loading documents...</div>
                </div>

                <div *ngIf="!isLoadingReqs" style="display: flex; gap: 16px; flex-wrap: wrap;">
                  <!-- SYS 1 Card -->
                  <div class="document-card" *ngIf="reqs.sys1 && reqs.sys1.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #f0fdf4);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                      <div style="display: flex; gap: 9px; align-items: flex-start;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <div>
                          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SYS.1 Requirements</div>
                          <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">Requirements Elicitation</div>
                        </div>
                      </div>
                      <span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.58rem; font-weight: 700; padding: 2px 5px; border-radius: 4px;">MANDATORY</span>
                    </div>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                      <div>
                        <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ reqs.sys1.length }}</div>
                      </div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 0.68rem; color: var(--text-secondary);">System Level 1</span>
                      <button class="btn btn-secondary btn-sm" (click)="activeTab = 'sys1'" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                        View Details →
                      </button>
                    </div>
                  </div>

                  <!-- SYS 2 Card -->
                  <div class="document-card" *ngIf="reqs.sys2 && reqs.sys2.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #eff6ff);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                      <div style="display: flex; gap: 9px; align-items: flex-start;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                        <div>
                          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SYS.2 Requirements</div>
                          <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">System Req Analysis</div>
                        </div>
                      </div>
                      <span class="badge" style="background: #dbeafe; color: #1e40af; font-size: 0.58rem; font-weight: 700; padding: 2px 5px; border-radius: 4px;">OPTIONAL</span>
                    </div>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                      <div>
                        <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ reqs.sys2.length }}</div>
                      </div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 0.68rem; color: var(--text-secondary);">System Level 2</span>
                      <button class="btn btn-secondary btn-sm" (click)="activeTab = 'sys2'" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                        View Details →
                      </button>
                    </div>
                  </div>

                  <!-- SYS 3 Card -->
                  <div class="document-card" *ngIf="reqs.sys3 && reqs.sys3.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #faf5ff);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                      <div style="display: flex; gap: 9px; align-items: flex-start;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                        <div>
                          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SYS.3 Requirements</div>
                          <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">System Arch Design</div>
                        </div>
                      </div>
                      <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-size: 0.58rem; font-weight: 700; padding: 2px 5px; border-radius: 4px;">OPTIONAL</span>
                    </div>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                      <div>
                        <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ reqs.sys3.length }}</div>
                      </div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 0.68rem; color: var(--text-secondary);">System Level 3</span>
                      <button class="btn btn-secondary btn-sm" (click)="activeTab = 'sys3'" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                        View Details →
                      </button>
                    </div>
                  </div>
                  
                  <!-- SWE 1 Card -->
                  <div class="document-card" *ngIf="reqs.swe1 && reqs.swe1.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                      <div style="display: flex; gap: 9px; align-items: flex-start;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                        <div>
                          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SWE.1 Requirements</div>
                          <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">Software Req Analysis</div>
                        </div>
                      </div>
                      <span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 0.58rem; font-weight: 700; padding: 2px 5px; border-radius: 4px;">SOFTWARE</span>
                    </div>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                      <div>
                        <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ reqs.swe1.length }}</div>
                      </div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 0.68rem; color: var(--text-secondary);">Software Level 1</span>
                      <button class="btn btn-secondary btn-sm" (click)="activeTab = 'swe1'" style="border: none; background: none; color: var(--color-primary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                        View Details →
                      </button>
                    </div>
                  </div>
                  
                  <!-- SWE 2 Card -->
                  <div class="document-card" *ngIf="reqs.swe2 && reqs.swe2.length > 0" style="width: 240px; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); background: linear-gradient(to bottom right, #ffffff, #fffbeb);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                      <div style="display: flex; gap: 9px; align-items: flex-start;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
                        <div>
                          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">SWE.2 Requirements</div>
                          <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">Software Arch Design</div>
                        </div>
                      </div>
                      <span class="badge" style="background: #fef3c7; color: #b45309; font-size: 0.58rem; font-weight: 700; padding: 2px 5px; border-radius: 4px;">SOFTWARE</span>
                    </div>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 14px;">
                      <div>
                        <div style="font-size: 0.58rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total Reqs</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">{{ reqs.swe2.length }}</div>
                      </div>
                    </div>
                    
                    <div style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 0.68rem; color: var(--text-secondary);">Software Level 2</span>
                      <button class="btn btn-secondary btn-sm" (click)="activeTab = 'swe2'" style="border: none; background: none; color: var(--text-secondary); font-weight: 600; padding: 0; font-size: 0.75rem;">
                        View Details →
                      </button>
                    </div>
                  </div>
                  
                  <div *ngIf="(!reqs.sys1 || reqs.sys1.length === 0) && (!reqs.sys2 || reqs.sys2.length === 0) && (!reqs.sys3 || reqs.sys3.length === 0) && (!reqs.swe1 || reqs.swe1.length === 0) && (!reqs.swe2 || reqs.swe2.length === 0)" style="color: var(--text-secondary); font-size: 0.85rem;">
                    No requirements extracted for this project.
                  </div>
                </div>
              </div>
              
              <!-- Requirement Lists (SYS1, SYS2, SYS3, SWE1, SWE2) -->
              <div *ngIf="activeTab === 'sys1' || activeTab === 'sys2' || activeTab === 'sys3' || activeTab === 'swe1' || activeTab === 'swe2'" style="padding: 0;">
                <div *ngIf="isLoadingReqs" style="padding: 32px; text-align: center; color: var(--text-secondary);">
                  Loading requirements...
                </div>
                
                <div *ngIf="!isLoadingReqs" class="table-container" style="border: none; border-radius: 0; margin: 0; box-shadow: none;">
                  
                  <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: #fff;">
                    <div style="position: relative; width: 240px;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 10px; top: 8px; color: var(--text-secondary);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      <input type="text" placeholder="Search requirements..." style="width: 100%; padding: 6px 10px 6px 30px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.75rem; background: #fff;">
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button *ngIf="selectedReqs.size > 0" class="btn btn-outline-danger" (click)="deleteSelectedReqs()" [disabled]="isDeletingReqs" style="padding: 5px 10px; font-size: 0.75rem; border-radius: 6px; display: flex; align-items: center; gap: 5px; color: #dc2626; border-color: #dc2626; background: #fff;">
                        <span *ngIf="isDeletingReqs" class="spinner" style="width: 10px; height: 10px; border-width: 2px; border-top-color: #dc2626;"></span>
                        <svg *ngIf="!isDeletingReqs" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Delete
                      </button>
                      <button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.75rem; background: #fff; display: flex; align-items: center; gap: 5px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        Filters
                      </button>
                    </div>
                  </div>

                  <table style="width: 100%; border-collapse: collapse; background: #fff; font-size: 0.8rem;">
                    <thead>
                      <tr style="background: #fff; border-bottom: 1px solid #e2e8f0;">
                        <th style="width: 36px; padding: 8px 10px; color: var(--text-secondary);">
                          <input type="checkbox" style="border-radius: 4px; border: 1px solid #cbd5e1;" [checked]="isAllSelected()" (change)="toggleAllReqs($event)">
                        </th>
                        <th style="width: 10%; padding: 8px 10px; color: var(--text-secondary); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">ID ↕</th>
                        <th style="padding: 8px 10px; color: var(--text-secondary); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Requirement Text</th>
                        <th style="width: 12%; padding: 8px 10px; color: var(--text-secondary); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Status ↕</th>
                        <th style="width: 15%; padding: 8px 10px; color: var(--text-secondary); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Source</th>
                        <th style="width: 15%; padding: 8px 10px; color: var(--text-secondary); font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Last Updated ↕</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let r of reqs[activeTab] || []" style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 10px; vertical-align: middle;">
                          <input type="checkbox" style="border-radius: 4px; border: 1px solid #cbd5e1;" [checked]="selectedReqs.has(r.id)" (change)="toggleReqSelection(r.id)">
                        </td>
                        <td style="padding: 10px; font-weight: 600; color: var(--color-primary); white-space: nowrap; vertical-align: middle; font-size: 0.75rem;">{{ r.id }}</td>
                        <td style="padding: 10px; color: #334155; vertical-align: middle; font-size: 0.8rem; line-height: 1.5;" class="req-text-cell">
                          <div *ngIf="editingReqId !== r.id" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; width: 100%;">
                            <span>{{ r.text }}</span>
                            <button class="edit-btn" (click)="startEditReq(r)" title="Edit Requirement" style="background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 4px; opacity: 0; transition: opacity 0.2s;">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                          </div>
                          <div *ngIf="editingReqId === r.id" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                            <textarea [(ngModel)]="tempReqText" rows="3" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.8rem; font-family: inherit; resize: vertical;"></textarea>
                            <div style="display: flex; gap: 6px; justify-content: flex-end;">
                              <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.7rem;" (click)="cancelEditReq()" [disabled]="isSavingReqEdit">Cancel</button>
                              <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.7rem;" (click)="saveInlineReq(r)" [disabled]="isSavingReqEdit || !tempReqText.trim()">
                                {{ isSavingReqEdit ? 'Saving...' : 'Save' }}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td style="padding: 10px; vertical-align: middle;">
                          <span *ngIf="r.analysis?.status === 'PASS'" class="badge" style="background: #dcfce7; color: #16a34a; font-size: 0.6rem; padding: 3px 8px; font-weight: 700; border-radius: 12px;">PASS</span>
                          <span *ngIf="r.analysis?.status === 'FAIL'" class="badge" style="background: #fee2e2; color: #dc2626; font-size: 0.6rem; padding: 3px 8px; font-weight: 700; border-radius: 12px;">FAIL</span>
                          <span *ngIf="r.analysis?.status === 'REVIEW'" class="badge" style="background: #fef3c7; color: #d97706; font-size: 0.6rem; padding: 3px 8px; font-weight: 700; border-radius: 12px;">REVIEW</span>
                          <span *ngIf="!r.analysis?.status" class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.6rem; padding: 3px 8px; font-weight: 700; border-radius: 12px;">UNTESTED</span>
                        </td>
                        <td style="padding: 10px; vertical-align: middle; color: var(--text-secondary); font-size: 0.75rem;">
                          System_Reqs_v1.2.docx
                        </td>
                        <td style="padding: 10px; vertical-align: middle;">
                          <div style="font-size: 0.75rem; color: #475569;">Jul 22, 2026</div>
                          <div style="font-size: 0.65rem; color: var(--text-secondary);">12:50 AM</div>
                        </td>
                      </tr>
                      <tr *ngIf="!reqs[activeTab] || reqs[activeTab].length === 0">
                        <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-secondary); background: #fff;">
                          No requirements found for this section.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div style="padding: 12px 16px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #fff;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">
                      Showing {{ reqs[activeTab]?.length ? 1 : 0 }} to {{ reqs[activeTab]?.length || 0 }} of {{ reqs[activeTab]?.length || 0 }} requirements
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-outline" style="padding: 3px 9px; border-radius: 4px; background: #fff; font-size: 0.8rem;">&lt;</button>
                      <button class="btn btn-primary" style="padding: 3px 10px; border-radius: 4px; font-size: 0.8rem;">1</button>
                      <button class="btn btn-outline" style="padding: 3px 9px; border-radius: 4px; background: #fff; font-size: 0.8rem;">&gt;</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Traceability Tab -->
              <div *ngIf="activeTab === 'trace'" style="padding: 20px; background: #f8fafc; min-height: 100%;">
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                   <h3 style="margin: 0; color: var(--text-primary); font-size: 0.95rem; font-weight: 600;">Traceability Run History</h3>
                 </div>
                 
                 <div *ngIf="projectHistory.length === 0" style="text-align: center; color: var(--text-secondary); padding: 32px; background: #fff; border: 1px dashed var(--border-color); border-radius: 8px;">
                   <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                   <p style="margin: 0; font-size: 0.82rem;">No traceability runs found for this project. Start an analysis from the Requirements Analysis tab.</p>
                 </div>
                 
                 <div *ngIf="projectHistory.length > 0" style="display: flex; flex-direction: column; gap: 12px;">
                   <div *ngFor="let run of projectHistory" style="background: #fff; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                     <div style="display: flex; gap: 12px; align-items: center;">
                       <span class="badge" style="font-size: 0.58rem; background: #e0f2fe; color: #0284c7; padding: 3px 7px; border-radius: 12px; font-weight: 700;">{{ run.type | uppercase }} RUN</span>
                       <div>
                         <div style="font-weight: 600; color: var(--text-primary); font-size: 0.82rem;">Traceability Mapping Audit</div>
                         <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 3px;">{{ run.timestamp | date:'medium' }}</div>
                       </div>
                     </div>
                     <div style="display: flex; gap: 16px; align-items: center;">
                       <div style="text-align: right;">
                         <div style="font-size: 0.65rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Pass Rate</div>
                         <div style="font-weight: 700; color: var(--color-success); font-size: 0.9rem;">
                           {{ run.total_count ? ((run.pass_count / run.total_count) * 100 | number:'1.0-0') : 0 }}%
                         </div>
                       </div>
                       <div style="text-align: right;">
                         <div style="font-size: 0.65rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Status</div>
                         <span class="badge" [ngStyle]="{'background': run.status === 'completed' ? '#dcfce7' : '#fee2e2', 'color': run.status === 'completed' ? '#166534' : '#991b1b', 'font-size': '0.65rem', 'border-radius': '4px', 'padding': '2px 6px'}">
                           {{ run.status | uppercase }}
                         </span>
                       </div>
                        <button class="btn btn-primary btn-sm" (click)="viewRun.emit(run.run_id)" title="View in details" style="padding: 4px 10px; font-size: 0.7rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                          View Details
                        </button>
                     </div>
                   </div>
                 </div>
               </div>

            </div>
          </div>
        </ng-container>
        
        <ng-template #noSelection>
          <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); background: #fff; padding: 32px; border: 1px dashed var(--border-color); box-shadow: none;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; opacity: 0.5;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <h3 style="margin: 0 0 6px 0; font-size: 0.95rem; color: var(--text-primary);">No Project Selected</h3>
            <p style="margin: 0 0 12px 0; font-size: 0.82rem;">Select a project from the sidebar to view its details and requirements.</p>
            <button class="btn btn-primary" (click)="openUploadModal()" style="margin-top: 12px;">
              Create Project
            </button>
          </div>
        </ng-template>
      </div>
    </div>

    <!-- Upload Modal -->
    <div class="modal-backdrop" *ngIf="showUploadModal">
      <div class="modal-card" style="max-width: 560px;">
        <div class="modal-header">
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0;">Upload New Project</h3>
          <button type="button" class="modal-close" (click)="closeUploadModal()">✕</button>
        </div>
        <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
          <div class="form-group">
            <label class="form-label">Project Name <span style="color: var(--color-danger);">*</span></label>
            <input type="text" [(ngModel)]="newProject.name" placeholder="e.g. ADAS System Requirements v1.0" style="width: 100%;">
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label class="form-label">Description (Optional)</label>
            <textarea [(ngModel)]="newProject.description" placeholder="Brief description of this project..." rows="2" style="width: 100%; resize: vertical; border: 1px solid var(--border-color); border-radius: 6px; padding: 7px 9px; font-family: inherit; font-size: 0.8rem;"></textarea>
          </div>
          
          <!-- Mandatory SYS.1 Section -->
          <div style="margin-top: 14px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
            <label class="form-label" style="color: #166534; font-weight: 700; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
              <span>SYS.1 / Requirements Elicitation <span style="color: var(--color-danger);">* (Mandatory)</span></span>
              <span class="badge" style="background: #166534; color: #fff; font-size: 0.55rem; font-weight: 700; padding: 2px 5px;">MANDATORY</span>
            </label>
            <div class="dropzone" [class.has-file]="newProject.sys1File" style="height: 64px; padding: 10px; position: relative; background: #ffffff;" (click)="sys1Input.click()">
              <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
                <div class="dropzone-text" style="font-size: 0.75rem; text-align: center; word-break: break-all; color: var(--text-primary);">
                  {{ newProject.sys1File ? '📄 ' + newProject.sys1File.name : 'Click to upload SYS.1 CSV/XLSX file' }}
                </div>
              </div>
              <input #sys1Input type="file" (change)="onFileSelected($event, 'sys1')" style="display: none;" accept=".csv,.xlsx">
            </div>
          </div>

          <!-- Optional Requirements Levels -->
          <div style="margin-top: 14px; font-weight: 600; font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
            Optional Requirement Hierarchy Levels
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
            <!-- SYS.2 Upload -->
            <div>
              <label class="form-label" style="font-size: 0.75rem;">SYS.2 / System Req Analysis</label>
              <div class="dropzone" [class.has-file]="newProject.sys2File" style="height: 56px; padding: 8px; position: relative;" (click)="sys2Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ newProject.sys2File ? newProject.sys2File.name : 'Upload SYS.2 CSV/XLSX' }}
                  </div>
                </div>
                <input #sys2Input type="file" (change)="onFileSelected($event, 'sys2')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>

            <!-- SYS.3 Upload -->
            <div>
              <label class="form-label" style="font-size: 0.75rem;">SYS.3 / System Arch Design</label>
              <div class="dropzone" [class.has-file]="newProject.sys3File" style="height: 56px; padding: 8px; position: relative;" (click)="sys3Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ newProject.sys3File ? newProject.sys3File.name : 'Upload SYS.3 CSV/XLSX' }}
                  </div>
                </div>
                <input #sys3Input type="file" (change)="onFileSelected($event, 'sys3')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>

            <!-- SWE.1 Upload -->
            <div>
              <label class="form-label" style="font-size: 0.75rem;">SWE.1 / Software Req Analysis</label>
              <div class="dropzone" [class.has-file]="newProject.swe1File" style="height: 56px; padding: 8px; position: relative;" (click)="swe1Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ newProject.swe1File ? newProject.swe1File.name : 'Upload SWE.1 CSV/XLSX' }}
                  </div>
                </div>
                <input #swe1Input type="file" (change)="onFileSelected($event, 'swe1')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>

            <!-- SWE.2 Upload -->
            <div>
              <label class="form-label" style="font-size: 0.75rem;">SWE.2 / Software Arch Design</label>
              <div class="dropzone" [class.has-file]="newProject.swe2File" style="height: 56px; padding: 8px; position: relative;" (click)="swe2Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ newProject.swe2File ? newProject.swe2File.name : 'Upload SWE.2 CSV/XLSX' }}
                  </div>
                </div>
                <input #swe2Input type="file" (change)="onFileSelected($event, 'swe2')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>
          </div>

          <div *ngIf="uploadedStatus" class="alert alert-success" style="margin-top: 14px; padding: 10px; background: #e6f4ea; color: var(--color-success); border-radius: 6px; font-size: 0.8rem;">
            {{ uploadedStatus }}
          </div>
          <div *ngIf="uploadError" class="alert alert-danger" style="margin-top: 14px; padding: 10px; background: #fee2e2; color: #ef4444; border-radius: 6px; font-size: 0.8rem;">
            {{ uploadError }}
          </div>
          
          <div style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary" (click)="closeUploadModal()" [disabled]="isUploading">{{ uploadedStatus ? 'Close' : 'Cancel' }}</button>
            <button class="btn btn-primary" (click)="uploadProject()" [disabled]="isUploading || !newProject.name || !newProject.sys1File">
              {{ isUploading ? 'Uploading...' : 'Create Project' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Append Documents Modal -->
    <div class="modal-backdrop" *ngIf="showAppendModal">
      <div class="modal-card" style="max-width: 560px;">
        <div class="modal-header">
          <h3 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0;">Append Documents to Project</h3>
          <button type="button" class="modal-close" (click)="closeAppendModal()">✕</button>
        </div>
        <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 12px 0;">
            Upload additional requirement files. New requirements will be appended. Duplicates will be ignored.
          </p>
          
          <div style="margin-top: 14px; padding: 12px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
            <label class="form-label" style="font-weight: 700; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
              <span>SYS.1 / Requirements Elicitation</span>
            </label>
            <div class="dropzone" [class.has-file]="appendData.sys1File" style="height: 64px; padding: 10px; position: relative; background: #ffffff;" (click)="appendSys1Input.click()">
              <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
                <div class="dropzone-text" style="font-size: 0.75rem; text-align: center; word-break: break-all; color: var(--text-primary);">
                  {{ appendData.sys1File ? '📄 ' + appendData.sys1File.name : 'Click to upload SYS.1 CSV/XLSX file' }}
                </div>
              </div>
              <input #appendSys1Input type="file" (change)="onAppendFileSelected($event, 'sys1')" style="display: none;" accept=".csv,.xlsx">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px;">
            <div>
              <label class="form-label" style="font-size: 0.75rem;">SYS.2 / System Req Analysis</label>
              <div class="dropzone" [class.has-file]="appendData.sys2File" style="height: 56px; padding: 8px; position: relative;" (click)="appendSys2Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ appendData.sys2File ? appendData.sys2File.name : 'Upload SYS.2 CSV/XLSX' }}
                  </div>
                </div>
                <input #appendSys2Input type="file" (change)="onAppendFileSelected($event, 'sys2')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>

            <div>
              <label class="form-label" style="font-size: 0.75rem;">SYS.3 / System Arch Design</label>
              <div class="dropzone" [class.has-file]="appendData.sys3File" style="height: 56px; padding: 8px; position: relative;" (click)="appendSys3Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ appendData.sys3File ? appendData.sys3File.name : 'Upload SYS.3 CSV/XLSX' }}
                  </div>
                </div>
                <input #appendSys3Input type="file" (change)="onAppendFileSelected($event, 'sys3')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>

            <div>
              <label class="form-label" style="font-size: 0.75rem;">SWE.1 / Software Req Analysis</label>
              <div class="dropzone" [class.has-file]="appendData.swe1File" style="height: 56px; padding: 8px; position: relative;" (click)="appendSwe1Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ appendData.swe1File ? appendData.swe1File.name : 'Upload SWE.1 CSV/XLSX' }}
                  </div>
                </div>
                <input #appendSwe1Input type="file" (change)="onAppendFileSelected($event, 'swe1')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>

            <div>
              <label class="form-label" style="font-size: 0.75rem;">SWE.2 / Software Arch Design</label>
              <div class="dropzone" [class.has-file]="appendData.swe2File" style="height: 56px; padding: 8px; position: relative;" (click)="appendSwe2Input.click()">
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                  <div class="dropzone-text" style="font-size: 0.7rem; text-align: center; word-break: break-all;">
                    {{ appendData.swe2File ? appendData.swe2File.name : 'Upload SWE.2 CSV/XLSX' }}
                  </div>
                </div>
                <input #appendSwe2Input type="file" (change)="onAppendFileSelected($event, 'swe2')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>
          </div>

          <div *ngIf="appendStatus" class="alert alert-success" style="margin-top: 14px; padding: 10px; background: #e6f4ea; color: var(--color-success); border-radius: 6px; font-size: 0.8rem;">
            {{ appendStatus }}
          </div>
          <div *ngIf="appendError" class="alert alert-danger" style="margin-top: 14px; padding: 10px; background: #fee2e2; color: #ef4444; border-radius: 6px; font-size: 0.8rem;">
            {{ appendError }}
          </div>
          
          <div style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary" (click)="closeAppendModal()" [disabled]="isAppending">{{ appendStatus ? 'Close' : 'Cancel' }}</button>
            <button class="btn btn-primary" (click)="appendProject()" [disabled]="isAppending || (!appendData.sys1File && !appendData.sys2File && !appendData.sys3File && !appendData.swe1File && !appendData.swe2File)">
              <span *ngIf="isAppending" class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></span>
              {{ isAppending ? 'Appending...' : 'Append Documents' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Project Modal -->
    <div *ngIf="showEditModal" class="modal-backdrop">
      <div class="modal-card" style="width: 440px;">
        <div class="modal-header">
          <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Edit Project Details</h3>
          <button class="modal-close" (click)="closeEditModal()">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
          <div *ngIf="editError" style="padding: 8px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; color: #991b1b; font-size: 0.78rem;">
            {{ editError }}
          </div>
          <div>
            <label style="display: block; font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase;">Project Name *</label>
            <input type="text" [(ngModel)]="editProjectData.name" placeholder="Enter project name..." style="width: 100%; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.82rem;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase;">Description</label>
            <textarea [(ngModel)]="editProjectData.description" rows="4" placeholder="Enter project description..." style="width: 100%; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.82rem; resize: vertical;"></textarea>
          </div>
        </div>
        <div style="padding: 12px 16px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; background: #f8fafc; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
          <button class="btn btn-secondary" (click)="closeEditModal()" [disabled]="isSavingEdit">Cancel</button>
          <button class="btn btn-primary" (click)="saveProjectEdit()" [disabled]="isSavingEdit" style="display: flex; align-items: center; gap: 6px;">
            <span *ngIf="isSavingEdit" class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></span>
            {{ isSavingEdit ? 'Saving...' : 'Save Changes' }}
          </button>
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
    
    .req-text-cell:hover .edit-btn {
      opacity: 1 !important;
    }
    
    .tabs-nav {
      display: flex;
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .tabs-nav::-webkit-scrollbar {
      display: none;
    }
    .tab-btn {
      background: transparent;
      border: none;
      padding: 9px 0;
      font-size: 0.8rem;
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
      width: 560px;
      max-width: 90vw;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      padding: 12px 16px;
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
      font-size: 1.1rem;
      padding: 4px;
      transition: color 0.2s;
    }
    .modal-close:hover {
      color: var(--text-primary);
    }
    .modal-body {
      padding: 16px;
    }
    
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class ProjectsComponent implements OnInit {
  @Output() viewRun = new EventEmitter<string>();
  
  isFullscreen = false;

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
  }

  exitFullscreen() {
    this.isFullscreen = false;
  }

  projects: any[] = [];
  selectedProject: any = null;
  
  reqs = {
    sys1: [] as any[],
    sys2: [] as any[],
    sys3: [] as any[],
    swe1: [] as any[],
    swe2: [] as any[]
  };
  projectHistory: any[] = [];
  isLoadingReqs = false;
  private _activeTab: 'overview' | 'sys1' | 'sys2' | 'sys3' | 'swe1' | 'swe2' | 'trace' = 'overview';
  
  get activeTab() {
    return this._activeTab;
  }
  
  set activeTab(val: 'overview' | 'sys1' | 'sys2' | 'sys3' | 'swe1' | 'swe2' | 'trace') {
    if (this._activeTab !== val) {
      this._activeTab = val;
      this.selectedReqs.clear();
    }
  }
  
  showUploadModal = false;
  isUploading = false;
  
  newProject = {
    name: '',
    description: '',
    sys1File: null as File | null,
    sys2File: null as File | null,
    sys3File: null as File | null,
    swe1File: null as File | null,
    swe2File: null as File | null
  };
  
  uploadedStatus: string = '';
  uploadError: string = '';

  showAppendModal = false;
  isAppending = false;
  
  appendData = {
    sys1File: null as File | null,
    sys2File: null as File | null,
    sys3File: null as File | null,
    swe1File: null as File | null,
    swe2File: null as File | null
  };
  
  appendStatus: string = '';
  appendError: string = '';

  showEditModal = false;
  isSavingEdit = false;
  editError = '';
  editProjectData = {
    id: '',
    name: '',
    description: ''
  };

  editingReqId: string | null = null;
  tempReqText = '';
  isSavingReqEdit = false;
  editReqError = '';
  
  selectedReqs = new Set<string>();
  isDeletingReqs = false;

  openEditModal(project: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!project) return;
    this.editProjectData = {
      id: project.id,
      name: project.name,
      description: project.description || ''
    };
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditModal() {
    if (!this.isSavingEdit) {
      this.showEditModal = false;
      this.editError = '';
    }
  }

  saveProjectEdit() {
    if (!this.editProjectData.name || !this.editProjectData.name.trim()) {
      this.editError = 'Project name cannot be empty.';
      return;
    }
    this.isSavingEdit = true;
    this.editError = '';

    this.apiService.updateProject(
      this.editProjectData.id,
      this.editProjectData.name.trim(),
      this.editProjectData.description
    ).subscribe({
      next: () => {
        this.isSavingEdit = false;
        this.showEditModal = false;
        
        if (this.selectedProject && this.selectedProject.id === this.editProjectData.id) {
          this.selectedProject.name = this.editProjectData.name.trim();
          this.selectedProject.description = this.editProjectData.description;
        }
        
        this.loadProjects();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingEdit = false;
        this.editError = 'Failed to update project: ' + (err.error?.detail || err.message);
        this.cdr.detectChanges();
      }
    });
  }

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.apiService.getProjects().subscribe({
      next: (res) => {
        this.projects = res;
        if (this.projects.length > 0) {
          if (!this.selectedProject) {
            this.selectProject(this.projects[0]);
          } else {
            const updated = this.projects.find(p => p.id === this.selectedProject.id);
            if (updated) {
              this.selectedProject = updated;
            } else {
              this.selectProject(this.projects[0]);
            }
          }
        } else {
          this.selectedProject = null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Failed to load projects", err);
        this.cdr.detectChanges();
      }
    });
  }

  selectProject(project: any) {
    this.selectedProject = project;
    this.isLoadingReqs = true;
    this.activeTab = 'overview';
    this.selectedReqs.clear();
    this.reqs = { sys1: [], sys2: [], sys3: [], swe1: [], swe2: [] };
    this.projectHistory = [];
    this.cdr.detectChanges();
    
    this.apiService.getProjectRequirements(project.id).subscribe({
      next: (res) => {
        this.reqs = res;
        this.isLoadingReqs = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Failed to load project requirements", err);
        this.isLoadingReqs = false;
        this.cdr.detectChanges();
      }
    });
    
    this.loadProjectHistory();
  }

  loadProjectRequirements(projectId: string) {
    this.isLoadingReqs = true;
    this.apiService.getProjectRequirements(projectId).subscribe({
      next: (res) => {
        this.reqs = res;
        this.isLoadingReqs = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Failed to load project requirements", err);
        this.isLoadingReqs = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadProjectHistory() {
    this.apiService.getHistory(100, 0).subscribe({
      next: (res) => {
        if (this.selectedProject) {
          this.projectHistory = res.filter((r: any) => r.project_name === this.selectedProject.name && r.type === 'traceability');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cdr.detectChanges();
      }
    });
  }

  deleteProject(project: any) {
    if (!project) return;
    if (confirm(`Are you sure you want to delete project '${project.name}'? This will permanently remove all associated requirements.`)) {
      this.apiService.deleteProject(project.id).subscribe({
        next: () => {
          this.selectedProject = null;
          this.loadProjects();
          this.cdr.detectChanges();
        },
        error: (err) => {
          alert("Failed to delete project: " + (err.error?.detail || err.message));
          this.cdr.detectChanges();
        }
      });
    }
  }

  openUploadModal() {
    this.newProject = { name: '', description: '', sys1File: null, sys2File: null, sys3File: null, swe1File: null, swe2File: null };
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

  onFileSelected(event: any, type: 'sys1' | 'sys2' | 'sys3' | 'swe1' | 'swe2') {
    const file = event.target.files[0];
    if (file) {
      if (type === 'sys1') {
        this.newProject.sys1File = file;
        if (!this.newProject.name) {
          this.newProject.name = file.name.replace(/\.[^/.]+$/, '');
        }
      } else if (type === 'sys2') {
        this.newProject.sys2File = file;
      } else if (type === 'sys3') {
        this.newProject.sys3File = file;
      } else if (type === 'swe1') {
        this.newProject.swe1File = file;
      } else if (type === 'swe2') {
        this.newProject.swe2File = file;
      }
    }
  }

  uploadProject() {
    if (!this.newProject.name || !this.newProject.sys1File) return;
    
    this.isUploading = true;
    this.uploadedStatus = '';
    this.uploadError = '';
    
    this.apiService.createProject(
      this.newProject.name,
      this.newProject.description,
      this.newProject.sys1File,
      this.newProject.sys2File || undefined,
      this.newProject.sys3File || undefined,
      this.newProject.swe1File || undefined,
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

  openAppendModal() {
    this.appendData = {
      sys1File: null,
      sys2File: null,
      sys3File: null,
      swe1File: null,
      swe2File: null
    };
    this.appendStatus = '';
    this.appendError = '';
    this.showAppendModal = true;
  }

  closeAppendModal() {
    if (!this.isAppending) {
      this.showAppendModal = false;
      this.appendError = '';
      this.appendStatus = '';
    }
  }

  onAppendFileSelected(event: any, type: 'sys1'|'sys2'|'sys3'|'swe1'|'swe2') {
    const file = event.target.files[0];
    if (file) {
      this.appendData[`${type}File`] = file;
    }
  }

  appendProject() {
    if (!this.selectedProject) return;
    this.isAppending = true;
    this.appendError = '';
    this.appendStatus = '';
    
    this.apiService.appendProjectRequirements(
      this.selectedProject.id,
      this.appendData.sys1File || undefined,
      this.appendData.sys2File || undefined,
      this.appendData.sys3File || undefined,
      this.appendData.swe1File || undefined,
      this.appendData.swe2File || undefined
    ).subscribe({
      next: (res) => {
        this.isAppending = false;
        
        let stats = res.appended_stats || {};
        let msgs = [];
        for (const [key, val] of Object.entries(stats)) {
           msgs.push(`${key.toUpperCase()}: ${val} new`);
        }
        
        this.appendStatus = `Successfully appended documents! ` + (msgs.length ? `(${msgs.join(', ')})` : '');
        this.loadProjectRequirements(this.selectedProject.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isAppending = false;
        this.appendError = 'Append failed: ' + (err.error?.detail || err.message);
        this.cdr.detectChanges();
      }
    });
  }

  startEditReq(req: any) {
    if (!req) return;
    this.editingReqId = req.id;
    this.tempReqText = req.text;
    this.editReqError = '';
  }

  cancelEditReq() {
    this.editingReqId = null;
    this.tempReqText = '';
    this.editReqError = '';
  }

  saveInlineReq(req: any) {
    if (!this.selectedProject || !this.tempReqText.trim()) {
      this.editReqError = "Requirement text cannot be empty.";
      return;
    }
    
    this.isSavingReqEdit = true;
    this.editReqError = '';
    
    this.apiService.updateProjectRequirement(
      this.selectedProject.id,
      this.activeTab,
      req.id,
      this.tempReqText.trim()
    ).subscribe({
      next: () => {
        this.isSavingReqEdit = false;
        req.text = this.tempReqText.trim();
        this.editingReqId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingReqEdit = false;
        this.editReqError = "Failed to update requirement: " + (err.error?.detail || err.message);
        this.cdr.detectChanges();
      }
    });
  }

  toggleReqSelection(reqId: string) {
    if (this.selectedReqs.has(reqId)) {
      this.selectedReqs.delete(reqId);
    } else {
      this.selectedReqs.add(reqId);
    }
  }

  isAllSelected(): boolean {
    const currentReqs = (this.reqs as any)[this.activeTab] || [];
    if (currentReqs.length === 0) return false;
    return currentReqs.every((r: any) => this.selectedReqs.has(r.id));
  }

  toggleAllReqs(event: any) {
    const isChecked = event.target.checked;
    const currentReqs = (this.reqs as any)[this.activeTab] || [];
    
    if (isChecked) {
      currentReqs.forEach((r: any) => this.selectedReqs.add(r.id));
    } else {
      currentReqs.forEach((r: any) => this.selectedReqs.delete(r.id));
    }
  }

  deleteSelectedReqs() {
    if (this.selectedReqs.size === 0 || !this.selectedProject) return;
    
    if (!confirm(`Are you sure you want to delete ${this.selectedReqs.size} requirement(s)?`)) {
      return;
    }
    
    this.isDeletingReqs = true;
    const reqIds = Array.from(this.selectedReqs);
    
    this.apiService.deleteProjectRequirements(this.selectedProject.id, this.activeTab, reqIds).subscribe({
      next: () => {
        this.isDeletingReqs = false;
        this.selectedReqs.clear();
        this.loadProjectRequirements(this.selectedProject.id);
      },
      error: (err) => {
        this.isDeletingReqs = false;
        alert("Failed to delete requirements: " + (err.error?.detail || err.message));
        this.cdr.detectChanges();
      }
    });
  }
}