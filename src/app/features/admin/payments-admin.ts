import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminNavbarComponent } from './admin-navbar';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
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
      </header>

      <section *ngIf="errorMessage" class="error-box">{{ errorMessage }}</section>
      <section *ngIf="isLoading" class="empty-box">Cargando resumen de pagos...</section>

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
            <small>Generado: {{ summary.generated_at | date:'medium' }}</small>
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
                      <small>{{ p.created_at | date:'medium' }}</small>
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
        background: linear-gradient(180deg, #f7fafc 0%, #edf2f7 100%);
        color: #1a202c;
      }

      .admin-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .admin-header h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      .admin-header p {
        margin: 6px 0 0;
        color: #4a5568;
      }

      .header-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .kpis-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }

      .kpi-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
      }

      .kpi-card h3 {
        margin: 0;
        font-size: 0.92rem;
        color: #4a5568;
      }

      .kpi-card p {
        margin: 8px 0 0;
        font-size: 1.2rem;
        font-weight: 700;
      }

      .panel-block {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 18px;
      }

      .panel-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }

      .panel-title h2 {
        margin: 0;
        font-size: 1.1rem;
      }

      .panel-title small {
        color: #4a5568;
      }

      .table-wrapper {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        border-bottom: 1px solid #edf2f7;
        text-align: left;
        padding: 8px;
        font-size: 0.9rem;
        white-space: nowrap;
      }

      .payments-list {
        display: grid;
        gap: 10px;
      }

      .payment-card {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px;
        background: #f8fafc;
      }

      .payment-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }

      .payment-head h3 {
        margin: 0;
        font-size: 0.98rem;
      }

      .payment-head small {
        color: #4a5568;
      }

      .payment-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 6px;
        margin-bottom: 8px;
      }

      .payment-grid p {
        margin: 0;
        font-size: 0.9rem;
      }

      .empty-box {
        border: 1px dashed #cbd5e0;
        border-radius: 8px;
        padding: 10px;
        background: #f7fafc;
        color: #4a5568;
      }

      .empty-inline {
        color: #718096;
        font-size: 0.88rem;
      }

      .error-box {
        border: 1px solid #feb2b2;
        color: #c53030;
        background: #fff5f5;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 10px;
      }

      .btn-secondary,
      .btn-danger {
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

      /* Workshop grouping and responsive adjustments */
      .workshop-groups {
        display: grid;
        gap: 12px;
      }

      .workshop-card details {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #fff;
        padding: 8px;
      }

      .workshop-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        list-style: none;
        cursor: pointer;
        padding: 6px 4px;
      }

      .workshop-title strong {
        font-size: 1.02rem;
      }

      .workshop-totals {
        display: flex;
        gap: 10px;
        align-items: baseline;
        color: #4a5568;
        font-size: 0.95rem;
      }

      .workshop-totals .total {
        font-weight: 700;
        color: #2b6cb0;
      }

      .payments-list-inner {
        margin-top: 8px;
        display: grid;
        gap: 8px;
      }

      /* Responsive tweaks */
      @media (max-width: 720px) {
        .admin-wrap { padding: 12px; }
        .kpi-card p { font-size: 1rem; }
        .payment-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
        .panel-title { flex-direction: column; align-items: flex-start; }
        .workshop-summary { flex-direction: column; align-items: flex-start; }
        .workshop-totals { gap: 6px; font-size: 0.9rem; }
      }
    `
  ]
})
export class PaymentsAdminComponent implements OnInit {
  private paymentService = inject(PaymentService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  isLoading = false;
  errorMessage: string | null = null;
  summary: PaymentAdminSummaryResponse | null = null;
  groupedPayments: Array<{ taller_id: number | null; taller_name: string; payments: PaymentListItemResponse[]; total_amount: number; total_commission: number; total_net: number }> = [];

  ngOnInit(): void {
    console.log('PaymentsAdminComponent: ngOnInit - iniciando carga de resumen');
    this.loadSummary();
  }

  loadSummary(): void {
    this.errorMessage = null;
    this.isLoading = true;
    console.log('PaymentsAdminComponent: loadSummary - inicio', { time: new Date().toISOString(), hasToken: !!localStorage.getItem('access_token') });

    this.paymentService.getAdminSummary().pipe(
      timeout(15000), // Reducir un poco el timeout para que el usuario no espere tanto
      finalize(() => {
        try {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        } catch {}
      })
    ).subscribe({
      next: (response) => {
        try {
          this.ngZone.run(() => {
            this.summary = response;
            // Agrupar pagos por taller para mostrar por secciones
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
            // pagos sin taller
            const orphan = payments.filter((p) => !p.taller_id || p.taller_id === 0);
            if (orphan.length) {
              const total_amount = orphan.reduce((s, it) => s + (Number(it.amount) || 0), 0);
              const total_commission = orphan.reduce((s, it) => s + (Number(it.commission) || 0), 0);
              const total_net = orphan.reduce((s, it) => s + (Number(it.net_amount_to_workshop) || 0), 0);
              grouped.push({ taller_id: null, taller_name: 'Sin taller asignado', payments: orphan, total_amount, total_commission, total_net });
            }
            this.groupedPayments = grouped;
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        } catch (e) {
          console.error('Error al actualizar UI en NgZone:', e);
        }
      },
      error: (err) => {
        try {
          this.ngZone.run(() => {
            console.error('Error cargando resumen:', err);
            if (err.name === 'TimeoutError') {
              this.errorMessage = 'El servidor está tardando demasiado en responder. Es posible que esté iniciando (Cold Start). Por favor, intenta de nuevo en unos segundos.';
            } else {
              this.errorMessage = err?.error?.detail || err?.message || 'No se pudo cargar el resumen global de pagos. Verifica tu conexión o sesión.';
            }
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        } catch (e) {
          console.error('Error al manejar error en NgZone:', e);
        }
      }
    });
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    this.router.navigate(['/']);
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
}
