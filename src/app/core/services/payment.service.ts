import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PaymentCreateRequest {
  incident_id: number;
  amount: number;
  workshop_account?: string | null;
}

export interface PaymentCreateResponse {
  payment_id: number;
  incident_id: number;
  user_id: number;
  taller_id: number;
  amount: number;
  commission: number;
  status: string;
  reference: string;
  workshop_account: string;
  qr_payload: string;
  qr_image_url: string;
  qr_image_url_absolute: string;
  created_at: string;
  message: string;
}

export interface PaymentConfirmRequest {
  payment_id: number;
}

export interface PaymentConfirmResponse {
  payment_id: number;
  incident_id: number;
  status: string;
  incident_status: string;
  message: string;
}

export interface PaymentRejectRequest {
  payment_id: number;
  reason?: string | null;
}

export interface PaymentRejectResponse {
  payment_id: number;
  incident_id: number;
  status: string;
  incident_status: string;
  message: string;
}

export interface PaymentListItemResponse {
  payment_id: number;
  incident_id: number;
  user_id: number;
  user_name: string | null;
  taller_id: number;
  taller_name: string | null;
  amount: number;
  commission: number;
  net_amount_to_workshop: number;
  status: string;
  reference: string;
  proof_image_url: string | null;
  proof_image_url_absolute: string | null;
  created_at: string;
}

export interface PaymentListResponse {
  total: number;
  payments: PaymentListItemResponse[];
}

export interface PaymentWorkshopSummaryItemResponse {
  taller_id: number;
  taller_name: string;
  total_payments: number;
  confirmed_payments: number;
  pending_payments: number;
  verification_payments: number;
  rejected_payments: number;
  total_amount: number;
  total_commission: number;
  total_net_to_workshop: number;
  amount_due_to_platform: number;
}

export interface PaymentAdminSummaryResponse {
  generated_at: string;
  total_payments: number;
  confirmed_payments: number;
  pending_payments: number;
  verification_payments: number;
  rejected_payments: number;
  total_amount: number;
  total_commission: number;
  total_net_to_workshop: number;
  workshops: PaymentWorkshopSummaryItemResponse[];
  payments: PaymentListItemResponse[];
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private paymentsUrl = `${environment.apiUrl}/payments`;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  createPayment(payload: PaymentCreateRequest): Observable<PaymentCreateResponse> {
    return this.http.post<PaymentCreateResponse>(`${this.paymentsUrl}/create`, payload, { headers: this.getHeaders() });
  }

  getWorkshopPayments(): Observable<PaymentListResponse> {
    return this.http.get<PaymentListResponse>(`${this.paymentsUrl}/workshop`, { headers: this.getHeaders() });
  }

  confirmPayment(payload: PaymentConfirmRequest): Observable<PaymentConfirmResponse> {
    return this.http.post<PaymentConfirmResponse>(`${this.paymentsUrl}/confirm`, payload, { headers: this.getHeaders() });
  }

  rejectPayment(payload: PaymentRejectRequest): Observable<PaymentRejectResponse> {
    return this.http.post<PaymentRejectResponse>(`${this.paymentsUrl}/reject`, payload, { headers: this.getHeaders() });
  }

  getAdminSummary(): Observable<PaymentAdminSummaryResponse> {
    return this.http.get<PaymentAdminSummaryResponse>(`${this.paymentsUrl}/admin/summary`, { headers: this.getHeaders() });
  }

  getAbsoluteUrl(rawUrl: string | null): string {
    if (!rawUrl) {
      return '';
    }

    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return '';
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    try {
      const apiOrigin = new URL(environment.apiUrl, window.location.origin).origin;
      if (trimmed.startsWith('/')) {
        return `${apiOrigin}${trimmed}`;
      }
      return `${apiOrigin}/${trimmed.replace(/^\.?\//, '')}`;
    } catch {
      return trimmed;
    }
  }
}
