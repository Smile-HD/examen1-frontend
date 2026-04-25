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
        <a routerLink="/admin/reportes" routerLinkActive="active">Reportes</a>
      </div>

      <div class="nav-actions">
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
        gap: 16px;
        padding: 16px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.25);
        margin-bottom: 24px;
        transition: all 0.3s ease;
      }

      .admin-navbar:hover {
        box-shadow: 0 6px 28px rgba(102, 126, 234, 0.35);
        transform: translateY(-2px);
      }

      .logo { 
        font-weight: 700; 
        color: #ffffff;
        font-size: 1.15rem;
        letter-spacing: 0.3px;
      }

      .nav-links { 
        display:flex; 
        gap: 8px; 
        align-items: center; 
      }
      
      .nav-links a {
        text-decoration: none;
        padding: 10px 18px;
        border-radius: 10px;
        color: rgba(255, 255, 255, 0.85);
        font-weight: 600;
        font-size: 0.95rem;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }

      .nav-links a::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.1);
        transform: translateX(-100%);
        transition: transform 0.3s ease;
      }

      .nav-links a:hover::before {
        transform: translateX(0);
      }

      .nav-links a:hover {
        color: #ffffff;
      }

      .nav-links a.active { 
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        box-shadow: 0 2px 12px rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
      }

      .nav-actions { 
        display:flex; 
        gap: 10px; 
        align-items:center; 
      }

      .btn-secondary, .btn-danger { 
        border: none; 
        border-radius: 10px; 
        padding: 10px 18px; 
        color: #fff; 
        cursor:pointer;
        font-weight: 600;
        font-size: 0.9rem;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      
      .btn-secondary { 
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.35);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      
      .btn-danger { 
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }

      .btn-danger:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(245, 87, 108, 0.4);
      }

      @media (max-width:720px){
        .admin-navbar { 
          flex-direction: column; 
          align-items: flex-start;
          padding: 16px;
        }
        .nav-links{ 
          width:100%;
          flex-wrap: wrap;
        }
        .nav-actions{ 
          width:100%; 
          display:flex; 
          justify-content:space-between; 
        }
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
