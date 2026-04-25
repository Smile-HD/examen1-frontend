import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AdminNavbarComponent } from './admin-navbar';
import { UserService, AdminUserDto } from '../../core/services/user.service';
import { timeout, finalize } from 'rxjs/operators';
import { Subscription } from 'rxjs';

type AdminUser = AdminUserDto;

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, HttpClientModule, AdminNavbarComponent],
  template: `
    <main class="admin-wrap">
      <app-admin-navbar></app-admin-navbar>

      <section class="panel-block">
        <div class="panel-title"><h2>Usuarios registrados</h2></div>

        <div *ngIf="isLoading" class="loading-box">
          <div class="spinner"></div>
          <p><strong>Cargando usuarios...</strong></p>
        </div>
        <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>
        <div *ngIf="successMessage" class="success-box">{{ successMessage }}</div>

        <div *ngIf="!isLoading && users.length > 0">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Roles</th>
                <th>Fecha de Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of users">
                <td><span class="badge-id">{{ u.id }}</span></td>
                <td><strong>{{ u.nombre || '-' }}</strong></td>
                <td class="email-cell">{{ u.correo || '-' }}</td>
                <td><span class="badge-roles">{{ u.roles?.join(', ') || '-' }}</span></td>
                <td class="date-cell">{{ formatBoliviaDate(u.creado_en) }}</td>
                <td>
                  <button 
                    class="btn-delete" 
                    (click)="confirmDelete(u)"
                    [disabled]="deletingUserId === u.id"
                    title="Eliminar usuario">
                    {{ deletingUserId === u.id ? 'Eliminando...' : 'Eliminar' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="!isLoading && users.length === 0" class="empty-box">No hay usuarios registrados.</div>
      </section>
    </main>
  `,
  styles: [
    `
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
      }
      
      .panel-title h2 { 
        margin: 0 0 24px 0;
        font-size: 1.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .admin-table { 
        width: 100%; 
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        border-radius: 12px;
      }
      
      th, td { 
        padding: 16px 14px; 
        text-align: left;
      }
      
      th { 
        color: #ffffff;
        font-weight: 700;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-bottom: 3px solid rgba(255, 255, 255, 0.2);
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
        font-size: 0.95rem;
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

      .badge-roles {
        display: inline-block;
        padding: 6px 12px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: #ffffff;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        text-transform: capitalize;
      }

      .email-cell {
        color: #667eea;
        font-weight: 500;
      }

      .date-cell {
        color: #6c757d;
        font-size: 0.9rem;
        white-space: nowrap;
      }

      tbody tr:last-child td:first-child {
        border-bottom-left-radius: 12px;
      }

      tbody tr:last-child td:last-child {
        border-bottom-right-radius: 12px;
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

      .btn-delete {
        background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
        color: #ffffff;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        transition: opacity 0.3s ease;
        box-shadow: 0 2px 8px rgba(245, 87, 108, 0.3);
      }

      .btn-delete:hover:not(:disabled) {
        opacity: 0.9;
      }

      .btn-delete:disabled {
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

        .admin-table {
          font-size: 0.85rem;
        }

        th, td {
          padding: 12px 8px;
        }
      }
    `
  ]
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;

  users: AdminUser[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  deletingUserId: number | null = null;

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    // Cancelar suscripción al destruir el componente
    this.subscription?.unsubscribe();
  }

  loadUsers(): void {
    // Cancelar petición anterior si existe
    this.subscription?.unsubscribe();
    
    this.errorMessage = null;
    this.successMessage = null;
    this.isLoading = true;
    this.users = [];

    console.log('[AdminUsers] Iniciando carga de usuarios...');

    this.subscription = this.userService.listUsers().pipe(
      timeout(60000),
      finalize(() => {
        console.log('[AdminUsers] Finalizando petición');
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res) => { 
        console.log('[AdminUsers] Datos recibidos:', res);
        this.users = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: (err) => { 
        console.error('[AdminUsers] Error:', err);
        if (err.name === 'TimeoutError') {
          this.errorMessage = 'El servidor tardó más de 60 segundos. Haz clic en el enlace "Usuarios" nuevamente para reintentar.';
        } else if (err.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Verifica tu conexión.';
        } else if (err.status === 401) {
          this.errorMessage = 'Sesión expirada. Inicia sesión nuevamente.';
        } else if (err.status === 403) {
          this.errorMessage = 'No tienes permisos.';
        } else {
          this.errorMessage = err?.error?.detail || err?.message || 'No se pudieron cargar los usuarios.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  confirmDelete(user: AdminUser): void {
    const confirmMsg = `¿Estás seguro de eliminar al usuario "${user.nombre}" (${user.correo})?\n\nEsta acción no se puede deshacer.`;
    
    if (confirm(confirmMsg)) {
      this.deleteUser(user.id);
    }
  }

  deleteUser(userId: number): void {
    this.deletingUserId = userId;
    this.errorMessage = null;
    this.successMessage = null;

    this.userService.deleteUser(userId).subscribe({
      next: (res) => {
        console.log('[AdminUsers] Usuario eliminado:', res);
        this.successMessage = res.message || 'Usuario eliminado correctamente.';
        this.deletingUserId = null;
        // Recargar la lista de usuarios
        this.loadUsers();
      },
      error: (err) => {
        console.error('[AdminUsers] Error al eliminar:', err);
        if (err.name === 'TimeoutError') {
          this.errorMessage = 'El servidor tardó demasiado en responder.';
        } else if (err.status === 404) {
          this.errorMessage = 'Usuario no encontrado.';
        } else if (err.status === 400) {
          this.errorMessage = err?.error?.detail || 'No se puede eliminar este usuario.';
        } else {
          this.errorMessage = err?.error?.detail || err?.message || 'Error al eliminar usuario.';
        }
        this.deletingUserId = null;
      }
    });
  }

  formatBoliviaDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    
    try {
      // Parsear la fecha ISO
      const date = new Date(dateString);
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) return dateString;
      
      // Formatear para Bolivia (BOT, UTC-4)
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
