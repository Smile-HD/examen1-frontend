import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminUserDto {
  id: number;
  nombre?: string;
  correo?: string;
  roles?: string[];
  creado_en?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/usuarios`;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  listUsers(): Observable<AdminUserDto[]> {
    return this.http.get<AdminUserDto[]>(this.baseUrl, { headers: this.getHeaders() });
  }
}
