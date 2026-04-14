import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegisterRequest, RegisterResponse } from '../models/auth.model';
import { LoginRequest, LoginResponse } from '../models/auth.login.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  // Nota: Utilizando variable de entorno para que funcione tanto local como en nube
  private usuariosUrl = `${environment.apiUrl}/usuarios`;
  private authUrl = `${environment.apiUrl}/auth`;

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.usuariosUrl}/registro`, data);
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.authUrl}/login`, data);
  }
}
