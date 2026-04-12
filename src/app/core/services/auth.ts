import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegisterRequest, RegisterResponse } from '../models/auth.model';
import { LoginRequest, LoginResponse } from '../models/auth.login.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  // Nota: Deberías configurar enviroments, o usar la ruta relativa al proxy.
  private usuariosUrl = '/api/v1/usuarios';
  private authUrl = '/api/v1/auth';

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.usuariosUrl}/registro`, data);
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.authUrl}/login`, data);
  }
}
