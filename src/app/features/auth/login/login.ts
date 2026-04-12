import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { LoginRequest } from '../../../core/models/auth.login.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loginForm = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]]
  });

  errorMessage = '';
  isAuthenticating = false;

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isAuthenticating = true;
    this.errorMessage = '';

    const payload: LoginRequest = { 
      ...this.loginForm.getRawValue(),
      canal: 'web' // Aplicación Web de talleres
    };

    this.authService.login(payload).subscribe({
      next: (res) => {
        this.isAuthenticating = false;
        // Almacenar token
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('user_info', JSON.stringify(res));

        // Redirigir a panel principal del taller
        this.router.navigate(['/dashboard']); 
      },
      error: (err) => {
        this.isAuthenticating = false;
        if (err.error && err.error.detail) {
          if (Array.isArray(err.error.detail)) {
            this.errorMessage = err.error.detail.map((e: any) => e.msg).join(', ');
          } else {
            this.errorMessage = err.error.detail;
          }
        } else if (err.error && err.error.mensaje) {
          this.errorMessage = err.error.mensaje;
        } else if (err.status === 0 || !err.ok) {
          this.errorMessage = 'Error de conexión. Asegúrate de que el servidor esté en línea.';
        } else {
          this.errorMessage = 'Ocurrió un error inesperado.';
        }
        
        // Forzar actualización visual si falta contexto de Zona
        this.cdr.detectChanges();
      }
    });
  }
}
