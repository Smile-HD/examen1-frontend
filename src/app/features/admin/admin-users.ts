import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AdminNavbarComponent } from './admin-navbar';
import { UserService, AdminUserDto } from '../../core/services/user.service';

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

        <div *ngIf="isLoading" class="empty-box">Cargando usuarios...</div>
        <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>

        <div *ngIf="!isLoading && users.length > 0">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Roles</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of users">
                <td>{{ u.id }}</td>
                <td>{{ u.nombre || '-' }}</td>
                <td>{{ u.correo || '-' }}</td>
                <td>{{ u.roles?.join(', ') || '-' }}</td>
                <td>{{ u.creado_en || '-' }}</td>
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
      .admin-wrap { padding: 18px; }
      .admin-table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #edf2f7; text-align: left; }
      th { color: #4a5568; font-weight: 700; }
      .panel-block { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
      .panel-title h2 { margin: 0 0 10px 0; }
      .empty-box { color: #4a5568; border: 1px dashed #cbd5e0; padding: 10px; border-radius: 8px; }
      .error-box { color: #c53030; background: #fff5f5; border: 1px solid #feb2b2; padding: 10px; border-radius: 8px; }
    `
  ]
})
export class AdminUsersComponent implements OnInit {
  private userService = inject(UserService);

  users: AdminUser[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.errorMessage = null;
    this.isLoading = true;

    this.userService.listUsers().subscribe({
      next: (res) => { this.users = Array.isArray(res) ? res : []; this.isLoading = false; },
      error: (err) => { this.errorMessage = err?.error?.detail || err?.message || 'No se pudieron cargar los usuarios.'; this.isLoading = false; }
    });
  }
}
