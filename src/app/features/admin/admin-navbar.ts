import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="admin-navbar">
      <div class="nav-left">
        <div class="logo">Panel de Superusuario</div>
      </div>

      <div class="nav-links">
        <a routerLink="/admin/pagos" routerLinkActive="active">Pagos</a>
        <a routerLink="/admin/usuarios" routerLinkActive="active">Usuarios</a>
        <a routerLink="/admin/comisiones" routerLinkActive="active">Comisiones</a>
      </div>

      <div class="nav-actions">
        <button class="btn-secondary" type="button" (click)="refresh()">Actualizar</button>
        <button class="btn-danger" type="button" (click)="logout()">Cerrar sesión</button>
      </div>
    </nav>
  `,
  styles: [
    `
      :host { display:block; }
      .admin-navbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: linear-gradient(90deg, #ffffff 0%, #f7fafc 100%);
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        margin-bottom: 14px;
      }

      .logo { font-weight: 700; color: #1a202c; }

      .nav-links { display:flex; gap: 12px; align-items: center; }
      .nav-links a {
        text-decoration: none;
        padding: 8px 12px;
        border-radius: 8px;
        color: #2b6cb0;
        font-weight: 600;
      }

      .nav-links a.active { background: #ebf8ff; box-shadow: 0 2px 6px rgba(66,153,225,0.08); }

      .nav-actions { display:flex; gap: 8px; align-items:center; }

      .btn-secondary, .btn-danger { border: none; border-radius: 8px; padding: 8px 12px; color: #fff; cursor:pointer; }
      .btn-secondary { background: linear-gradient(135deg,#4299e1 0%,#3182ce 100%); }
      .btn-danger { background: #c53030; }

      @media (max-width:720px){
        .admin-navbar { flex-direction: column; align-items: flex-start; }
        .nav-links{ width:100%; }
        .nav-actions{ width:100%; display:flex; justify-content:space-between; }
      }
    `
  ]
})
export class AdminNavbarComponent {
  private router = inject(Router);

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    this.router.navigate(['/']);
  }

  refresh(): void {
    try { window.location.reload(); } catch { /* noop */ }
  }
}
