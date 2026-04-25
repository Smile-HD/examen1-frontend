import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ==================== INTERFACES ====================

export interface ReportPeriod {
  start: string;
  end: string;
}

export interface DashboardSummaryResponse {
  period: ReportPeriod;
  revenue: {
    total_payments: number;
    total_amount: number;
    total_commission: number;
    average_commission_per_payment: number;
  };
  workshops: {
    total_workshops: number;
    active_workshops: number;
    inactive_workshops: number;
    workshops_with_incidents: number;
  };
  incidents: {
    total_incidents: number;
    assigned_incidents: number;
    unassigned_incidents: number;
    status_breakdown: { [key: string]: number };
  };
  payments: {
    pendiente: number;
    verificacion: number;
    confirmado: number;
    rechazado: number;
  };
  users: {
    total_users: number;
    total_clients: number;
    total_workshops: number;
  };
}

export interface DailyTrendItem {
  date: string;
  count: number;
  total_amount?: number;
  total_commission?: number;
}

export interface TopWorkshopItem {
  taller_id: number;
  taller_name: string;
  total_payments: number;
  total_amount: number;
  total_commission: number;
}

export interface RevenueReportResponse {
  period: ReportPeriod;
  summary: {
    total_payments: number;
    total_amount: number;
    total_commission: number;
    previous_commission: number;
    commission_change_percent: number;
  };
  daily_trend: DailyTrendItem[];
  top_workshops: TopWorkshopItem[];
}

export interface WorkshopReportResponse {
  period: ReportPeriod;
  summary: {
    total_workshops: number;
    active_workshops: number;
    inactive_workshops: number;
    workshops_with_incidents: number;
  };
  top_workshops_by_revenue: TopWorkshopItem[];
}

export interface ActiveClientItem {
  user_id: number;
  user_name: string;
  user_email: string;
  incident_count: number;
}

export interface IncidentReportResponse {
  period: ReportPeriod;
  summary: {
    total_incidents: number;
    assigned_incidents: number;
    unassigned_incidents: number;
    status_breakdown: { [key: string]: number };
  };
  daily_trend: DailyTrendItem[];
  most_active_clients: ActiveClientItem[];
}

export interface RejectedPaymentItem {
  payment_id: number;
  incident_id: number;
  user_name: string;
  taller_name: string;
  amount: number;
  created_at: string;
}

export interface PaymentReportResponse {
  period: ReportPeriod;
  summary: {
    total_payments: number;
    status_breakdown: {
      pendiente: number;
      verificacion: number;
      confirmado: number;
      rechazado: number;
    };
    confirmation_rate: number;
    rejection_rate: number;
  };
  rejected_payments: RejectedPaymentItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/reports`;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  private buildParams(period: string, startDate?: string, endDate?: string): HttpParams {
    let params = new HttpParams().set('period', period);
    
    if (period === 'custom' && startDate && endDate) {
      params = params.set('start_date', startDate).set('end_date', endDate);
    }
    
    return params;
  }

  getDashboardSummary(period: string = 'month', startDate?: string, endDate?: string): Observable<DashboardSummaryResponse> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get<DashboardSummaryResponse>(`${this.baseUrl}/dashboard`, { 
      headers: this.getHeaders(),
      params 
    });
  }

  getRevenueReport(period: string = 'month', startDate?: string, endDate?: string): Observable<RevenueReportResponse> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get<RevenueReportResponse>(`${this.baseUrl}/revenue`, { 
      headers: this.getHeaders(),
      params 
    });
  }

  getWorkshopReport(period: string = 'month', startDate?: string, endDate?: string): Observable<WorkshopReportResponse> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get<WorkshopReportResponse>(`${this.baseUrl}/workshops`, { 
      headers: this.getHeaders(),
      params 
    });
  }

  getIncidentReport(period: string = 'month', startDate?: string, endDate?: string): Observable<IncidentReportResponse> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get<IncidentReportResponse>(`${this.baseUrl}/incidents`, { 
      headers: this.getHeaders(),
      params 
    });
  }

  getPaymentReport(period: string = 'month', startDate?: string, endDate?: string): Observable<PaymentReportResponse> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get<PaymentReportResponse>(`${this.baseUrl}/payments`, { 
      headers: this.getHeaders(),
      params 
    });
  }
}
