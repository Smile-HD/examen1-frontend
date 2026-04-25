import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminNavbarComponent } from './admin-navbar';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { timeout, finalize } from 'rxjs/operators';

interface IncidentHistoryItem {
  incident_id: number;
  client_id: number;
  client_name: string;
  client_email: string | null;
  vehicle_plate: string;
  workshop_id: number | null;
  workshop_name: string | null;
  status: string;
  problem_type: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  priority: number;
  created_at: string;
}

@Component({
  selector: 'app-admin-incidents',
  standalone: true,
  imports: [CommonModule, AdminNavbarComponent],
  template: `
    <main class="admin-wrap">
      <app-admin-navbar></app-admin-navbar>

      <header class="admin-header">
        <div>
          <h1>Historial de Incidentes</h1>
          <p>Registro completo de todos los incidentes del sistema</p>
        </div>
      </header>

      <div *ngIf="isLoading" class="loading-box">
        <div class="spinner"></div>
        <p><strong>Cargando historial...</strong></p>
      </div>

      <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>

      <section class="panel-block" *ngIf="!isLoading && incidents.length > 0">
        <div class="panel-title">
          <h2>Total de Incidentes: {{ totalIncidents }}</h2>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Vehículo</th>
                <th>Taller</th>
                <th>Estado</th>
                <th>Tipo Problema</th>
                <th>Ubicación</th>
                <th>Prioridad</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let incident of incidents">
                <td><span class="badge-id">{{ incident.incident_id }}</span></td>
                <td>
                  <strong>{{ incident.client_name }}</strong>
                  <br>
                  <small class="text-muted">{{ incident.client_email }}</small>
                </td>
                <td><span class="badge-plate">{{ incident.vehicle_plate }}</span></td>
                <td>
                  <span *ngIf="incident.workshop_name">{{ incident.workshop_name }}</span>
                  <span *ngIf="!incident.workshop_name" class="text-muted">Sin asignar</span>
                </td>
                <td><span class="badge-status" [class]="'status-' + incident.status">{{ incident.status }}</span></td>
                <td>{{ incident.problem_type }}</td>
                <td>
                  <span *ngIf="incident.location" class="location-text">{{ incident.location }}</span>
                  <span *ngIf="!incident.location" class="text-muted">-</span>
                </td>
                <td>
                  <span class="badge-priority" [class]="'priority-' + incident.priority">
                    {{ getPriorityLabel(incident.priority) }}
                  </span>
                </td>
                <td class="date-cell">{{ formatBoliviaDate(incident.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div *ngIf="!isLoading && incidents.length === 0" class="empty-box">
        No hay incidentes registrados en el sistema.
      </div>
    </main>
  `,
  styles: [`
    .admin-wrap {
      padding: 24px;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }

    .admin-header {
      margin-bottom: 24px;
    }

    .admin-header h1 {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .admin-header p {
      margin: 8px 0 0;
      color: #6c757d;
      font-size: 1rem;
    }

    .panel-block {
      background: #ffffff;
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
    }

    .panel-title h2 {
      margin: 0 0 24px 0;
      font-size: 1.4rem;
      font-weight: 700;
      color: #2d3748;
    }

    .table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }

    th, td {
      text-align: left;
      padding: 12px;
      font-size: 0.9rem;
    }

    th {
      color: #ffffff;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    th:first-child {
      border-top-left-radius: 12px;
    }

    th:last-child {
      border-top-right-radius: 12px;
    }

    tbody tr {
      background: #ffffff;
    }

    tbody tr:nth-child(even) {
      background: #f8f9fa;
    }

    tbody tr:hover {
      background: linear-gradient(90deg, #f0f4ff 0%, #e8ecff 100%);
    }

    td {
      border-bottom: 1px solid #e9ecef;
      color: #495057;
    }

    .badge-id {
      display: inline-block;
      padding: 4px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .badge-plate {
      display: inline-block;
      padding: 6px 12px;
      background: #2d3748;
      color: #ffffff;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.85rem;
      font-family: monospace;
    }

    .badge-status {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: capitalize;
    }

    .status-pendiente {
      background: #ffc107;
      color: #000;
    }

    .status-asignado {
      background: #17a2b8;
      color: #fff;
    }

    .status-en_camino {
      background: #007bff;
      color: #fff;
    }

    .status-atendido {
      background: #28a745;
      color: #fff;
    }

    .status-cancelado {
      background: #dc3545;
      color: #fff;
    }

    .status-requiere_info {
      background: #fd7e14;
      color: #fff;
    }

    .badge-priority {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
    }

    .priority-1 {
      background: #dc3545;
      color: #fff;
    }

    .priority-2 {
      background: #ffc107;
      color: #000;
    }

    .priority-3 {
      background: #28a745;
      color: #fff;
    }

    .text-muted {
      color: #6c757d;
      font-size: 0.85rem;
    }

    .location-text {
      max-width: 200px;
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .date-cell {
      color: #6c757d;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .loading-box {
      color: #667eea;
      background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
      border: 2px solid #667eea;
      padding: 32px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
      margin-bottom: 20px;
    }

    .loading-box p {
      margin: 16px 0 0 0;
      font-size: 1.1rem;
    }

    .spinner {
      margin: 0 auto;
      width: 50px;
      height: 50px;
      border: 4px solid rgba(102, 126, 234, 0.2);
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-box {
      color: #dc3545;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%);
      border: 2px solid #f8d7da;
      padding: 20px;
      border-radius: 16px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(220, 53, 69, 0.15);
      margin-bottom: 20px;
    }

    .empty-box {
      color: #6c757d;
      background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
      border: 2px dashed #dee2e6;
      padding: 24px;
      border-radius: 16px;
      text-align: center;
      font-size: 1rem;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .admin-wrap {
        padding: 16px;
      }

      .panel-block {
        padding: 20px;
      }

      th, td {
        padding: 8px;
        font-size: 0.8rem;
      }
    }
  `]
})
export class AdminIncidentsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  errorMessage: string | null = null;
  incidents: IncidentHistoryItem[] = [];
  totalIncidents = 0;

  ngOnInit(): void {
    this.loadIncidents();
  }

  loadIncidents(): void {
    this.isLoading = true;
    this.errorMessage = null;

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<{ total: number; incidents: IncidentHistoryItem[] }>(
      `${environment.apiUrl}/incidentes/admin/historial`,
      { headers }
    ).pipe(
      timeout(60000),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.incidents = response.incidents;
        this.totalIncidents = response.total;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[AdminIncidents] Error:', err);
        if (err.name === 'TimeoutError') {
          this.errorMessage = 'El servidor tardó más de 60 segundos en responder.';
        } else if (err.status === 401) {
          this.errorMessage = 'Sesión expirada. Inicia sesión nuevamente.';
        } else if (err.status === 403) {
          this.errorMessage = 'No tienes permisos para ver esta información.';
        } else {
          this.errorMessage = err?.error?.detail || err?.message || 'Error al cargar el historial.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  getPriorityLabel(priority: number): string {
    switch (priority) {
      case 1: return 'Alta';
      case 2: return 'Media';
      case 3: return 'Baja';
      default: return 'Media';
    }
  }

  formatBoliviaDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/La_Paz',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
      return new Intl.DateTimeFormat('es-BO', options).format(date);
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return dateString;
    }
  }
}
