import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  
private baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://aaram.onrender.com';
  
  constructor(private http: HttpClient) {}

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // Guidelines Endpoints
  uploadGuideline(name: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/api/guidelines/upload`, formData);
  }

  deleteGuideline(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/guidelines/${id}`);
  }

  updateGuideline(id: string, name: string, content: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/guidelines/${id}`, { name, content });
  }

  getGuidelines(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/guidelines`);
  }

  // RAG Configuration & Progressive Chunking
  getRagMetrics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/rag/metrics`);
  }

  searchRag(query: string, limit: number = 5, collectionName: string = 'airam_guidelines'): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/rag/search`, {
      params: { 
        query, 
        limit: limit.toString(),
        collection_name: collectionName
      }
    });
  }

  getRagCollections(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/api/rag/collections`);
  }

  deleteRagCollection(collectionName: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/rag/collections/${collectionName}`);
  }

  inspectPdf(file: File): Observable<{ pages: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ pages: number }>(`${this.baseUrl}/api/rag/inspect-pdf`, formData);
  }

  trainRAG(
    file: File, 
    collectionName: string = 'airam_guidelines', 
    collectionMode: string = 'create',
    startPage?: number,
    endPage?: number
  ): Observable<any> {
    return new Observable(subscriber => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collection_name', collectionName);
      formData.append('collection_mode', collectionMode);
      if (startPage !== undefined && startPage !== null) {
        formData.append('start_page', startPage.toString());
      }
      if (endPage !== undefined && endPage !== null) {
        formData.append('end_page', endPage.toString());
      }

      fetch(`${this.baseUrl}/api/rag/train`, {
        method: 'POST',
        body: formData
      })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (!response.body) {
          subscriber.error('No response body returned from server.');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.substring(6));
                subscriber.next(data);
              } catch (e) {
                // Ignore parse errors on trailing or heartbeat lines
              }
            }
          }
        }
        subscriber.complete();
      })
      .catch(err => {
        subscriber.error(err);
      });
    });
  }

  // Projects API
  createProject(
    name: string, 
    description: string, 
    sys1File: File, 
    sys2File?: File, 
    sys3File?: File, 
    swe1File?: File, 
    swe2File?: File
  ): Observable<any> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('sys1_file', sys1File);
    if (sys2File) formData.append('sys2_file', sys2File);
    if (sys3File) formData.append('sys3_file', sys3File);
    if (swe1File) formData.append('swe1_file', swe1File);
    if (swe2File) formData.append('swe2_file', swe2File);
    return this.http.post(`${this.baseUrl}/api/projects`, formData);
  }

  appendProjectRequirements(
    projectId: string,
    sys1File?: File,
    sys2File?: File,
    sys3File?: File,
    swe1File?: File,
    swe2File?: File
  ): Observable<any> {
    const formData = new FormData();
    if (sys1File) formData.append('sys1_file', sys1File);
    if (sys2File) formData.append('sys2_file', sys2File);
    if (sys3File) formData.append('sys3_file', sys3File);
    if (swe1File) formData.append('swe1_file', swe1File);
    if (swe2File) formData.append('swe2_file', swe2File);
    return this.http.post(`${this.baseUrl}/api/projects/${projectId}/append`, formData);
  }

  updateProjectRequirement(projectId: string, reqType: string, reqId: string, newText: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/projects/${projectId}/requirements/${reqType}/${reqId}`, { text: newText });
  }

  deleteProjectRequirements(projectId: string, reqType: string, reqIds: string[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/projects/${projectId}/requirements/${reqType}/delete`, { req_ids: reqIds });
  }

  getProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/projects`);
  }

  getProjectRequirements(projectId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/projects/${projectId}/requirements`);
  }

  deleteProject(projectId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/projects/${projectId}`);
  }

  updateProject(projectId: string, name: string, description: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/projects/${projectId}`, { name, description });
  }

  // Requirements Analysis Controls & Progress Tracker
  startAnalysis(
    runType: string,
    projectId: string,
    guidelineId: string | null,
    useRag: boolean,
    modelName: string,
    correctQuality: boolean = false,
    correctTrace: boolean = false,
    customContext?: string,
    customContextCorrection?: string
  ): Observable<any> {
    const formData = new FormData();
    formData.append('run_type', runType);
    formData.append('project_id', projectId);
    if (guidelineId) formData.append('guideline_id', guidelineId);
    formData.append('use_rag', String(useRag));
    formData.append('model_name', modelName);
    formData.append('correct_quality', String(correctQuality));
    formData.append('correct_trace', String(correctTrace));
    if (customContext) formData.append('custom_context', customContext);
    if (customContextCorrection) formData.append('custom_context_correction', customContextCorrection);
    return this.http.post(`${this.baseUrl}/api/analysis/start`, formData);
  }

  pauseAnalysis(runId: string): Observable<any> {
    return this.http.post<any>(this.baseUrl + '/api/analysis/' + runId + '/pause', {});
  }

  resumeAnalysis(runId: string): Observable<any> {
    return this.http.post<any>(this.baseUrl + '/api/analysis/' + runId + '/resume', {});
  }

  stopAnalysis(runId: string): Observable<any> {
    return this.http.post<any>(this.baseUrl + '/api/analysis/' + runId + '/stop', {});
  }

  getAnalysisStatus(runId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/analysis/${runId}/status`);
  }

  getRunResults(runId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/analysis/${runId}/results`);
  }

  getHistory(limit: number = 15, offset: number = 0): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/analysis/history`, {
      params: { limit: limit.toString(), offset: offset.toString() }
    });
  }

  minimizeRun(runId: string, minimized: boolean): Observable<any> {
    const formData = new FormData();
    formData.append('minimized', minimized ? 'true' : 'false');
    return this.http.post(`${this.baseUrl}/api/analysis/${runId}/minimize`, formData);
  }

  deleteRun(runId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/analysis/${runId}`);
  }
}
