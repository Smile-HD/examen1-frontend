import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WorkshopEvidenceItem {
  evidencia_id: number;
  tipo: string;
  url: string | null;
  url_audio?: string | null;
  texto_extraido: string | null;
}

export interface WorkshopIncomingRequestItem {
  solicitud_id: number;
  incidente_id: number;
  estado_solicitud: string;
  estado_incidente: string;
  tipo_problema: string;
  prioridad: number;
  ubicacion: string | null;
  latitud: number | null;
  longitud: number | null;
  vehiculo_placa: string;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  vehiculo_anio: number | null;
  cliente_id: number;
  fecha_asignacion: string;
  evidencias: WorkshopEvidenceItem[];
  tecnico_id?: number | null;
  tecnico_latitud?: number | null;
  tecnico_longitud?: number | null;
  tecnico_precision_metros?: number | null;
  tecnico_ubicacion_actualizada_en?: string | null;
}

export interface WorkshopIncomingRequestsResponse {
  total: number;
  solicitudes: WorkshopIncomingRequestItem[];
}

export interface WorkshopRequestDecisionRequest {
  accion: string;
  comentario?: string | null;
  tecnico_id?: number | null;
  transporte_id?: number | null;
}

export interface WorkshopRequestDecisionResponse {
  solicitud_id: number;
  incidente_id: number;
  estado_solicitud: string;
  estado_incidente: string;
  tecnico_id: number | null;
  transporte_id: number | null;
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class IncidentService {
  private http = inject(HttpClient);
  // Usa la url del backend para el taller
  private apiUrl = `${environment.apiUrl}/incidentes`;

  getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Obtener las notificaciones o solicitudes entrantes para el taller
  getIncomingRequests(): Observable<WorkshopIncomingRequestsResponse> {
    return this.http.get<WorkshopIncomingRequestsResponse>(`${this.apiUrl}/taller/solicitudes`, { headers: this.getHeaders() });
  }

  // Responder a una solicitud (aceptar o rechazar)
  decideRequest(solicitudId: number, decision: WorkshopRequestDecisionRequest): Observable<WorkshopRequestDecisionResponse> {
    return this.http.post<WorkshopRequestDecisionResponse>(`${this.apiUrl}/taller/solicitudes/${solicitudId}/decision`, decision, { headers: this.getHeaders() });
  }
}
