import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { RegisterRequest } from '../../../core/models/auth.model';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  registerForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    telefono: ['', [Validators.maxLength(25)]],
    nombre_taller: ['', [Validators.required, Validators.maxLength(150)]],
    ubicacion_taller: ['', [Validators.maxLength(500)]]
  });

  errorMessage = '';
  successMessage = '';

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const payload: RegisterRequest = { 
      ...this.registerForm.getRawValue(),
      tipo_usuario: 'taller'
    } as RegisterRequest;

    this.authService.register(payload).subscribe({
      next: (res) => {
        this.successMessage = res.mensaje;
        this.errorMessage = '';
        this.registerForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.error && err.error.detail) {
          if (Array.isArray(err.error.detail)) {
            this.errorMessage = err.error.detail.map((e: any) => e.msg).join(', ');
          } else {
            this.errorMessage = err.error.detail;
          }
        } else if (err.error && err.error.mensaje) {
          this.errorMessage = err.error.mensaje;
        } else if (err.status === 0 || !err.ok) {
          this.errorMessage = 'La API no responde o hay problemas de conexión.';
        } else {
          this.errorMessage = 'Ocurrió un error inesperado durante el registro.';
        }
        this.successMessage = '';
        this.cdr.detectChanges();
      }
    });
  }
}
