import { Component, OnInit, inject, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminNavbarComponent } from './admin-navbar';
import { 
  PaymentService, 
  PaymentAdminSummaryResponse, 
  PaymentWorkshopSummaryItemResponse,
  CommissionPaymentListItemResponse 
} from '../../core/services/payment.service';
import { timeout, finalize } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-commissions',
  standalone: true,
  imports: [CommonModule, AdminNavbarComponent],
  template: `
    <main class="admin-wrap">
      <app-admin-navbar></app-admin-navbar>

      <!-- Sección QR de Plataforma -->
      <section class="panel-block qr-section">
        <div class="panel-title">
          <h2>QR de Pago de la Plataforma</h2>
        </div>

        <div *ngIf="errorMessageQr" class="error-box">{{ errorMessageQr }}</div>
        <div *ngIf="successMessageQr" class="success-box">{{ successMessageQr }}</div>

        <div class="qr-upload-container">
          <input 
            type="file" 
            #qrFileInput 
            (change)="onQrFileSelected($event)" 
            accept="image/*"
            style="display: none;">
          
          <button 
            class="btn-upload-qr" 
            (click)="qrFileInput.click()"
            [disabled]="uploadingQr">
            {{ uploadingQr ? 'Subiendo...' : 'Subir QR de Plataforma' }}
          </button>
          
          <p class="help-text">Sube el QR que los talleres usarán para pagar sus comisiones</p>
        </div>
      </section>

      <!-- Sección Pagos de Comisiones -->
      <section class="panel-block" *ngIf="commissionPayments && commissionPayments.length > 0">
        <div class="panel-title">
          <h2>Pagos de Comisiones Recibidos</h2>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Taller</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let payment of commissionPayments">
                <td><span class="badge-id">{{ payment.payment_id }}</span></td>
                <td>{{ payment.taller_name }}</td>
                <td><strong>Bs. {{ payment.amount | number:'1.2-2' }}</strong></td>
                <td><span class="badge-status" [class]="'status-' + payment.status">{{ payment.status }}</span></td>
                <td>
                  <a *ngIf="payment.proof_image_url_absolute" 
                     [href]="payment.proof_image_url_absolute" 
                     target="_blank"
                     class="link-proof">Ver comprobante</a>
                  <span *ngIf="!payment.proof_image_url_absolute">-</span>
                </td>
                <td class="date-cell">{{ formatBoliviaDate(payment.created_at) }}</td>
                <td>
                  <div class="action-buttons" *ngIf="payment.status === 'verificacion'">
                    <button 
                      class="btn-confirm" 
                      (click)="confirmCommissionPayment(payment.payment_id)"
                      [disabled]="processingPaymentId === payment.payment_id"
                      title="Confirmar pago">
                      Confirmar
                    </button>
                    <button 
                      class="btn-reject" 
                      (click)="rejectCommissionPayment(payment.payment_id)"
                      [disabled]="processingPaymentId === payment.payment_id"
                      title="Rechazar pago">
                      Rechazar
                    </button>
                  </div>
                  <span *ngIf="payment.status !== 'verificacion'" class="text-muted">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Sección Resumen de Comisiones -->
      <section class="panel-block">
        <div class="panel-title">
          <h2>Comisiones - Deuda por Taller</h2>
          <small *ngIf="summary" class="date-badge">{{ formatBoliviaDate(summary.generated_at) }}</small>
        </div>

        <div *ngIf="isLoading" class="loading-box">
          <div class="spinner"></div>
          <p><strong>Cargando resumen de comisiones...</strong></p>
        </div>
        <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>
        <div *ngIf="successMessage" class="success-box">{{ successMessage }}</div>

        <div class="table-wrapper" *ngIf="summary && summary.workshops.length > 0">
          <table>
            <thead>
              <tr>
                <th>Taller</th>
                <th>Estado</th>
                <th>Total pagos</th>
                <th>Confirmados</th>
                <th>Verificación</th>
                <th>Rechazados</th>
                <th>Monto total</th>
                <th>Comisión total</th>
                <th>Neto taller</th>
                <th>Debe pagar a plataforma</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let ws of summary.workshops">
                <td>{{ ws.taller_name }} (#{{ ws.taller_id }})</td>
                <td>
                  <span class="badge-status" [class]="'status-' + ws.taller_estado">
                    {{ ws.taller_estado === 'activo' ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>{{ ws.total_payments }}</td>
                <td>{{ ws.confirmed_payments }}</td>
                <td>{{ ws.verification_payments }}</td>
                <td>{{ ws.rejected_payments }}</td>
                <td>Bs. {{ ws.total_amount | number:'1.2-2' }}</td>
                <td>Bs. {{ ws.total_commission | number:'1.2-2' }}</td>
                <td>Bs. {{ ws.total_net_to_workshop | number:'1.2-2' }}</td>
                <td><strong>Bs. {{ ws.amount_due_to_platform | number:'1.2-2' }}</strong></td>
                <td>
                  <button 
                    *ngIf="ws.taller_estado === 'activo'"
                    class="btn-deactivate" 
                    (click)="confirmDeactivate(ws)"
                    [disabled]="updatingTallerId === ws.taller_id"
                    title="Dar de baja al taller">
                    {{ updatingTallerId === ws.taller_id ? 'Procesando...' : 'Dar de baja' }}
                  </button>
                  <button 
                    *ngIf="ws.taller_estado === 'inactivo'"
                    class="btn-reactivate" 
                    (click)="confirmReactivate(ws)"
                    [disabled]="updatingTallerId === ws.taller_id"
                    title="Reactivar taller">
                    {{ updatingTallerId === ws.taller_id ? 'Procesando...' : 'Reactivar' }}
                  </button>
                </td>
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
      :host {
        display: block;
      }

      .admin-wrap {
        padding: 24px;
        min-height: 100vh;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }

      .panel-block { 
        background: #ffffff;
        border: none;
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
        backdrop-filter: blur(10px);
        margin-bottom: 24px;
      }

      .qr-section {
        background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
      }

      .qr-upload-container {
        text-align: center;
        padding: 20px;
      }

      .btn-upload-qr {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #ffffff;
        border: none;
        padding: 12px 32px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: opacity 0.3s ease;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .btn-upload-qr:hover:not(:disabled) {
        opacity: 0.9;
      }

      .btn-upload-qr:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .help-text {
        margin-top: 12px;
        color: #6c757d;
        font-size: 0.9rem;
      }

      .panel-title { 
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }

      .panel-title h2 {
        margin: 0;
        font-size: 1.5rem;
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

      .table-wrapper { 
        overflow-x:auto;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      table { 
        width:100%;
        border-collapse: separate;
        border-spacing: 0;
      }

      th, td { 
        text-align:left;
        padding: 16px 12px;
        font-size:0.95rem;
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

      .badge-id {
        display: inline-block;
        padding: 4px 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #ffffff;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.85rem;
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

      .status-verificacion {
        background: #17a2b8;
        color: #fff;
      }

      .status-confirmado {
        background: #28a745;
        color: #fff;
      }

      .status-rechazado {
        background: #dc3545;
        color: #fff;
      }

      .status-activo {
        background: #28a745;
        color: #fff;
      }

      .status-inactivo {
        background: #6c757d;
        color: #fff;
      }

      .link-proof {
        color: #667eea;
        text-decoration: none;
        font-weight: 600;
      }

      .link-proof:hover {
        text-decoration: underline;
      }

      .date-cell {
        color: #6c757d;
        font-size: 0.9rem;
        white-space: nowrap;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
      }

      .btn-confirm {
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: #ffffff;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
        transition: opacity 0.3s ease;
      }

      .btn-confirm:hover:not(:disabled) {
        opacity: 0.9;
      }

      .btn-confirm:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-reject {
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        color: #ffffff;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
        transition: opacity 0.3s ease;
      }

      .btn-reject:hover:not(:disabled) {
        opacity: 0.9;
      }

      .btn-reject:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .text-muted {
        color: #6c757d;
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

      .success-box { 
        color: #28a745;
        background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
        border: 2px solid #c3e6cb;
        padding: 20px;
        border-radius: 16px;
        font-weight: 500;
        box-shadow: 0 4px 16px rgba(40, 167, 69, 0.15);
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

      .btn-deactivate {
        background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
        color: #ffffff;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        transition: opacity 0.3s ease;
        box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
      }

      .btn-deactivate:hover:not(:disabled) {
        opacity: 0.9;
      }

      .btn-deactivate:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-reactivate {
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: #ffffff;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        transition: opacity 0.3s ease;
        box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
      }

      .btn-reactivate:hover:not(:disabled) {
        opacity: 0.9;
      }

      .btn-reactivate:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      @media (max-width: 768px) {
        .admin-wrap {
          padding: 16px;
        }

        .panel-block {
          padding: 20px;
        }

        th, td {
          padding: 12px 8px;
          font-size: 0.85rem;
        }

        .action-buttons {
          flex-direction: column;
        }
      }
    `
  ]
})
export class AdminCommissionsComponent implements OnInit, OnDestroy {
  @ViewChild('qrFileInput') qrFileInput!: ElementRef<HTMLInputElement>;
  
  private paymentService = inject(PaymentService);
  private cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;

  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  summary: PaymentAdminSummaryResponse | null = null;
  updatingTallerId: number | null = null;

  // QR Upload
  uploadingQr = false;
  errorMessageQr: string | null = null;
  successMessageQr: string | null = null;

  // Commission Payments
  commissionPayments: CommissionPaymentListItemResponse[] = [];
  processingPaymentId: number | null = null;

  ngOnInit(): void {
    this.loadSummary();
    this.loadCommissionPayments();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onQrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.uploadQr(file);
    }
  }

  uploadQr(file: File): void {
    this.uploadingQr = true;
    this.errorMessageQr = null;
    this.successMessageQr = null;

    this.paymentService.uploadPlatformQr(file).pipe(
      timeout(30000),
      finalize(() => {
        this.uploadingQr = false;
      })
    ).subscribe({
      next: (res: any) => {
        console.log('[AdminCommissions] QR subido:', res);
        this.successMessageQr = res.message || 'QR de plataforma subido correctamente.';
      },
      error: (err: any) => {
        console.error('[AdminCommissions] Error al subir QR:', err);
        this.errorMessageQr = err?.error?.detail || err?.message || 'Error al subir QR.';
      }
    });
  }

  loadCommissionPayments(): void {
    this.paymentService.getAllCommissionPayments().pipe(
      timeout(30000)
    ).subscribe({
      next: (res: any) => {
        console.log('[AdminCommissions] Pagos de comisiones:', res);
        this.commissionPayments = res.payments;
      },
      error: (err: any) => {
        console.error('[AdminCommissions] Error al cargar pagos:', err);
      }
    });
  }

  confirmCommissionPayment(paymentId: number): void {
    if (!confirm('¿Confirmar este pago de comisión?')) return;

    this.processingPaymentId = paymentId;
    this.errorMessage = null;
    this.successMessage = null;

    this.paymentService.confirmCommissionPayment({ payment_id: paymentId }).pipe(
      timeout(30000),
      finalize(() => {
        this.processingPaymentId = null;
      })
    ).subscribe({
      next: (res: any) => {
        console.log('[AdminCommissions] Pago confirmado:', res);
        this.successMessage = res.message || 'Pago confirmado correctamente.';
        this.loadCommissionPayments();
        this.loadSummary();
      },
      error: (err: any) => {
        console.error('[AdminCommissions] Error al confirmar:', err);
        this.errorMessage = err?.error?.detail || err?.message || 'Error al confirmar pago.';
      }
    });
  }

  rejectCommissionPayment(paymentId: number): void {
    const reason = prompt('Motivo del rechazo (opcional):');
    if (reason === null) return; // Usuario canceló

    this.processingPaymentId = paymentId;
    this.errorMessage = null;
    this.successMessage = null;

    this.paymentService.rejectCommissionPayment({ payment_id: paymentId, reason }).pipe(
      timeout(30000),
      finalize(() => {
        this.processingPaymentId = null;
      })
    ).subscribe({
      next: (res: any) => {
        console.log('[AdminCommissions] Pago rechazado:', res);
        this.successMessage = res.message || 'Pago rechazado correctamente.';
        this.loadCommissionPayments();
      },
      error: (err: any) => {
        console.error('[AdminCommissions] Error al rechazar:', err);
        this.errorMessage = err?.error?.detail || err?.message || 'Error al rechazar pago.';
      }
    });
  }

  loadSummary(): void {
    this.subscription?.unsubscribe();
    
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.summary = null;
    
    console.log('[AdminCommissions] Iniciando carga...');
    
    this.subscription = this.paymentService.getAdminSummary().pipe(
      timeout(60000),
      finalize(() => {
        console.log('[AdminCommissions] Finalizando petición');
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res) => { 
        console.log('[AdminCommissions] Datos recibidos:', res);
        this.summary = res;
        this.cdr.detectChanges();
      },
      error: (err) => { 
        console.error('[AdminCommissions] Error:', err);
        if (err.name === 'TimeoutError') {
          this.errorMessage = 'El servidor tardó más de 60 segundos. Haz clic en el enlace "Comisiones" nuevamente para reintentar.';
        } else if (err.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Verifica tu conexión.';
        } else if (err.status === 401) {
          this.errorMessage = 'Sesión expirada. Inicia sesión nuevamente.';
        } else if (err.status === 403) {
          this.errorMessage = 'No tienes permisos.';
        } else {
          this.errorMessage = err?.error?.detail || err?.message || 'No se pudo cargar el resumen.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  confirmDeactivate(workshop: PaymentWorkshopSummaryItemResponse): void {
    const confirmMsg = `¿Estás seguro de dar de baja al taller "${workshop.taller_name}"?\n\nEsto desactivará el taller por no pagar sus comisiones. Esta acción puede revertirse posteriormente.`;
    
    if (confirm(confirmMsg)) {
      this.deactivateWorkshop(workshop.taller_id, workshop.taller_name);
    }
  }

  confirmReactivate(workshop: PaymentWorkshopSummaryItemResponse): void {
    const confirmMsg = `¿Estás seguro de reactivar al taller "${workshop.taller_name}"?\n\nEsto permitirá que el taller vuelva a recibir solicitudes de emergencia.`;
    
    if (confirm(confirmMsg)) {
      this.reactivateWorkshop(workshop.taller_id, workshop.taller_name);
    }
  }

  deactivateWorkshop(tallerId: number, tallerName: string): void {
    this.updatingTallerId = tallerId;
    this.errorMessage = null;
    this.successMessage = null;

    this.paymentService.updateWorkshopStatus(tallerId, 'inactivo').pipe(
      timeout(30000),
      finalize(() => {
        this.updatingTallerId = null;
      })
    ).subscribe({
      next: (res: any) => {
        console.log('[AdminCommissions] Taller desactivado:', res);
        this.successMessage = res.message || `Taller "${tallerName}" dado de baja correctamente.`;
        this.loadSummary();
      },
      error: (err: any) => {
        console.error('[AdminCommissions] Error al desactivar:', err);
        if (err.name === 'TimeoutError') {
          this.errorMessage = 'El servidor tardó demasiado en responder.';
        } else if (err.status === 404) {
          this.errorMessage = 'Taller no encontrado.';
        } else {
          this.errorMessage = err?.error?.detail || err?.message || 'Error al dar de baja al taller.';
        }
      }
    });
  }

  reactivateWorkshop(tallerId: number, tallerName: string): void {
    this.updatingTallerId = tallerId;
    this.errorMessage = null;
    this.successMessage = null;

    this.paymentService.updateWorkshopStatus(tallerId, 'activo').pipe(
      timeout(30000),
      finalize(() => {
        this.updatingTallerId = null;
      })
    ).subscribe({
      next: (res: any) => {
        console.log('[AdminCommissions] Taller reactivado:', res);
        this.successMessage = res.message || `Taller "${tallerName}" reactivado correctamente.`;
        this.loadSummary();
      },
      error: (err: any) => {
        console.error('[AdminCommissions] Error al reactivar:', err);
        if (err.name === 'TimeoutError') {
          this.errorMessage = 'El servidor tardó demasiado en responder.';
        } else if (err.status === 404) {
          this.errorMessage = 'Taller no encontrado.';
        } else {
          this.errorMessage = err?.error?.detail || err?.message || 'Error al reactivar al taller.';
        }
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
}
