import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminNavbarComponent } from './admin-navbar';
import { 
  ReportService, 
  DashboardSummaryResponse,
  RevenueReportResponse,
  WorkshopReportResponse,
  IncidentReportResponse,
  PaymentReportResponse
} from '../../core/services/report.service';
import { timeout, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminNavbarComponent],
  template: `
    <main class="admin-wrap">
      <app-admin-navbar></app-admin-navbar>

      <header class="admin-header">
        <div>
          <h1>Reportes y Análisis</h1>
          <p>Métricas y estadísticas del negocio</p>
        </div>
      </header>

      <!-- Filtros de período -->
      <section class="filters-section">
        <div class="filter-group">
          <label>Período:</label>
          <select [(ngModel)]="selectedPeriod" (change)="onPeriodChange()" class="select-period">
            <option value="today">Hoy</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="year">Último año</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        <div class="filter-group" *ngIf="selectedPeriod === 'custom'">
          <label>Desde:</label>
          <input type="date" [(ngModel)]="customStartDate" class="date-input">
        </div>

        <div class="filter-group" *ngIf="selectedPeriod === 'custom'">
          <label>Hasta:</label>
          <input type="date" [(ngModel)]="customEndDate" class="date-input">
        </div>

        <button class="btn-load" (click)="loadAllReports()" [disabled]="isLoading">
          {{ isLoading ? 'Cargando...' : 'Generar Reportes' }}
        </button>

        <div class="export-buttons" *ngIf="dashboardData && !isLoading">
          <button class="btn-export excel" (click)="exportToExcel()" title="Exportar a Excel">
            Excel
          </button>
          <button class="btn-export pdf" (click)="exportToPDF()" title="Exportar a PDF">
            PDF
          </button>
        </div>
      </section>

      <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>
      <div *ngIf="isLoading" class="loading-box">
        <div class="spinner"></div>
        <p><strong>Generando reportes...</strong></p>
      </div>

      <!-- Dashboard Summary -->
      <section class="panel-block" *ngIf="dashboardData && !isLoading">
        <h2>Resumen Ejecutivo</h2>
        
        <div class="kpis-grid">
          <div class="kpi-card revenue">
            <h3>Ingresos por Comisiones</h3>
            <p class="kpi-value">Bs. {{ dashboardData.revenue.total_commission | number:'1.2-2' }}</p>
            <small>{{ dashboardData.revenue.total_payments }} pagos confirmados</small>
          </div>

          <div class="kpi-card">
            <h3>Talleres Activos</h3>
            <p class="kpi-value">{{ dashboardData.workshops.active_workshops }}</p>
            <small>de {{ dashboardData.workshops.total_workshops }} totales</small>
          </div>

          <div class="kpi-card">
            <h3>Incidentes</h3>
            <p class="kpi-value">{{ dashboardData.incidents.total_incidents }}</p>
            <small>{{ dashboardData.incidents.assigned_incidents }} asignados</small>
          </div>

          <div class="kpi-card">
            <h3>Usuarios</h3>
            <p class="kpi-value">{{ dashboardData.users.total_users }}</p>
            <small>{{ dashboardData.users.total_clients }} clientes</small>
          </div>
        </div>

        <!-- Estados de Pagos -->
        <div class="status-grid">
          <div class="status-card confirmado">
            <span class="status-label">Confirmados</span>
            <span class="status-value">{{ dashboardData.payments.confirmado }}</span>
          </div>
          <div class="status-card verificacion">
            <span class="status-label">En Verificación</span>
            <span class="status-value">{{ dashboardData.payments.verificacion }}</span>
          </div>
          <div class="status-card pendiente">
            <span class="status-label">Pendientes</span>
            <span class="status-value">{{ dashboardData.payments.pendiente }}</span>
          </div>
          <div class="status-card rechazado">
            <span class="status-label">Rechazados</span>
            <span class="status-value">{{ dashboardData.payments.rechazado }}</span>
          </div>
        </div>
      </section>

      <!-- Revenue Report -->
      <section class="panel-block" *ngIf="revenueData && !isLoading">
        <h2>Reporte de Ingresos</h2>
        
        <div class="comparison-box">
          <div class="comparison-item">
            <span class="label">Período actual:</span>
            <span class="value">Bs. {{ revenueData.summary.total_commission | number:'1.2-2' }}</span>
          </div>
          <div class="comparison-item">
            <span class="label">Período anterior:</span>
            <span class="value">Bs. {{ revenueData.summary.previous_commission | number:'1.2-2' }}</span>
          </div>
          <div class="comparison-item" [class.positive]="revenueData.summary.commission_change_percent > 0" [class.negative]="revenueData.summary.commission_change_percent < 0">
            <span class="label">Cambio:</span>
            <span class="value">{{ revenueData.summary.commission_change_percent > 0 ? '+' : '' }}{{ revenueData.summary.commission_change_percent | number:'1.2-2' }}%</span>
          </div>
        </div>

        <h3>Top 10 Talleres por Ingresos</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Posición</th>
                <th>Taller</th>
                <th>Pagos</th>
                <th>Monto Total</th>
                <th>Comisión Generada</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let workshop of revenueData.top_workshops; let i = index">
                <td><span class="rank">{{ i + 1 }}</span></td>
                <td><strong>{{ workshop.taller_name }}</strong></td>
                <td>{{ workshop.total_payments }}</td>
                <td>Bs. {{ workshop.total_amount | number:'1.2-2' }}</td>
                <td><strong>Bs. {{ workshop.total_commission | number:'1.2-2' }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Incident Report -->
      <section class="panel-block" *ngIf="incidentData && !isLoading">
        <h2> Reporte de Incidentes</h2>
        
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Incidentes</span>
            <span class="stat-value">{{ incidentData.summary.total_incidents }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Asignados</span>
            <span class="stat-value">{{ incidentData.summary.assigned_incidents }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Sin Asignar</span>
            <span class="stat-value">{{ incidentData.summary.unassigned_incidents }}</span>
          </div>
        </div>

        <h3>Clientes Más Activos</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Email</th>
                <th>Incidentes Reportados</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let client of incidentData.most_active_clients">
                <td><strong>{{ client.user_name }}</strong></td>
                <td>{{ client.user_email }}</td>
                <td><span class="badge-count">{{ client.incident_count }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Payment Report -->
      <section class="panel-block" *ngIf="paymentData && !isLoading">
        <h2>Reporte de Pagos</h2>
        
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Pagos</span>
            <span class="stat-value">{{ paymentData.summary.total_payments }}</span>
          </div>
          <div class="stat-item success">
            <span class="stat-label">Tasa de Confirmación</span>
            <span class="stat-value">{{ paymentData.summary.confirmation_rate | number:'1.2-2' }}%</span>
          </div>
          <div class="stat-item danger">
            <span class="stat-label">Tasa de Rechazo</span>
            <span class="stat-value">{{ paymentData.summary.rejection_rate | number:'1.2-2' }}%</span>
          </div>
        </div>

        <h3>Últimos Pagos Rechazados</h3>
        <div class="table-wrapper" *ngIf="paymentData.rejected_payments.length > 0">
          <table>
            <thead>
              <tr>
                <th>ID Pago</th>
                <th>Cliente</th>
                <th>Taller</th>
                <th>Monto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let payment of paymentData.rejected_payments">
                <td><span class="badge-id">{{ payment.payment_id }}</span></td>
                <td>{{ payment.user_name }}</td>
                <td>{{ payment.taller_name }}</td>
                <td>Bs. {{ payment.amount | number:'1.2-2' }}</td>
                <td class="date-cell">{{ formatBoliviaDate(payment.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="paymentData.rejected_payments.length === 0" class="empty-box">
          No hay pagos rechazados en este período
        </div>
      </section>
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

    .filters-section {
      background: #ffffff;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 4px 16px rgba(31, 38, 135, 0.1);
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: flex-end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .filter-group label {
      font-weight: 600;
      font-size: 0.9rem;
      color: #495057;
    }

    .select-period, .date-input {
      padding: 10px 16px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 0.95rem;
      background: #ffffff;
      color: #495057;
      min-width: 150px;
    }

    .select-period:focus, .date-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .btn-load {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.3s ease;
    }

    .btn-load:hover:not(:disabled) {
      opacity: 0.9;
    }

    .btn-load:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .export-buttons {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .btn-export {
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: opacity 0.3s ease;
      color: #ffffff;
    }

    .btn-export.excel {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    }

    .btn-export.pdf {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    }

    .btn-export:hover {
      opacity: 0.9;
    }

    .panel-block {
      background: #ffffff;
      border-radius: 20px;
      padding: 28px;
      margin-bottom: 24px;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
    }

    .panel-block h2 {
      margin: 0 0 24px 0;
      font-size: 1.4rem;
      font-weight: 700;
      color: #2d3748;
    }

    .panel-block h3 {
      margin: 24px 0 16px 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #4a5568;
    }

    .kpis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      position: relative;
      overflow: hidden;
    }

    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    }

    .kpi-card.revenue::before {
      background: linear-gradient(180deg, #28a745 0%, #20c997 100%);
    }

    .kpi-card h3 {
      margin: 0 0 12px 0;
      font-size: 0.9rem;
      color: #6c757d;
      font-weight: 600;
    }

    .kpi-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #667eea;
      margin: 0;
    }

    .kpi-card small {
      color: #6c757d;
      font-size: 0.85rem;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .status-card {
      padding: 16px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: #ffffff;
    }

    .status-card.confirmado {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    }

    .status-card.verificacion {
      background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
    }

    .status-card.pendiente {
      background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
    }

    .status-card.rechazado {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    }

    .status-label {
      font-size: 0.85rem;
      opacity: 0.9;
    }

    .status-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .comparison-box {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
    }

    .comparison-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .comparison-item .label {
      font-size: 0.9rem;
      color: #6c757d;
      font-weight: 600;
    }

    .comparison-item .value {
      font-size: 1.3rem;
      font-weight: 700;
      color: #2d3748;
    }

    .comparison-item.positive .value {
      color: #28a745;
    }

    .comparison-item.negative .value {
      color: #dc3545;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-item {
      padding: 16px;
      background: #f8f9fa;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stat-item.success {
      background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
    }

    .stat-item.danger {
      background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    }

    .stat-label {
      font-size: 0.85rem;
      color: #6c757d;
      font-weight: 600;
    }

    .stat-value {
      font-size: 1.5rem;
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

    .rank {
      display: inline-block;
      width: 32px;
      height: 32px;
      line-height: 32px;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      border-radius: 50%;
      font-weight: 700;
      font-size: 0.9rem;
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

    .badge-count {
      display: inline-block;
      padding: 6px 12px;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: #ffffff;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
    }

    .date-cell {
      color: #6c757d;
      font-size: 0.85rem;
      white-space: nowrap;
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

    @media (max-width: 768px) {
      .admin-wrap {
        padding: 16px;
      }

      .filters-section {
        flex-direction: column;
        align-items: stretch;
      }

      .panel-block {
        padding: 20px;
      }

      .kpis-grid, .status-grid, .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AdminReportsComponent implements OnInit {
  private reportService = inject(ReportService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  errorMessage: string | null = null;

  selectedPeriod = 'month';
  customStartDate = '';
  customEndDate = '';

  dashboardData: DashboardSummaryResponse | null = null;
  revenueData: RevenueReportResponse | null = null;
  workshopData: WorkshopReportResponse | null = null;
  incidentData: IncidentReportResponse | null = null;
  paymentData: PaymentReportResponse | null = null;

  ngOnInit(): void {
    this.loadAllReports();
  }

  onPeriodChange(): void {
    if (this.selectedPeriod !== 'custom') {
      this.customStartDate = '';
      this.customEndDate = '';
    }
  }

  loadAllReports(): void {
    if (this.selectedPeriod === 'custom' && (!this.customStartDate || !this.customEndDate)) {
      this.errorMessage = 'Por favor selecciona fechas de inicio y fin para el período personalizado';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const period = this.selectedPeriod;
    const startDate = this.customStartDate;
    const endDate = this.customEndDate;

    // Cargar dashboard
    this.reportService.getDashboardSummary(period, startDate, endDate).pipe(
      timeout(60000),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.loadRevenueReport();
        this.loadIncidentReport();
        this.loadPaymentReport();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[AdminReports] Error:', err);
        this.errorMessage = err?.error?.detail || err?.message || 'Error al cargar reportes';
        this.cdr.detectChanges();
      }
    });
  }

  loadRevenueReport(): void {
    const period = this.selectedPeriod;
    const startDate = this.customStartDate;
    const endDate = this.customEndDate;

    this.reportService.getRevenueReport(period, startDate, endDate).pipe(
      timeout(60000)
    ).subscribe({
      next: (data) => {
        this.revenueData = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[AdminReports] Error revenue:', err);
      }
    });
  }

  loadIncidentReport(): void {
    const period = this.selectedPeriod;
    const startDate = this.customStartDate;
    const endDate = this.customEndDate;

    this.reportService.getIncidentReport(period, startDate, endDate).pipe(
      timeout(60000)
    ).subscribe({
      next: (data) => {
        this.incidentData = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[AdminReports] Error incident:', err);
      }
    });
  }

  loadPaymentReport(): void {
    const period = this.selectedPeriod;
    const startDate = this.customStartDate;
    const endDate = this.customEndDate;

    this.reportService.getPaymentReport(period, startDate, endDate).pipe(
      timeout(60000)
    ).subscribe({
      next: (data) => {
        this.paymentData = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[AdminReports] Error payment:', err);
      }
    });
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

  exportToExcel(): void {
    if (!this.dashboardData) return;

    // Crear contenido CSV
    let csv = 'REPORTE DE ANÁLISIS - SISTEMA DE EMERGENCIAS\n\n';
    
    // Período
    csv += `Período: ${this.getPeriodLabel()}\n\n`;

    // Resumen Ejecutivo
    csv += 'RESUMEN EJECUTIVO\n';
    csv += 'Métrica,Valor\n';
    csv += `Ingresos por Comisiones,Bs. ${this.dashboardData.revenue.total_commission.toFixed(2)}\n`;
    csv += `Pagos Confirmados,${this.dashboardData.revenue.total_payments}\n`;
    csv += `Talleres Activos,${this.dashboardData.workshops.active_workshops}\n`;
    csv += `Total Talleres,${this.dashboardData.workshops.total_workshops}\n`;
    csv += `Total Incidentes,${this.dashboardData.incidents.total_incidents}\n`;
    csv += `Incidentes Asignados,${this.dashboardData.incidents.assigned_incidents}\n`;
    csv += `Total Usuarios,${this.dashboardData.users.total_users}\n`;
    csv += `Total Clientes,${this.dashboardData.users.total_clients}\n\n`;

    // Estados de Pagos
    csv += 'ESTADOS DE PAGOS\n';
    csv += 'Estado,Cantidad\n';
    csv += `Confirmados,${this.dashboardData.payments.confirmado}\n`;
    csv += `En Verificación,${this.dashboardData.payments.verificacion}\n`;
    csv += `Pendientes,${this.dashboardData.payments.pendiente}\n`;
    csv += `Rechazados,${this.dashboardData.payments.rechazado}\n\n`;

    // Top Talleres
    if (this.revenueData && this.revenueData.top_workshops.length > 0) {
      csv += 'TOP 10 TALLERES POR INGRESOS\n';
      csv += 'Posición,Taller,Pagos,Monto Total,Comisión Generada\n';
      this.revenueData.top_workshops.forEach((workshop, index) => {
        csv += `${index + 1},${workshop.taller_name},${workshop.total_payments},Bs. ${workshop.total_amount.toFixed(2)},Bs. ${workshop.total_commission.toFixed(2)}\n`;
      });
      csv += '\n';
    }

    // Clientes Más Activos
    if (this.incidentData && this.incidentData.most_active_clients.length > 0) {
      csv += 'CLIENTES MÁS ACTIVOS\n';
      csv += 'Cliente,Email,Incidentes Reportados\n';
      this.incidentData.most_active_clients.forEach((client) => {
        csv += `${client.user_name},${client.user_email},${client.incident_count}\n`;
      });
      csv += '\n';
    }

    // Pagos Rechazados
    if (this.paymentData && this.paymentData.rejected_payments.length > 0) {
      csv += 'ÚLTIMOS PAGOS RECHAZADOS\n';
      csv += 'ID Pago,Cliente,Taller,Monto,Fecha\n';
      this.paymentData.rejected_payments.forEach((payment) => {
        csv += `${payment.payment_id},${payment.user_name},${payment.taller_name},Bs. ${payment.amount.toFixed(2)},${this.formatBoliviaDate(payment.created_at)}\n`;
      });
    }

    // Descargar archivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${this.selectedPeriod}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToPDF(): void {
    if (!this.dashboardData) return;

    // Crear contenido HTML para imprimir
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Análisis</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          h1 {
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
          }
          h2 {
            color: #764ba2;
            margin-top: 30px;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 8px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .period {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: bold;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .kpi-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          .kpi-label {
            font-size: 0.9rem;
            color: #6c757d;
            margin-bottom: 5px;
          }
          .kpi-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #667eea;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
          }
          th {
            background: #667eea;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background: #f8f9fa;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #6c757d;
            font-size: 0.9rem;
            border-top: 1px solid #dee2e6;
            padding-top: 20px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>REPORTE DE ANÁLISIS</h1>
          <p>Sistema de Emergencias - Panel de Superusuario</p>
        </div>

        <div class="period">
          Período: ${this.getPeriodLabel()}
        </div>

        <h2>Resumen Ejecutivo</h2>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Ingresos por Comisiones</div>
            <div class="kpi-value">Bs. ${this.dashboardData.revenue.total_commission.toFixed(2)}</div>
            <small>${this.dashboardData.revenue.total_payments} pagos confirmados</small>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Talleres Activos</div>
            <div class="kpi-value">${this.dashboardData.workshops.active_workshops}</div>
            <small>de ${this.dashboardData.workshops.total_workshops} totales</small>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Incidentes</div>
            <div class="kpi-value">${this.dashboardData.incidents.total_incidents}</div>
            <small>${this.dashboardData.incidents.assigned_incidents} asignados</small>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Usuarios</div>
            <div class="kpi-value">${this.dashboardData.users.total_users}</div>
            <small>${this.dashboardData.users.total_clients} clientes</small>
          </div>
        </div>

        <h2>Estados de Pagos</h2>
        <table>
          <thead>
            <tr>
              <th>Estado</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Confirmados</td><td>${this.dashboardData.payments.confirmado}</td></tr>
            <tr><td>En Verificación</td><td>${this.dashboardData.payments.verificacion}</td></tr>
            <tr><td>Pendientes</td><td>${this.dashboardData.payments.pendiente}</td></tr>
            <tr><td>Rechazados</td><td>${this.dashboardData.payments.rechazado}</td></tr>
          </tbody>
        </table>

        ${this.revenueData && this.revenueData.top_workshops.length > 0 ? `
          <h2>Top 10 Talleres por Ingresos</h2>
          <table>
            <thead>
              <tr>
                <th>Posición</th>
                <th>Taller</th>
                <th>Pagos</th>
                <th>Monto Total</th>
                <th>Comisión</th>
              </tr>
            </thead>
            <tbody>
              ${this.revenueData.top_workshops.map((workshop, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${workshop.taller_name}</td>
                  <td>${workshop.total_payments}</td>
                  <td>Bs. ${workshop.total_amount.toFixed(2)}</td>
                  <td>Bs. ${workshop.total_commission.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${this.incidentData && this.incidentData.most_active_clients.length > 0 ? `
          <h2>Clientes Más Activos</h2>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Email</th>
                <th>Incidentes</th>
              </tr>
            </thead>
            <tbody>
              ${this.incidentData.most_active_clients.map((client) => `
                <tr>
                  <td>${client.user_name}</td>
                  <td>${client.user_email}</td>
                  <td>${client.incident_count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${this.paymentData && this.paymentData.rejected_payments.length > 0 ? `
          <h2>Últimos Pagos Rechazados</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Taller</th>
                <th>Monto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${this.paymentData.rejected_payments.map((payment) => `
                <tr>
                  <td>${payment.payment_id}</td>
                  <td>${payment.user_name}</td>
                  <td>${payment.taller_name}</td>
                  <td>Bs. ${payment.amount.toFixed(2)}</td>
                  <td>${this.formatBoliviaDate(payment.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="footer">
          <p>Generado el ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}</p>
          <p>Sistema de Emergencias - Todos los derechos reservados</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 1rem; cursor: pointer;">
            Imprimir / Guardar como PDF
          </button>
          <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-left: 10px;">
            Cerrar
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  getPeriodLabel(): string {
    switch (this.selectedPeriod) {
      case 'today': return 'Hoy';
      case 'week': return 'Última semana';
      case 'month': return 'Último mes';
      case 'year': return 'Último año';
      case 'custom': return `${this.customStartDate} al ${this.customEndDate}`;
      default: return 'Último mes';
    }
  }
}
