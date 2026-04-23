import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminNavbarComponent } from './admin-navbar';
import { PaymentService, PaymentAdminSummaryResponse } from '../../core/services/payment.service';

@Component({
  selector: 'app-admin-commissions',
  standalone: true,
  imports: [CommonModule, AdminNavbarComponent],
  template: `
    <main class="admin-wrap">
      <app-admin-navbar></app-admin-navbar>

      <section class="panel-block">
        <div class="panel-title">
          <h2>Comisiones - Deuda por Taller</h2>
          <small *ngIf="summary">Generado: {{ summary.generated_at | date:'medium' }}</small>
        </div>

        <div *ngIf="isLoading" class="empty-box">Cargando resumen de comisiones...</div>
        <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>

        <div class="table-wrapper" *ngIf="summary && summary.workshops.length > 0">
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

        <div *ngIf="summary && summary.workshops.length === 0" class="empty-box">No hay registros de comisiones.</div>
      </section>
    </main>
  `,
  styles: [
    `
      .panel-block { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
      .panel-title { display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .table-wrapper { overflow-x:auto; }
      table { width:100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #edf2f7; text-align:left; padding:8px; font-size:0.95rem; }
      .empty-box { border:1px dashed #cbd5e0; padding:10px; border-radius:8px; color:#4a5568; }
      .error-box { color:#c53030; background:#fff5f5; border-radius:8px; padding:10px; border:1px solid #feb2b2; }
    `
  ]
})
export class AdminCommissionsComponent implements OnInit {
  private paymentService = inject(PaymentService);

  isLoading = false;
  errorMessage: string | null = null;
  summary: PaymentAdminSummaryResponse | null = null;

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.paymentService.getAdminSummary().subscribe({
      next: (res) => { this.summary = res; this.isLoading = false; },
      error: (err) => { this.errorMessage = err?.error?.detail || err?.message || 'No se pudo cargar el resumen.'; this.isLoading = false; }
    });
  }
}
