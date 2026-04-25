import { Component, OnInit, inject, ChangeDetectorRef, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminNavbarComponent } from './admin-navbar';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import {
  PaymentAdminSummaryResponse,
  PaymentListItemResponse,
  PaymentService,
} from '../../core/services/payment.service';

@Component({
  selector: 'app-payments-admin',
  standalone: true,
  imports: [CommonModule, AdminNavbarComponent],
  template: `
    <main class="admin-wrap">
      <app-admin-navbar></app-admin-navbar>
      <header class="admin-header">
        <div>
          <h1>Panel de Superusuario - Pagos Globales</h1>
          <p>Resumen consolidado de pagos, comisión de plataforma y monto pendiente por taller.</p>
        </div>
        <div class="header-actions">
          <button class="btn-incidents" type="button" (click)="goToIncidents()">
            Ver historial de incidentes
          </button>
        </div>
      </header>

      <section *ngIf="errorMessage" class="error-box">{{ errorMessage }}</section>
      
      <section *ngIf="isLoading" class="loading-box">
        <div class="spinner"></div>
        <p><strong>Cargando resumen de pagos...</strong></p>
      </section>

      <ng-container *ngIf="summary && !isLoading">
        <section class="kpis-grid">
          <article class="kpi-card">
            <h3>Total pagos</h3>
            <p>{{ summary.total_payments }}</p>
          </article>
          <article class="kpi-card">
            <h3>Monto total</h3>
            <p>Bs. {{ summary.total_amount | number:'1.2-2' }}</p>
          </article>
          <article class="kpi-card">
            <h3>Comisión total</h3>
            <p>Bs. {{ summary.total_commission | number:'1.2-2' }}</p>
          </article>
          <article class="kpi-card">
            <h3>Neto talleres</h3>
            <p>Bs. {{ summary.total_net_to_workshop | number:'1.2-2' }}</p>
          </article>
          <article class="kpi-card">
            <h3>Confirmados</h3>
            <p>{{ summary.confirmed_payments }}</p>
          </article>
          <article class="kpi-card">
            <h3>En verificación</h3>
            <p>{{ summary.verification_payments }}</p>
          </article>
          <article class="kpi-card">
            <h3>Pendientes</h3>
            <p>{{ summary.pending_payments }}</p>
          </article>
          <article class="kpi-card">
            <h3>Rechazados</h3>
            <p>{{ summary.rejected_payments }}</p>
          </article>
        </section>

        <section class="panel-block">
          <div class="panel-title">
            <h2>Deuda por Taller (Comisión a pagar a plataforma)</h2>
            <small class="date-badge">{{ formatBoliviaDate(summary.generated_at) }}</small>
          </div>

          <div *ngIf="summary.workshops.length === 0" class="empty-box">
            No hay talleres con pagos registrados.
          </div>

          <div class="table-wrapper" *ngIf="summary.workshops.length > 0">
            <table>
              <thead>
                <tr>
                  <th>Taller</th>
                  <th>Total pagos</th>
                  <th>Confirmados</th>
                  <th>Verificación</th>
                  <th>Rechazados</th>
                  <th>Monto total</th>
                  <th>Comisión total</th>
                  <th>Neto taller</th>
                  <th>Debe pagar a plataforma</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let ws of summary.workshops">
                  <td>{{ ws.taller_name }} (#{{ ws.taller_id }})</td>
                  <td>{{ ws.total_payments }}</td>
                  <td>{{ ws.confirmed_payments }}</td>
                  <td>{{ ws.verification_payments }}</td>
                  <td>{{ ws.rejected_payments }}</td>
                  <td>Bs. {{ ws.total_amount | number:'1.2-2' }}</td>
                  <td>Bs. {{ ws.total_commission | number:'1.2-2' }}</td>
                  <td>Bs. {{ ws.total_net_to_workshop | number:'1.2-2' }}</td>
                  <td><strong>Bs. {{ ws.amount_due_to_platform | number:'1.2-2' }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel-block">
          <div class="panel-title">
            <h2>Detalle de Todos los Pagos</h2>
          </div>

          <div *ngIf="summary.payments.length === 0" class="empty-box">
            No hay pagos para mostrar.
          </div>

          <div class="workshop-groups" *ngIf="groupedPayments.length > 0">
            <section class="workshop-card" *ngFor="let g of groupedPayments">
              <details open>
                <summary class="workshop-summary">
                  <div class="workshop-title">
                    <strong>{{ g.taller_name }}</strong>
                    <span class="muted">({{ g.payments.length }} pagos)</span>
                  </div>
                  <div class="workshop-totals">
                    <span class="total">Bs. {{ g.total_amount | number:'1.2-2' }}</span>
                    <span class="muted">Com: Bs. {{ g.total_commission | number:'1.2-2' }}</span>
                    <span class="muted">Neto: Bs. {{ g.total_net | number:'1.2-2' }}</span>
                  </div>
                </summary>

                <div class="payments-list-inner" *ngIf="g.payments.length > 0">
                  <article class="payment-card" *ngFor="let p of g.payments">
                    <div class="payment-head">
                      <h3>Pago #{{ p.payment_id }} - {{ getStatusLabel(p.status) }}</h3>
                      <small class="date-badge-small">{{ formatBoliviaDate(p.created_at) }}</small>
                    </div>
                    <div class="payment-grid">
                      <p><strong>Taller:</strong> {{ p.taller_name || ('ID ' + p.taller_id) }}</p>
                      <p><strong>Cliente:</strong> {{ p.user_name || ('ID ' + p.user_id) }}</p>
                      <p><strong>Referencia:</strong> {{ p.reference }}</p>
                      <p><strong>Incidente:</strong> #{{ p.incident_id }}</p>
                      <p><strong>Monto:</strong> Bs. {{ p.amount | number:'1.2-2' }}</p>
                      <p><strong>Comisión:</strong> Bs. {{ p.commission | number:'1.2-2' }}</p>
                      <p><strong>Neto taller:</strong> Bs. {{ p.net_amount_to_workshop | number:'1.2-2' }}</p>
                    </div>
                    <div *ngIf="getProofUrl(p)">
                      <a [href]="getProofUrl(p)" target="_blank" rel="noopener noreferrer">Ver comprobante</a>
                    </div>
                    <div *ngIf="!getProofUrl(p)" class="empty-inline">Sin comprobante cargado</div>
                  </article>
                </div>
              </details>
            </section>
          </div>
        </section>
      </ng-container>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .admin-wrap {
        min-height: 100vh;
        padding: 24px;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        color: #1a202c;
      }

      .admin-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
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

      .header-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .kpis-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 28px;
      }

      .kpi-card {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: none;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(31, 38, 135, 0.1);
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

      .kpi-card h3 {
        margin: 0;
        font-size: 0.9rem;
        color: #6c757d;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .kpi-card p {
        margin: 12px 0 0;
        font-size: 1.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .panel-block {
        background: #ffffff;
        border: none;
        border-radius: 20px;
        padding: 28px;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
        backdrop-filter: blur(10px);
      }

      .panel-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 24px;
      }

      .panel-title h2 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .panel-title small {
        color: #6c757d;
        font-size: 0.9rem;
        font-weight: 500;
      }

      .date-badge {
        display: inline-block;
        padding: 8px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #ffffff !important;
        border-radius: 20px;
        font-weight: 600 !important;
        font-size: 0.85rem !important;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      }

      .date-badge-small {
        display: inline-block;
        padding: 4px 12px;
        background: rgba(102, 126, 234, 0.1);
        color: #667eea !important;
        border-radius: 12px;
        font-weight: 600 !important;
        font-size: 0.8rem !important;
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

      th,
      td {
        text-align: left;
        padding: 16px 12px;
        font-size: 0.95rem;
      }

      th {
        color: #ffffff;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-bottom: 3px solid rgba(255, 255, 255, 0.2);
        font-size: 0.85rem;
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

      td strong {
        color: #667eea;
        font-weight: 700;
      }

      .payments-list {
        display: grid;
        gap: 10px;
      }

      .payment-card {
        border: none;
        border-radius: 16px;
        padding: 20px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        box-shadow: 0 4px 16px rgba(31, 38, 135, 0.1);
      }

      .payment-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid #e9ecef;
      }

      .payment-head h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: #667eea;
      }

      .payment-head small {
        color: #6c757d;
        font-size: 0.9rem;
      }

      .payment-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .payment-grid p {
        margin: 0;
        font-size: 0.95rem;
        color: #495057;
        padding: 8px;
        background: rgba(102, 126, 234, 0.05);
        border-radius: 8px;
      }

      .payment-grid p strong {
        color: #667eea;
        font-weight: 600;
      }

      .empty-box {
        border: 2px dashed #dee2e6;
        border-radius: 16px;
        padding: 24px;
        background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
        color: #6c757d;
        text-align: center;
        font-size: 1rem;
        font-weight: 500;
      }

      .empty-inline {
        color: #6c757d;
        font-size: 0.9rem;
        font-style: italic;
      }

      .error-box {
        border: 2px solid #f8d7da;
        color: #dc3545;
        background: linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 20px;
        font-weight: 500;
        box-shadow: 0 4px 16px rgba(220, 53, 69, 0.15);
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
        margin: 16px 0 8px 0;
        font-size: 1.1rem;
      }

      .loading-box small {
        color: #6c757d;
        font-size: 0.9rem;
      }

      .spinner {
        margin: 0 auto 16px;
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

      .btn-secondary,
      .btn-danger,
      .btn-incidents {
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        color: #fff;
        cursor: pointer;
      }

      .btn-secondary {
        background: #2b6cb0;
      }

      .btn-danger {
        background: #c53030;
      }

      .btn-incidents {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-weight: 600;
        font-size: 0.95rem;
        padding: 10px 20px;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
        transition: all 0.3s ease;
      }

      .btn-incidents:hover {
        opacity: 0.9;
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }

      /* Workshop grouping and responsive adjustments */
      .workshop-groups {
        display: grid;
        gap: 16px;
      }

      .workshop-card details {
        border: none;
        border-radius: 16px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        padding: 16px;
        box-shadow: 0 4px 20px rgba(31, 38, 135, 0.1);
      }

      .workshop-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        list-style: none;
        cursor: pointer;
        padding: 12px;
        border-radius: 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #ffffff;
      }

      .workshop-title strong {
        font-size: 1.1rem;
        font-weight: 700;
      }

      .workshop-title .muted {
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.9rem;
        margin-left: 8px;
      }

      .workshop-totals {
        display: flex;
        gap: 16px;
        align-items: baseline;
        font-size: 0.95rem;
      }

      .workshop-totals .total {
        font-weight: 700;
        font-size: 1.1rem;
        color: #ffffff;
      }

      .workshop-totals .muted {
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.9rem;
      }

      .payments-list-inner {
        margin-top: 16px;
        display: grid;
        gap: 12px;
      }

      /* Responsive tweaks */
      @media (max-width: 720px) {
        .admin-wrap { 
          padding: 16px; 
        }
        
        .kpi-card p { 
          font-size: 1.2rem; 
        }
        
        .payment-grid { 
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); 
        }
        
        .panel-title { 
          flex-direction: column; 
          align-items: flex-start; 
        }
        
        .workshop-summary { 
          flex-direction: column; 
          align-items: flex-start; 
        }
        
        .workshop-totals { 
          gap: 8px; 
          font-size: 0.85rem;
          flex-wrap: wrap;
        }

        .admin-header h1 {
          font-size: 1.4rem;
        }

        .panel-block {
          padding: 20px;
        }
      }
    `
  ]
})
export class PaymentsAdminComponent implements OnInit, OnDestroy {
  private paymentService = inject(PaymentService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private subscription?: Subscription;

  isLoading = false;
  errorMessage: string | null = null;
  summary: PaymentAdminSummaryResponse | null = null;
  groupedPayments: Array<{ taller_id: number | null; taller_name: string; payments: PaymentListItemResponse[]; total_amount: number; total_commission: number; total_net: number }> = [];

  ngOnInit(): void {
    console.log('PaymentsAdminComponent: ngOnInit - iniciando carga de resumen');
    this.loadSummary();
  }

  ngOnDestroy(): void {
    // Cancelar suscripción al destruir el componente
    this.subscription?.unsubscribe();
  }

  loadSummary(): void {
    // Cancelar petición anterior si existe
    this.subscription?.unsubscribe();
    
    this.errorMessage = null;
    this.isLoading = true;
    this.summary = null;
    
    console.log('[PaymentsAdmin] Iniciando carga...');

    this.subscription = this.paymentService.getAdminSummary().pipe(
      timeout(60000),
      finalize(() => {
        console.log('[PaymentsAdmin] Finalizando petición');
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        console.log('[PaymentsAdmin] Datos recibidos:', response);
        this.summary = response;
        const payments: PaymentListItemResponse[] = response.payments || [];
        const workshops = response.workshops || [];
        const grouped: typeof this.groupedPayments = workshops.map((ws: any) => {
          const items = payments.filter((p) => p.taller_id === ws.taller_id);
          const total_amount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
          const total_commission = items.reduce((s, it) => s + (Number(it.commission) || 0), 0);
          const total_net = items.reduce((s, it) => s + (Number(it.net_amount_to_workshop) || 0), 0);
          return {
            taller_id: ws.taller_id,
            taller_name: ws.taller_name,
            payments: items,
            total_amount,
            total_commission,
            total_net
          };
        });
        const orphan = payments.filter((p) => !p.taller_id || p.taller_id === 0);
        if (orphan.length) {
          const total_amount = orphan.reduce((s, it) => s + (Number(it.amount) || 0), 0);
          const total_commission = orphan.reduce((s, it) => s + (Number(it.commission) || 0), 0);
          const total_net = orphan.reduce((s, it) => s + (Number(it.net_amount_to_workshop) || 0), 0);
          grouped.push({ taller_id: null, taller_name: 'Sin taller asignado', payments: orphan, total_amount, total_commission, total_net });
        }
        this.groupedPayments = grouped;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[PaymentsAdmin] Error:', err);
        if (err.name === 'TimeoutError') {
          this.errorMessage = 'El servidor tardó más de 60 segundos. Haz clic en el enlace "Pagos" nuevamente para reintentar.';
        } else if (err.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Verifica tu conexión.';
        } else if (err.status === 401) {
          this.errorMessage = 'Sesión expirada. Inicia sesión nuevamente.';
          setTimeout(() => this.logout(), 2000);
        } else if (err.status === 403) {
          this.errorMessage = 'No tienes permisos.';
        } else {
          this.errorMessage = err?.error?.detail || err?.message || 'No se pudo cargar el resumen.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    this.router.navigate(['/']);
  }

  goToIncidents(): void {
    this.router.navigate(['/admin/incidentes']);
  }

  getProofUrl(item: PaymentListItemResponse): string {
    return this.paymentService.getAbsoluteUrl(item.proof_image_url_absolute || item.proof_image_url);
  }

  getStatusLabel(status: string): string {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'pendiente') return 'Pendiente';
    if (normalized === 'verificacion') return 'En verificación';
    if (normalized === 'confirmado') return 'Confirmado';
    if (normalized === 'rechazado') return 'Rechazado';
    return status || 'Sin estado';
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
