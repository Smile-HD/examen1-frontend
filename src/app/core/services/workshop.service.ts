import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WorkshopTechnicianListItemResponse {
  usuario_id: number;
  nombre: string;
  correo: string;
  estado_tecnico: string;
  telefono: string | null;
}

export interface WorkshopTechnicianLocationItem {
  usuario_id: number;
  nombre: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  ultima_actualizacion_gps: string | null;
}

export interface WorkshopTechnicianCandidateResponse {
  usuario_id: number;
  nombre: string;
  correo: string;
}

export interface WorkshopTechnicianAssignRequest {
  usuario_id: number;
}

export interface WorkshopTechnicianUnassignRequest {
  tecnico_id: number;
  motivo?: string | null;
}

export interface WorkshopIncidentHistoryItemResponse {
  incidente_id: number;
  fecha_incidente: string;
  tipo_problema: string;
  estado_actual: string;
  vehiculo_placa: string;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  monto_total: number | null;
  calificacion_promedio: number | null;
}

export interface WorkshopIncidentHistoryResponse {
  taller_nombre: string;
  total_incidentes: number;
  historial: WorkshopIncidentHistoryItemResponse[];
}

export interface WorkshopVehicleCreateRequest {
  tipo: 'vagoneta' | 'sedan' | 'grua' | 'camion' | 'bus';
  placa: string;
  estado?: 'disponible' | 'asignado' | 'mantenimiento' | 'inactivo';
}

export interface WorkshopVehicleUpdateRequest {
  tipo?: 'vagoneta' | 'sedan' | 'grua' | 'camion' | 'bus';
  placa?: string;
  estado?: 'disponible' | 'asignado' | 'mantenimiento' | 'inactivo';
}

export interface WorkshopVehicleResponse {
  id: number;
  taller_id: number;
  tipo: string;
  placa: string;
  estado: string;
}

export interface WorkshopVehicleDeleteResponse {
  id: number;
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkshopService {
  private http = inject(HttpClient);
  // Usa la url del backend
  private apiUrl = `${environment.apiUrl}/taller`;
  private incidentUrl = `${environment.apiUrl}/incidentes`;

  getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Buscar técnicos por nombre
  searchTechnicians(nombre: string): Observable<WorkshopTechnicianCandidateResponse[]> {
    return this.http.get<WorkshopTechnicianCandidateResponse[]>(`${this.apiUrl}/tecnicos/buscar`, {
      params: { nombre },
      headers: this.getHeaders()
    });
  }

  // Asignar técnico al taller
  assignTechnician(data: WorkshopTechnicianAssignRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tecnicos/asignar`, data, { headers: this.getHeaders() });
  }

  // Desvincular un técnico (fuego/desasignar)
  unassignTechnician(data: WorkshopTechnicianUnassignRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tecnicos/desasignar`, data, { headers: this.getHeaders() });
  }

  // Listar técnicos de un taller
  getTechnicians(): Observable<WorkshopTechnicianListItemResponse[]> {
    return this.http.get<WorkshopTechnicianListItemResponse[]>(`${this.apiUrl}/tecnicos`, { headers: this.getHeaders() });
  }

  // Ubicaciones de los técnicos
  getTechnicianLocations(): Observable<WorkshopTechnicianLocationItem[]> {
    return this.http.get<WorkshopTechnicianLocationItem[]>(`${this.apiUrl}/tecnicos/ubicaciones`, { headers: this.getHeaders() });
  }

  // Historial del taller (incidentes)
  getHistory(): Observable<WorkshopIncidentHistoryResponse> {
    return this.http.get<WorkshopIncidentHistoryResponse>(`${this.incidentUrl}/taller/mi-historial`, { headers: this.getHeaders() });
  }

  // Registrar vehículo/unidad de servicio del taller
  createVehicle(data: WorkshopVehicleCreateRequest): Observable<WorkshopVehicleResponse> {
    return this.http.post<WorkshopVehicleResponse>(`${this.apiUrl}/vehiculos`, data, { headers: this.getHeaders() });
  }

  // Listar vehículos/unidades de servicio del taller
  getVehicles(): Observable<WorkshopVehicleResponse[]> {
    return this.http.get<WorkshopVehicleResponse[]>(`${this.apiUrl}/vehiculos`, { headers: this.getHeaders() });
  }

  // Actualizar vehículo/unidad de servicio del taller
  updateVehicle(vehicleId: number, data: WorkshopVehicleUpdateRequest): Observable<WorkshopVehicleResponse> {
    return this.http.put<WorkshopVehicleResponse>(`${this.apiUrl}/vehiculos/${vehicleId}`, data, { headers: this.getHeaders() });
  }

  // Eliminar vehículo/unidad de servicio del taller
  deleteVehicle(vehicleId: number): Observable<WorkshopVehicleDeleteResponse> {
    return this.http.delete<WorkshopVehicleDeleteResponse>(`${this.apiUrl}/vehiculos/${vehicleId}`, { headers: this.getHeaders() });
  }
}
