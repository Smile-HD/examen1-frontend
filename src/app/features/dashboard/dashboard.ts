import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  
  // Nombre del taller simulado por defecto
  tallerNombre = 'Taller Mecánico';

  ngOnInit() {
    // Al inicializar el componente, leemos la información del usuario desde el localStorage
    // Esta información fue guardada previamente durante el login (LoginComponent)
    const userInfo = localStorage.getItem('user_info');
    
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        // Si el payload contiene el nombre del usuario o taller, lo asignamos para la vista
        this.tallerNombre = parsed.nombre || 'Taller Registrado';
      } catch (e) {
        console.error('Error al mapear información del usuario:', e);
      }
    }
  }

  // Función para cerrar la sesión actual
  logout() {
    // 1. Limpiamos los tokens y credenciales almacenadas localmente
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    
    // 2. Redirigimos al usuario a la pantalla del landing (o de inicio)
    this.router.navigate(['/']);
  }
}