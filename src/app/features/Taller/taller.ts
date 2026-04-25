import { ChangeDetectorRef, Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';
import { IncidentService, WorkshopIncomingRequestItem } from '../../core/services/incident.service';
import {
  WorkshopService,
  WorkshopProfileResponse,
  WorkshopProfileUpdateRequest,
  WorkshopServiceCatalogItem,
  WorkshopTechnicianListItemResponse,
  WorkshopTechnicianLocationItem,
  WorkshopIncidentHistoryItemResponse,
  WorkshopTechnicianCandidateResponse,
  WorkshopVehicleCreateRequest,
  WorkshopVehicleResponse,
  WorkshopVehicleUpdateRequest
} from '../../core/services/workshop.service';
import {
  PaymentListItemResponse,
  PaymentService,
  WorkshopCommissionSummaryResponse,
  CommissionPaymentListItemResponse,
  CommissionPaymentListResponse
} from '../../core/services/payment.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './taller.html',
  styleUrls: ['./taller.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private incidentService = inject(IncidentService);
  private workshopService = inject(WorkshopService);
  private paymentService = inject(PaymentService);
  private cdr = inject(ChangeDetectorRef);
  
  // Pestaña actual
  currentTab: 'inicio' | 'vehiculos' | 'tecnicos' | 'historial' | 'mi_taller' | 'pagos' = 'inicio';

  // Nombre del taller simulado por defecto
  tallerNombre = 'Taller Mecánico';
  
  // Estado para la tabla/lista principal
  solicitudesEntrantes: WorkshopIncomingRequestItem[] = [];
  solicitudesEnProceso: WorkshopIncomingRequestItem[] = [];
  errorMessage: string | null = null;
  
  // Estado para Técnicos
  tecnicos: WorkshopTechnicianListItemResponse[] = [];
  ubicaciones: WorkshopTechnicianLocationItem[] = [];
  tecnicosError: string | null = null;

  // Estado para Historial
  historial: WorkshopIncidentHistoryItemResponse[] = [];
  historialError: string | null = null;
  readonly historyPageSize = 10;
  historyCurrentPage = 1;

  // Estado para perfil del taller
  workshopProfile: WorkshopProfileResponse | null = null;
  workshopNameInput = '';
  workshopQrImageUrlInput = '';
  selectedWorkshopQrFile: File | null = null;
  workshopLocationTextInput = '';
  workshopLatitudeInput = '';
  workshopLongitudeInput = '';
  workshopServiceCatalog: WorkshopServiceCatalogItem[] = [];
  selectedWorkshopServiceIds: number[] = [];
  isLoadingWorkshopProfile = false;
  isSavingWorkshopProfile = false;
  isUploadingWorkshopQr = false;
  workshopProfileError: string | null = null;
  workshopProfileSuccess: string | null = null;

  // Timer para actualización
  ubicacionTimer: any;
  incomingTimer: any;
  incomingToastTimer: any;
  incomingRefreshRetryTimer: ReturnType<typeof setTimeout> | null = null;
  incomingNotice: string | null = null;
  knownIncomingRequestIds: Set<number> = new Set<number>();

  // Estado del modal de detalle y aceptación
  selectedRequest: WorkshopIncomingRequestItem | null = null;
  showModal = false;
  isLoadingDecisionResources = false;
  selectedTransportId: number | null = null;
  private incidentMap: L.Map | null = null;
  private incidentMarker: L.CircleMarker | null = null;
  private technicianMarker: L.CircleMarker | null = null;
  private technicianTrailPolyline: L.Polyline | null = null;
  private technicianTrail: L.LatLngExpression[] = [];
  private mapInitTimer: ReturnType<typeof setTimeout> | null = null;

  // Listas para selección
  mockTecnicos = [
    { id: 1, nombre: 'Juan Pérez' },
    { id: 2, nombre: 'María Gómez' },
    { id: 3, nombre: 'Carlos López' }
  ];

  workshopVehicles: WorkshopVehicleResponse[] = [];

  readonly transportTypeOptions: Array<WorkshopVehicleCreateRequest['tipo']> = [
    'vagoneta',
    'sedan',
    'grua',
    'camion',
    'bus'
  ];

  newVehicleType: WorkshopVehicleCreateRequest['tipo'] = 'vagoneta';
  newVehiclePlate = '';
  vehicleFormError: string | null = null;
  vehicleFormSuccess: string | null = null;
  isRegisteringVehicle = false;
  editingVehicleId: number | null = null;
  editVehicleType: WorkshopVehicleCreateRequest['tipo'] = 'vagoneta';
  editVehiclePlate = '';
  isUpdatingVehicle = false;
  deletingVehicleId: number | null = null;

  // Estado para la busqueda y agregar tecnicos
  searchTecnicoQuery: string = '';
  foundTecnicos: WorkshopTechnicianCandidateResponse[] = [];
  searchTecnicoError: string | null = null;
  searchTecnicoSuccess: string | null = null;
  isSearchingTechnicians = false;
  assigningTecnicoId: number | null = null;
  unassigningTecnicoId: number | null = null;

  // Estado para acciones sobre solicitudes
  isAcceptingRequest = false;
  isRejectingRequest = false;

  // Estado para pagos
  workshopPayments: PaymentListItemResponse[] = [];
  paymentRejectReasonById: Record<number, string> = {};
  paymentActionError: string | null = null;
  paymentActionSuccess: string | null = null;
  isLoadingWorkshopPayments = false;
  confirmingPaymentId: number | null = null;
  rejectingPaymentId: number | null = null;
  showPaymentHistory = false;

  // Estado para comisiones
  commissionSummary: WorkshopCommissionSummaryResponse | null = null;
  commissionPayments: CommissionPaymentListItemResponse[] = [];
  platformQrUrl: string | null = null;
  showCommissionPaymentModal = false;
  selectedCommissionProofFile: File | null = null;
  isLoadingCommissionSummary = false;
  isCreatingCommissionPayment = false;
  isUploadingCommissionProof = false;
  commissionError: string | null = null;
  commissionSuccess: string | null = null;
  createdCommissionPaymentId: number | null = null;
  showCommissionHistory = false;

  ngOnInit() {
    const userInfo = localStorage.getItem('user_info');
    
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        this.tallerNombre = parsed.nombre || 'Taller Registrado';
      } catch (e) {
        console.error('Error al mapear información del usuario:', e);
      }
    }

    this.loadDataForTab();
    this.loadWorkshopVehicles();
    this.startIncomingPolling();
  }

  ngOnDestroy() {
    if (this.ubicacionTimer) {
      clearInterval(this.ubicacionTimer);
    }
    if (this.incomingTimer) {
      clearInterval(this.incomingTimer);
    }
    if (this.incomingToastTimer) {
      clearTimeout(this.incomingToastTimer);
    }
    if (this.incomingRefreshRetryTimer) {
      clearTimeout(this.incomingRefreshRetryTimer);
      this.incomingRefreshRetryTimer = null;
    }
    if (this.mapInitTimer) {
      clearTimeout(this.mapInitTimer);
      this.mapInitTimer = null;
    }
    this.destroyIncidentMap();
  }

  setTab(tab: 'inicio' | 'vehiculos' | 'tecnicos' | 'historial' | 'mi_taller' | 'pagos') {
    if (this.isAnyActionInProgress) {
      return;
    }
    this.currentTab = tab;
    this.clearTimer();
    this.loadDataForTab();
  }

  clearTimer() {
    if (this.ubicacionTimer) {
      clearInterval(this.ubicacionTimer);
      this.ubicacionTimer = null;
    }
  }

  startIncomingPolling() {
    if (this.incomingTimer) {
      clearInterval(this.incomingTimer);
    }
    // Refresca solicitudes en segundo plano para notificar nuevas emergencias y mantener la vista sincronizada.
    this.incomingTimer = setInterval(() => {
      this.loadIncomingRequests(true);
    }, 4000);
  }

  loadDataForTab() {
    switch (this.currentTab) {
      case 'inicio':
        this.loadIncomingRequests();
        this.loadDecisionResources();
        break;
      case 'vehiculos':
        this.loadWorkshopVehicles();
        break;
      case 'tecnicos':
        this.loadTechniciansAndLocations();
        // Recargar ubicaciones cada 15 segundos
        this.ubicacionTimer = setInterval(() => this.loadLocations(), 15000);
        break;
      case 'historial':
        this.loadHistory();
        break;
      case 'mi_taller':
        this.loadWorkshopProfile();
        break;
      case 'pagos':
        this.paymentActionError = null;
        this.paymentActionSuccess = null;
        this.commissionError = null;
        this.commissionSuccess = null;
        this.loadWorkshopPayments();
        this.loadCommissionSummary();
        break;
    }
  }

  loadWorkshopProfile() {
    this.workshopProfileError = null;
    this.workshopProfileSuccess = null;
    this.isLoadingWorkshopProfile = true;

    this.workshopService.getProfile().pipe(
      timeout(15000),
      finalize(() => {
        this.isLoadingWorkshopProfile = false;
        this.requestRender();
      })
    ).subscribe({
      next: (profile) => {
        this.workshopProfile = profile;
        this.workshopNameInput = profile.nombre_taller || '';
        this.workshopQrImageUrlInput = profile.qr_image_url || '';
        this.workshopLocationTextInput = profile.ubicacion_texto || '';
        this.workshopLatitudeInput = profile.latitud !== null && profile.latitud !== undefined
          ? String(profile.latitud)
          : '';
        this.workshopLongitudeInput = profile.longitud !== null && profile.longitud !== undefined
          ? String(profile.longitud)
          : '';
        this.workshopServiceCatalog = Array.isArray(profile.servicios_catalogo) ? profile.servicios_catalogo : [];
        this.selectedWorkshopServiceIds = Array.isArray(profile.servicios_ofrecidos_ids)
          ? [...profile.servicios_ofrecidos_ids]
          : [];
      },
      error: (err) => {
        console.error('Error cargando perfil del taller:', err);
        this.workshopProfileError = err?.name === 'TimeoutError'
          ? 'La carga del perfil tardó demasiado. Reintenta en unos segundos.'
          : (err?.error?.detail || 'No se pudo cargar el perfil del taller.');
      }
    });
  }

  isWorkshopServiceSelected(serviceId: number): boolean {
    return this.selectedWorkshopServiceIds.includes(serviceId);
  }

  toggleWorkshopService(serviceId: number, checked: boolean) {
    if (checked) {
      if (!this.selectedWorkshopServiceIds.includes(serviceId)) {
        this.selectedWorkshopServiceIds = [...this.selectedWorkshopServiceIds, serviceId];
      }
      return;
    }

    this.selectedWorkshopServiceIds = this.selectedWorkshopServiceIds.filter((id) => id !== serviceId);
  }

  useCurrentWorkshopLocation() {
    this.workshopProfileError = null;

    if (!('geolocation' in navigator)) {
      this.workshopProfileError = 'Este navegador no soporta geolocalización.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.workshopLatitudeInput = String(lat);
        this.workshopLongitudeInput = String(lng);
        void this.reverseGeocodeWorkshopLocation(lat, lng);
        this.requestRender();
      },
      () => {
        this.workshopProfileError = 'No se pudo obtener la ubicación actual. Revisa permisos de ubicación.';
        this.requestRender();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  }

  private async reverseGeocodeWorkshopLocation(lat: number, lng: number): Promise<void> {
    try {
      const endpoint = new URL('https://nominatim.openstreetmap.org/reverse');
      endpoint.searchParams.set('lat', lat.toFixed(6));
      endpoint.searchParams.set('lon', lng.toFixed(6));
      endpoint.searchParams.set('format', 'jsonv2');
      endpoint.searchParams.set('zoom', '18');
      endpoint.searchParams.set('addressdetails', '1');

      const response = await fetch(endpoint.toString(), {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const displayName = typeof payload?.display_name === 'string'
        ? payload.display_name.trim()
        : '';

      if (displayName) {
        this.workshopLocationTextInput = displayName;
        this.requestRender();
      }
    } catch {
      // Si falla la geocodificacion inversa, se conserva solo lat/lng.
    }
  }

  saveWorkshopProfile() {
    if (this.isSavingWorkshopProfile || this.isUploadingWorkshopQr) {
      return;
    }

    this.workshopProfileError = null;
    this.workshopProfileSuccess = null;

    const trimmedName = this.workshopNameInput.trim();
    if (trimmedName.length < 3) {
      this.workshopProfileError = 'El nombre del taller debe tener al menos 3 caracteres.';
      return;
    }

    const rawLocation = this.workshopLocationTextInput ?? '';
    const trimmedLocation = String(rawLocation).trim();
    const currentQrImageUrl = this.workshopProfile?.qr_image_url ?? null;

    const latInputText = String(this.workshopLatitudeInput ?? '').trim();
    const lngInputText = String(this.workshopLongitudeInput ?? '').trim();
    const hasLat = latInputText.length > 0;
    const hasLng = lngInputText.length > 0;
    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      this.workshopProfileError = 'Debes completar tanto latitud como longitud.';
      return;
    }

    const lat = hasLat ? Number(latInputText) : null;
    const lng = hasLng ? Number(lngInputText) : null;

    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      this.workshopProfileError = 'Latitud inválida. Debe estar entre -90 y 90.';
      return;
    }

    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      this.workshopProfileError = 'Longitud inválida. Debe estar entre -180 y 180.';
      return;
    }

    const payload: WorkshopProfileUpdateRequest = {
      nombre_taller: trimmedName,
      qr_image_url: currentQrImageUrl,
      ubicacion_texto: trimmedLocation || null,
      latitud: lat,
      longitud: lng,
      servicios_ofrecidos_ids: [...this.selectedWorkshopServiceIds],
    };

    this.isSavingWorkshopProfile = true;
    this.workshopService.updateProfile(payload).pipe(
      timeout(20000),
      finalize(() => {
        this.isSavingWorkshopProfile = false;
        this.requestRender();
      })
    ).subscribe({
      next: (profile) => {
        this.workshopProfile = profile;
        this.workshopProfileSuccess = 'Perfil del taller actualizado correctamente.';
        this.workshopNameInput = profile.nombre_taller || '';
        this.workshopQrImageUrlInput = profile.qr_image_url || '';
        this.workshopLocationTextInput = profile.ubicacion_texto || '';
        this.workshopLatitudeInput = profile.latitud !== null && profile.latitud !== undefined
          ? String(profile.latitud)
          : '';
        this.workshopLongitudeInput = profile.longitud !== null && profile.longitud !== undefined
          ? String(profile.longitud)
          : '';
        this.workshopServiceCatalog = Array.isArray(profile.servicios_catalogo) ? profile.servicios_catalogo : [];
        this.selectedWorkshopServiceIds = Array.isArray(profile.servicios_ofrecidos_ids)
          ? [...profile.servicios_ofrecidos_ids]
          : [];
        this.tallerNombre = profile.nombre_taller || this.tallerNombre;
      },
      error: (err) => {
        console.error('Error guardando perfil del taller:', err);
        this.workshopProfileError = err?.name === 'TimeoutError'
          ? 'La actualización tardó demasiado. Intenta nuevamente.'
          : (err?.error?.detail || 'No se pudo guardar el perfil del taller.');
      }
    });
  }

  onWorkshopQrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    this.selectedWorkshopQrFile = file;
  }

  uploadWorkshopQrImage(): void {
    if (this.isUploadingWorkshopQr || !this.selectedWorkshopQrFile) {
      return;
    }

    this.workshopProfileError = null;
    this.workshopProfileSuccess = null;
    this.isUploadingWorkshopQr = true;

    this.workshopService.uploadQrImage(this.selectedWorkshopQrFile).pipe(
      timeout(20000),
      finalize(() => {
        this.isUploadingWorkshopQr = false;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        // Usar la URL relativa para guardar en el perfil
        const nextQrUrl = response.qr_image_url || null;
        this.workshopQrImageUrlInput = nextQrUrl || '';
        this.selectedWorkshopQrFile = null;
        if (this.workshopProfile) {
          this.workshopProfile = {
            ...this.workshopProfile,
            qr_image_url: nextQrUrl,
          };
        }
        this.workshopProfileSuccess = response.message || 'QR del taller actualizado correctamente.';
        console.log('QR subido exitosamente:', {
          relative: response.qr_image_url,
          absolute: response.qr_image_url_absolute,
          displayUrl: this.getQrDisplayUrl()
        });
      },
      error: (err) => {
        console.error('Error subiendo QR:', err);
        this.workshopProfileError = err?.error?.detail || 'No se pudo subir el QR del taller.';
      }
    });
  }

  loadWorkshopPayments(): void {
    this.paymentActionError = null;
    this.paymentActionSuccess = null;
    this.isLoadingWorkshopPayments = true;

    this.paymentService.getWorkshopPayments().pipe(
      timeout(20000),
      finalize(() => {
        this.isLoadingWorkshopPayments = false;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.workshopPayments = Array.isArray(response?.payments) ? response.payments : [];
      },
      error: (err) => {
        this.paymentActionError = err?.error?.detail || 'No se pudo cargar la lista de pagos.';
      }
    });
  }

  loadIncomingRequests(showNoticeForNew = false) {
    this.errorMessage = null;
    this.incidentService.getIncomingRequests().subscribe({
      next: (res) => {
        const previousIds = this.knownIncomingRequestIds;
        const hadPreviousSync = previousIds.size > 0;

        const incomingRequests = Array.isArray(res?.solicitudes) ? res.solicitudes : [];
        
        this.solicitudesEntrantes = incomingRequests.filter((req) => this.canRespondRequest(req.estado_solicitud));
        this.solicitudesEnProceso = incomingRequests.filter((req) => !this.canRespondRequest(req.estado_solicitud));

        if (this.selectedRequest) {
          const refreshed = incomingRequests.find(
            (req) => req.solicitud_id === this.selectedRequest?.solicitud_id
          );
          if (refreshed) {
            this.selectedRequest = refreshed;
            if (this.showModal && this.incidentMap) {
              this.refreshIncidentMapOverlays();
            }
          }
        }

        const newRequests = this.solicitudesEntrantes.filter(
          (request) => !previousIds.has(request.solicitud_id)
        );
        this.knownIncomingRequestIds = new Set(
          this.solicitudesEntrantes.map((request) => request.solicitud_id)
        );

        if (showNoticeForNew && hadPreviousSync && newRequests.length > 0) {
          this.incomingNotice =
            newRequests.length === 1
              ? 'Llego 1 nueva solicitud de emergencia.'
              : `Llegaron ${newRequests.length} nuevas solicitudes de emergencia.`;
          if (this.incomingToastTimer) {
            clearTimeout(this.incomingToastTimer);
          }
          this.incomingToastTimer = setTimeout(() => {
            this.incomingNotice = null;
            this.requestRender();
          }, 6000);
        }

        for (const request of this.solicitudesEntrantes) {
          const audioExtracted = this.getAudios(request)
            .map((audio) => audio.texto_extraido)
            .filter((value) => !!value);
          const imageExtracted = this.getImages(request)
            .map((image) => image.texto_extraido)
            .filter((value) => !!value);

          console.info(
            `[IA][Incidente ${request.incidente_id}] Audio transcrito:`,
            audioExtracted.length > 0 ? audioExtracted : 'Sin transcripcion disponible'
          );
          console.info(
            `[IA][Incidente ${request.incidente_id}] Resumen imagen:`,
            imageExtracted.length > 0 ? imageExtracted : 'Sin analisis de imagen disponible'
          );
        }
        this.requestRender();
      },
      error: (err) => {
        console.error('Error cargando solicitudes:', err);
        this.errorMessage = 'No se pudieron cargar las solicitudes entrantes.';
        this.requestRender();
      }
    });
  }

  loadTechniciansAndLocations() {
    this.tecnicosError = null;
    this.workshopService.getTechnicians().subscribe({
      next: (res: any[]) => {
        this.tecnicos = this.normalizeTechnicians(res);
        this.mockTecnicos = this.tecnicos.map((t) => ({ id: t.usuario_id, nombre: t.nombre }));
        this.loadWorkshopVehicles();
        this.loadLocations();
        this.requestRender();
      },
      error: (err) => {
        console.error('Error cargando técnicos:', err);
        this.tecnicosError = err?.error?.detail || 'No se pudo cargar la lista de técnicos.';
        this.requestRender();
      }
    });
  }

  loadWorkshopVehicles() {
    this.workshopService.getVehicles().subscribe({
      next: (res) => {
        this.workshopVehicles = res;
        if (
          this.editingVehicleId &&
          !this.workshopVehicles.some((vehicle) => vehicle.id === this.editingVehicleId)
        ) {
          this.cancelVehicleEdit();
        }
        this.requestRender();
      },
      error: (err) => {
        console.error('Error cargando vehículos del taller:', err);
        this.requestRender();
      }
    });
  }

  loadDecisionResources() {
    this.isLoadingDecisionResources = true;
    let pending = 2;

    const finish = () => {
      pending -= 1;
      if (pending <= 0) {
        this.isLoadingDecisionResources = false;
        this.requestRender();
      }
    };

    this.workshopService.getTechnicians().subscribe({
      next: (res) => {
        this.tecnicos = this.normalizeTechnicians(res as any[]);
      },
      error: (err) => {
        console.error('Error cargando técnicos para responder solicitudes:', err);
        finish();
      },
      complete: finish
    });

    this.workshopService.getVehicles().subscribe({
      next: (res) => {
        this.workshopVehicles = res;
      },
      error: (err) => {
        console.error('Error cargando vehículos para responder solicitudes:', err);
        finish();
      },
      complete: finish
    });
  }

  normalizeTransportType(type: string | null | undefined): WorkshopVehicleCreateRequest['tipo'] {
    const normalized = (type || '').trim().toLowerCase();
    return this.transportTypeOptions.find((option) => option === normalized) ?? 'vagoneta';
  }

  formatVehicleType(type: string): string {
    switch (type) {
      case 'vagoneta':
        return 'Vagoneta';
      case 'sedan':
        return 'Sedan';
      case 'grua':
        return 'Grua';
      case 'camion':
        return 'Camion';
      case 'bus':
        return 'Bus';
      default:
        return type;
    }
  }

  getVehicleLabel(vehicle: WorkshopVehicleResponse): string {
    return `${this.formatVehicleType(vehicle.tipo)} - Placa ${vehicle.placa.toUpperCase()}`;
  }

  registerWorkshopVehicle() {
    if (this.isVehicleActionInProgress) {
      return;
    }

    const normalizedPlate = this.newVehiclePlate.trim().toUpperCase().replace(/\s+/g, '');

    if (normalizedPlate.length < 5 || normalizedPlate.length > 10) {
      this.vehicleFormError = 'La placa debe tener entre 5 y 10 caracteres.';
      this.vehicleFormSuccess = null;
      return;
    }

    this.isRegisteringVehicle = true;
    this.vehicleFormError = null;
    this.vehicleFormSuccess = null;

    const payload: WorkshopVehicleCreateRequest = {
      tipo: this.newVehicleType,
      placa: normalizedPlate,
      estado: 'disponible'
    };

    this.workshopService.createVehicle(payload).pipe(
      timeout(15000),
      finalize(() => {
        this.isRegisteringVehicle = false;
        this.requestRender();
      })
    ).subscribe({
      next: (vehicle) => {
        this.vehicleFormSuccess = `Transporte registrado: ${this.getVehicleLabel(vehicle)}.`;
        this.newVehiclePlate = '';
        this.loadWorkshopVehicles();
      },
      error: (err) => {
        if (err?.error?.detail) {
          this.vehicleFormError = err.error.detail;
        } else if (err?.name === 'TimeoutError') {
          this.vehicleFormError = 'La operación tardó demasiado. Intenta nuevamente.';
        } else {
          this.vehicleFormError = 'No se pudo registrar el transporte.';
        }
        this.vehicleFormSuccess = null;
      }
    });
  }

  startVehicleEdit(vehicle: WorkshopVehicleResponse) {
    if (this.isVehicleActionInProgress) {
      return;
    }

    this.vehicleFormError = null;
    this.vehicleFormSuccess = null;
    this.editingVehicleId = vehicle.id;
    this.editVehicleType = this.normalizeTransportType(vehicle.tipo);
    this.editVehiclePlate = vehicle.placa;
  }

  cancelVehicleEdit() {
    this.editingVehicleId = null;
    this.editVehicleType = 'vagoneta';
    this.editVehiclePlate = '';
    this.isUpdatingVehicle = false;
  }

  saveVehicleEdit(vehicleId: number) {
    if (this.isVehicleActionInProgress) {
      return;
    }

    const normalizedPlate = this.editVehiclePlate.trim().toUpperCase().replace(/\s+/g, '');

    if (normalizedPlate.length < 5 || normalizedPlate.length > 10) {
      this.vehicleFormError = 'La placa debe tener entre 5 y 10 caracteres.';
      this.vehicleFormSuccess = null;
      return;
    }

    this.isUpdatingVehicle = true;
    this.vehicleFormError = null;
    this.vehicleFormSuccess = null;

    const payload: WorkshopVehicleUpdateRequest = {
      tipo: this.editVehicleType,
      placa: normalizedPlate
    };

    this.workshopService.updateVehicle(vehicleId, payload).pipe(
      timeout(15000),
      finalize(() => {
        this.isUpdatingVehicle = false;
        this.requestRender();
      })
    ).subscribe({
      next: (vehicle) => {
        this.vehicleFormSuccess = `Transporte actualizado: ${this.getVehicleLabel(vehicle)}.`;
        this.cancelVehicleEdit();
        this.loadWorkshopVehicles();
      },
      error: (err) => {
        if (err?.error?.detail) {
          this.vehicleFormError = err.error.detail;
        } else if (err?.name === 'TimeoutError') {
          this.vehicleFormError = 'La operación tardó demasiado. Intenta nuevamente.';
        } else {
          this.vehicleFormError = 'No se pudo actualizar el transporte.';
        }
        this.vehicleFormSuccess = null;
      }
    });
  }

  deleteWorkshopVehicle(vehicle: WorkshopVehicleResponse) {
    if (this.isVehicleActionInProgress) {
      return;
    }

    const confirmed = confirm(`¿Eliminar el transporte ${this.getVehicleLabel(vehicle)}?`);
    if (!confirmed) {
      return;
    }

    this.deletingVehicleId = vehicle.id;
    this.vehicleFormError = null;
    this.vehicleFormSuccess = null;

    this.workshopService.deleteVehicle(vehicle.id).pipe(
      timeout(15000),
      finalize(() => {
        this.deletingVehicleId = null;
        this.requestRender();
      })
    ).subscribe({
      next: () => {
        this.vehicleFormSuccess = 'Transporte eliminado correctamente.';
        if (this.editingVehicleId === vehicle.id) {
          this.cancelVehicleEdit();
        }
        this.loadWorkshopVehicles();
      },
      error: (err) => {
        if (err?.error?.detail) {
          this.vehicleFormError = err.error.detail;
        } else if (err?.name === 'TimeoutError') {
          this.vehicleFormError = 'La operación tardó demasiado. Intenta nuevamente.';
        } else {
          this.vehicleFormError = 'No se pudo eliminar el transporte.';
        }
        this.vehicleFormSuccess = null;
      }
    });
  }

  loadLocations() {
    this.workshopService.getTechnicianLocations().subscribe({
      next: (res: any[]) => {
        this.ubicaciones = res.map((item) => ({
          usuario_id: item.usuario_id ?? item.tecnico_id,
          nombre: item.nombre,
          estado: item.estado,
          latitud: item.latitud,
          longitud: item.longitud,
          ultima_actualizacion_gps: item.ultima_actualizacion_gps ?? item.actualizada_en ?? null
        }));
        this.requestRender();
      },
      error: (err) => {
        console.error('Error cargando ubicaciones:', err);
        this.requestRender();
      }
    });
  }

  getLocationFor(tecnicoId: number): WorkshopTechnicianLocationItem | undefined {
    return this.ubicaciones.find(u => u.usuario_id === tecnicoId);
  }

  buscarTecnicos() {
    if (this.isTechnicianActionInProgress) {
      return;
    }

    if (this.searchTecnicoQuery.trim().length < 2) {
      this.foundTecnicos = [];
      this.searchTecnicoError = 'Escribe al menos 2 letras para buscar.';
      return;
    }

    this.isSearchingTechnicians = true;
    this.searchTecnicoSuccess = null;
    this.searchTecnicoError = null;
    this.workshopService.searchTechnicians(this.searchTecnicoQuery).pipe(
      timeout(15000),
      finalize(() => {
        this.isSearchingTechnicians = false;
        this.requestRender();
      })
    ).subscribe({
      next: (data) => {
        const normalized = Array.isArray(data) ? data : [];
        this.foundTecnicos = normalized;
        this.searchTecnicoSuccess =
          normalized.length > 0
            ? `Busqueda completada: ${normalized.length} tecnico(s) disponible(s).`
            : 'Busqueda completada: no se encontraron tecnicos disponibles.';
      },
      error: (err) => {
        this.searchTecnicoError =
          err?.name === 'TimeoutError'
            ? 'La búsqueda tardó demasiado. Intenta nuevamente.'
            : (err?.error?.detail || 'Error al buscar tecnicos.');
      }
    });
  }

  asignarTecnico(tecnico_id: number) {
    if (this.isTechnicianActionInProgress) {
      return;
    }

    this.assigningTecnicoId = tecnico_id;
    this.searchTecnicoSuccess = null;
    this.searchTecnicoError = null;
    this.workshopService.assignTechnician({ usuario_id: tecnico_id }).pipe(
      timeout(15000),
      finalize(() => {
        this.assigningTecnicoId = null;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.foundTecnicos = this.foundTecnicos.filter(t => t.usuario_id !== tecnico_id);
        this.searchTecnicoSuccess = response?.mensaje || 'Tecnico asignado correctamente.';
        this.loadTechniciansAndLocations();
      },
      error: (err) => {
        this.searchTecnicoError =
          err?.name === 'TimeoutError'
            ? 'La asignación tardó demasiado. Intenta nuevamente.'
            : (err?.error?.detail || 'Error al asignar; puede que ya este asignado.');
        console.error(err);
      }
    });
  }

  desvincularTecnico(tecnicoId: number) {
    if (this.isTechnicianActionInProgress) {
      return;
    }

    const motivo = prompt('¿Motivo para desbincular al técnico?');
    if (motivo !== null) {
      this.unassigningTecnicoId = tecnicoId;
      this.searchTecnicoSuccess = null;
      this.workshopService.unassignTechnician({ tecnico_id: tecnicoId, motivo: motivo || undefined }).pipe(
        timeout(15000),
        finalize(() => {
          this.unassigningTecnicoId = null;
          this.requestRender();
        })
      ).subscribe({
        next: (res) => {
          this.searchTecnicoSuccess = res?.mensaje || 'Tecnico desvinculado correctamente.';
          this.loadTechniciansAndLocations();
        },
        error: (err) => {
          this.searchTecnicoError =
            err?.name === 'TimeoutError'
              ? 'La desvinculación tardó demasiado. Intenta nuevamente.'
              : (err?.error?.detail || 'Error al desvincular al tecnico.');
          console.error(err);
        }
      });
    }
  }

  loadHistory() {
    this.historialError = null;
    this.workshopService.getHistory().subscribe({
      next: (res) => {
        const incomingHistory = res.historial ?? res.incidentes ?? [];
        const rawHistory = Array.isArray(incomingHistory) ? incomingHistory : [];
        
        this.historial = rawHistory.filter((item: WorkshopIncidentHistoryItemResponse) => {
          const reqStates = item.estados_solicitud || [];
          const iState = item.estado_incidente || item.estado_actual;
          
          const isPending = reqStates.includes('enviada') || reqStates.includes('pendiente');
          const isAccepted = reqStates.includes('aceptada');
          const isFinalized = iState === 'finalizado' || iState === 'cancelado';
          
          // Ocultar solicitudes que aun no se aceptaron o rechazaron
          if (isPending && !reqStates.includes('rechazada') && !reqStates.includes('otro_taller_acepto') && !isAccepted) return false;
          // Ocultar solicitudes que el taller acepto pero aun siguen en proceso
          if (isAccepted && !isFinalized) return false;
          
          return true;
        });
        
        this.historyCurrentPage = 1;
        this.requestRender();
      },
      error: (err) => {
        console.error('Error cargando historial:', err);
        this.historialError = err?.error?.detail || 'No se pudo cargar el historial.';
        this.requestRender();
      }
    });
  }

  getHistoryDate(item: WorkshopIncidentHistoryItemResponse): string | null {
    return item.fecha_hora ?? item.fecha_incidente ?? null;
  }

  getHistoryIncidentState(item: WorkshopIncidentHistoryItemResponse): string {
    return item.estado_incidente ?? item.estado_actual ?? 'desconocido';
  }

  getHistoryRequestStates(item: WorkshopIncidentHistoryItemResponse): string {
    if (!Array.isArray(item.estados_solicitud) || item.estados_solicitud.length === 0) {
      return 'Sin registro';
    }
    return item.estados_solicitud.join(', ');
  }

  getHistoryAmount(item: WorkshopIncidentHistoryItemResponse): number | null {
    if (typeof item.monto_total === 'number') {
      return item.monto_total;
    }
    const amount = item.metrica?.costo_total;
    return typeof amount === 'number' ? amount : null;
  }

  get totalHistoryPages(): number {
    if (this.historial.length === 0) {
      return 1;
    }
    return Math.ceil(this.historial.length / this.historyPageSize);
  }

  get paginatedHistory(): WorkshopIncidentHistoryItemResponse[] {
    const startIndex = (this.historyCurrentPage - 1) * this.historyPageSize;
    const endIndex = startIndex + this.historyPageSize;
    return this.historial.slice(startIndex, endIndex);
  }

  get historyStartIndex(): number {
    if (this.historial.length === 0) {
      return 0;
    }
    return (this.historyCurrentPage - 1) * this.historyPageSize + 1;
  }

  get historyEndIndex(): number {
    if (this.historial.length === 0) {
      return 0;
    }
    return Math.min(this.historyCurrentPage * this.historyPageSize, this.historial.length);
  }

  get historyPageNumbers(): number[] {
    if (this.totalHistoryPages <= 1) {
      return [1];
    }

    const maxVisiblePages = 5;
    const halfWindow = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, this.historyCurrentPage - halfWindow);
    let end = Math.min(this.totalHistoryPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  goToHistoryPage(page: number): void {
    if (!Number.isFinite(page)) {
      return;
    }

    const nextPage = Math.trunc(page);
    if (nextPage < 1 || nextPage > this.totalHistoryPages || nextPage === this.historyCurrentPage) {
      return;
    }

    this.historyCurrentPage = nextPage;
    this.requestRender();
  }

  goToPreviousHistoryPage(): void {
    this.goToHistoryPage(this.historyCurrentPage - 1);
  }

  goToNextHistoryPage(): void {
    this.goToHistoryPage(this.historyCurrentPage + 1);
  }

  isViewOnlyModal = false;

  openDetails(request: WorkshopIncomingRequestItem) {
    this.selectedRequest = request;
    this.isViewOnlyModal = false;
    this.showModal = true;
    this.selectedTransportId = null;
    this.loadDecisionResources();
    this.scheduleMapRender();
  }

  openEnProcesoDetails(request: WorkshopIncomingRequestItem) {
    this.selectedRequest = request;
    this.isViewOnlyModal = true;
    this.showModal = true;
    this.selectedTransportId = null;
    this.scheduleMapRender();
  }

  closeModal() {
    if (this.isRequestDecisionInProgress) {
      return;
    }
    this.destroyIncidentMap();
    this.showModal = false;
    this.selectedRequest = null;
    this.selectedTransportId = null;
  }

  aceptarSolicitud() {
    if (this.isRequestDecisionInProgress) {
      return;
    }

    if (!this.selectedRequest) {
      alert('No se encontró la solicitud seleccionada.');
      return;
    }

    if (!this.selectedTransportId) {
      alert('Selecciona un transporte disponible antes de aceptar la solicitud.');
      return;
    }

    this.isAcceptingRequest = true;

    const payload = {
      accion: 'aceptar',
      comentario: 'Aceptado desde el panel del taller con transporte seleccionado manualmente.',
      transporte_id: this.selectedTransportId
    };

    this.incidentService.decideRequest(this.selectedRequest.solicitud_id, payload).pipe(
      timeout(20000),
      finalize(() => {
        this.isAcceptingRequest = false;
        this.requestRender();
      })
    ).subscribe({
      next: (res) => {
        const assignedTech = res.tecnico_id ? `Técnico #${res.tecnico_id}` : 'sin técnico';
        const assignedTransport = res.transporte_id ? `Transporte #${res.transporte_id}` : 'sin transporte';
        alert(`Solicitud aceptada. Recursos asignados: ${assignedTech}, ${assignedTransport}.`);
        this.closeModal();
        this.refreshIncomingRequests();
        this.loadTechniciansAndLocations();
        this.loadWorkshopVehicles();
      },
      error: (err) => {
        console.error('Error al aceptar la solicitud:', err);
        const timeoutMessage = err?.name === 'TimeoutError'
          ? 'La operación tardó demasiado. Intenta nuevamente.'
          : 'Hubo un error al aceptar la solicitud.';
        alert(timeoutMessage);
      }
    });
  }

  rechazarSolicitud() {
    if (this.isRequestDecisionInProgress) {
      return;
    }

    if (!this.selectedRequest) {
      alert('No se encontró la solicitud seleccionada.');
      return;
    }

    this.isRejectingRequest = true;

    const payload = {
      accion: 'rechazar',
      comentario: 'Rechazado desde el panel del taller.'
    };

    this.incidentService.decideRequest(this.selectedRequest.solicitud_id, payload).pipe(
      timeout(20000),
      finalize(() => {
        this.isRejectingRequest = false;
        this.requestRender();
      })
    ).subscribe({
      next: () => {
        alert('Solicitud rechazada correctamente.');
        this.closeModal();
        this.refreshIncomingRequests();
      },
      error: (err) => {
        console.error('Error al rechazar la solicitud:', err);
        const timeoutMessage = err?.name === 'TimeoutError'
          ? 'La operación tardó demasiado. Intenta nuevamente.'
          : 'Hubo un error al rechazar la solicitud.';
        alert(timeoutMessage);
      }
    });
  }

  canRespondRequest(state: string): boolean {
    const normalized = (state || '').trim().toLowerCase();
    return normalized === 'pendiente' || normalized === 'enviada';
  }

  get availableTechniciansCount(): number {
    return this.tecnicos.filter((tech) => tech.estado_tecnico === 'disponible').length;
  }

  get availableVehiclesCount(): number {
    return this.workshopVehicles.filter((vehicle) => vehicle.estado === 'disponible').length;
  }

  get availableDecisionVehicles(): WorkshopVehicleResponse[] {
    return this.workshopVehicles.filter((vehicle) => vehicle.estado === 'disponible');
  }

  get hasSelectedRequestCoordinates(): boolean {
    if (!this.selectedRequest) {
      return false;
    }

    return this.getIncidentCoordinates(this.selectedRequest) !== null
      || this.getTechnicianCoordinates(this.selectedRequest) !== null;
  }

  get isVehicleActionInProgress(): boolean {
    return this.isRegisteringVehicle || this.isUpdatingVehicle || this.deletingVehicleId !== null;
  }

  get isTechnicianActionInProgress(): boolean {
    return this.isSearchingTechnicians || this.assigningTecnicoId !== null || this.unassigningTecnicoId !== null;
  }

  get isRequestDecisionInProgress(): boolean {
    return this.isAcceptingRequest || this.isRejectingRequest;
  }

  get isAnyActionInProgress(): boolean {
    return this.isVehicleActionInProgress
      || this.isTechnicianActionInProgress
      || this.isRequestDecisionInProgress
      || this.confirmingPaymentId !== null
      || this.rejectingPaymentId !== null
      || this.isUploadingWorkshopQr;
  }

  private requestRender(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignorar si el componente ya fue destruido mientras resolvia una peticion.
    }
  }

  private refreshIncomingRequests(): void {
    this.loadIncomingRequests();

    if (this.incomingRefreshRetryTimer) {
      clearTimeout(this.incomingRefreshRetryTimer);
      this.incomingRefreshRetryTimer = null;
    }

    // Reintento breve para absorber eventual consistencia del backend.
    this.incomingRefreshRetryTimer = setTimeout(() => {
      this.loadIncomingRequests();
      this.incomingRefreshRetryTimer = null;
    }, 1500);
  }

  private normalizeTechnicians(items: any[]): WorkshopTechnicianListItemResponse[] {
    return items
      .map((item) => ({
        usuario_id: item.usuario_id ?? item.tecnico_id,
        nombre: item.nombre,
        correo: item.correo,
        estado_tecnico: item.estado_tecnico ?? item.estado ?? 'desconocido',
        telefono: item.telefono ?? null
      }))
      .filter((item) => Number.isFinite(item.usuario_id));
  }

  private getNormalizedEvidenceUrl(url: string | null): string {
    if (!url) {
      return '';
    }
    return url.trim().toLowerCase();
  }

  private looksLikeImageUrl(url: string | null): boolean {
    const normalized = this.getNormalizedEvidenceUrl(url);
    return normalized.endsWith('.jpg')
      || normalized.endsWith('.jpeg')
      || normalized.endsWith('.png')
      || normalized.endsWith('.webp');
  }

  private looksLikeAudioUrl(url: string | null): boolean {
    const normalized = this.getNormalizedEvidenceUrl(url);
    return normalized.endsWith('.mp3')
      || normalized.endsWith('.m4a')
      || normalized.endsWith('.wav')
      || normalized.endsWith('.aac')
      || normalized.endsWith('.ogg')
      || normalized.endsWith('.webm');
  }

  private resolveEvidenceAudioUrl(evidence: { url?: string | null; url_audio?: string | null }): string | null {
    const directAudio = (evidence.url_audio ?? '').trim();
    if (directAudio) {
      return directAudio;
    }

    const fallback = (evidence.url ?? '').trim();
    if (fallback && this.looksLikeAudioUrl(fallback)) {
      return fallback;
    }

    return null;
  }

  private getApiOrigin(): string {
    try {
      return new URL(environment.apiUrl, window.location.origin).origin;
    } catch {
      return window.location.origin;
    }
  }

  getEvidenceUrl(url: string | null): string {
    if (!url) {
      return '';
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return '';
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const apiOrigin = this.getApiOrigin();
    if (trimmed.startsWith('/')) {
      return `${apiOrigin}${trimmed}`;
    }

    return `${apiOrigin}/${trimmed.replace(/^\.?\//, '')}`;
  }

  openTechnicianLocationInMaps(item: WorkshopIncomingRequestItem): void {
    const lat = typeof item.tecnico_latitud === 'number' ? item.tecnico_latitud : null;
    const lng = typeof item.tecnico_longitud === 'number' ? item.tecnico_longitud : null;

    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.errorMessage = 'El técnico aún no compartió una ubicación válida.';
      this.requestRender();
      return;
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  }

  private cleanTextEvidence(text: string | null): string | null {
    if (!text) {
      return null;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const taggedUserText = trimmed.match(/\[texto_usuario\](.+)/i);
    if (taggedUserText?.[1]?.trim()) {
      return taggedUserText[1].trim();
    }

    if (trimmed.toLowerCase().startsWith('[audio_ref]')) {
      return null;
    }

    return trimmed.replace(/\[(audio_ref|audio_transcripcion|imagen_analisis|texto_usuario)\]/gi, '').trim() || null;
  }

  // Helpers para mostrar evidencias por tipo
  getImages(request: WorkshopIncomingRequestItem) {
    return request.evidencias.filter(
      (e) => e.tipo === 'imagen' || this.looksLikeImageUrl(e.url)
    );
  }

  getAudios(request: WorkshopIncomingRequestItem) {
    return request.evidencias.filter(
      (e) => e.tipo === 'audio' || !!this.resolveEvidenceAudioUrl(e)
    );
  }

  getAudioSource(evidence: { url?: string | null; url_audio?: string | null }): string {
    return this.getEvidenceUrl(this.resolveEvidenceAudioUrl(evidence));
  }

  getTexts(request: WorkshopIncomingRequestItem) {
    return request.evidencias
      .filter((e) => e.tipo === 'texto' || e.tipo === 'texto_usuario')
      .map((e) => ({ ...e, texto_extraido: this.cleanTextEvidence(e.texto_extraido) }))
      .filter((e) => !!e.texto_extraido);
  }

  // Función para cerrar la sesión actual
  logout() {
    // 1. Limpiamos los tokens y credenciales almacenadas localmente
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    
    // 2. Redirigimos al usuario a la pantalla del landing (o de inicio)
    this.router.navigate(['/']);
  }

  private scheduleMapRender(): void {
    if (this.mapInitTimer) {
      clearTimeout(this.mapInitTimer);
      this.mapInitTimer = null;
    }

    this.mapInitTimer = setTimeout(() => {
      this.mapInitTimer = null;
      this.initializeIncidentMap();
    }, 0);
  }

  private initializeIncidentMap(): void {
    if (!this.showModal || !this.selectedRequest || !this.hasSelectedRequestCoordinates) {
      this.destroyIncidentMap();
      return;
    }

    const mapElement = document.getElementById('incident-map');
    if (!mapElement) {
      return;
    }

    this.destroyIncidentMap();

    const incidentCoordinates = this.getIncidentCoordinates(this.selectedRequest);
    const technicianCoordinates = this.getTechnicianCoordinates(this.selectedRequest);
    const initialCenter = technicianCoordinates ?? incidentCoordinates;
    if (!initialCenter) {
      this.destroyIncidentMap();
      return;
    }

    this.incidentMap = L.map(mapElement, {
      zoomControl: true,
      attributionControl: true
    }).setView(initialCenter, 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.incidentMap);

    this.technicianTrail = [];
    this.refreshIncidentMapOverlays();

    setTimeout(() => {
      this.incidentMap?.invalidateSize();
    }, 0);
  }

  private refreshIncidentMapOverlays(): void {
    if (!this.incidentMap || !this.selectedRequest) {
      return;
    }

    if (this.incidentMarker) {
      this.incidentMap.removeLayer(this.incidentMarker);
      this.incidentMarker = null;
    }
    if (this.technicianMarker) {
      this.incidentMap.removeLayer(this.technicianMarker);
      this.technicianMarker = null;
    }
    if (this.technicianTrailPolyline) {
      this.incidentMap.removeLayer(this.technicianTrailPolyline);
      this.technicianTrailPolyline = null;
    }

    const incidentCoordinates = this.getIncidentCoordinates(this.selectedRequest);
    const technicianCoordinates = this.getTechnicianCoordinates(this.selectedRequest);

    if (incidentCoordinates) {
      this.incidentMarker = L.circleMarker(incidentCoordinates, {
        radius: 9,
        color: '#1d4ed8',
        weight: 3,
        fillColor: '#60a5fa',
        fillOpacity: 0.75
      })
        .addTo(this.incidentMap)
        .bindPopup('Ubicación reportada del incidente');
    }

    if (technicianCoordinates) {
      const lastTrailPoint = this.technicianTrail[this.technicianTrail.length - 1] as [number, number] | undefined;
      const isDuplicate = !!lastTrailPoint
        && lastTrailPoint[0] === technicianCoordinates[0]
        && lastTrailPoint[1] === technicianCoordinates[1];

      if (!isDuplicate) {
        this.technicianTrail = [...this.technicianTrail, technicianCoordinates].slice(-80);
      }

      this.technicianMarker = L.circleMarker(technicianCoordinates, {
        radius: 8,
        color: '#b91c1c',
        weight: 3,
        fillColor: '#f87171',
        fillOpacity: 0.9
      })
        .addTo(this.incidentMap)
        .bindPopup('Ubicación actual del técnico');

      if (this.technicianTrail.length >= 2) {
        this.technicianTrailPolyline = L.polyline(this.technicianTrail, {
          color: '#ef4444',
          weight: 4,
          opacity: 0.8,
        }).addTo(this.incidentMap);
      }
    }

    const boundsLayers: L.Layer[] = [];
    if (this.incidentMarker) {
      boundsLayers.push(this.incidentMarker);
    }
    if (this.technicianMarker) {
      boundsLayers.push(this.technicianMarker);
    }
    if (this.technicianTrailPolyline) {
      boundsLayers.push(this.technicianTrailPolyline);
    }

    if (boundsLayers.length > 0) {
      const group = L.featureGroup(boundsLayers);
      this.incidentMap.fitBounds(group.getBounds(), {
        padding: [24, 24],
        maxZoom: 16,
      });
    }

    this.incidentMap.invalidateSize();
  }

  private getIncidentCoordinates(request: WorkshopIncomingRequestItem): [number, number] | null {
    const lat = request.latitud;
    const lng = request.longitud;
    if (
      typeof lat === 'number'
      && typeof lng === 'number'
      && Number.isFinite(lat)
      && Number.isFinite(lng)
    ) {
      return [lat, lng];
    }
    return null;
  }

  private getTechnicianCoordinates(request: WorkshopIncomingRequestItem): [number, number] | null {
    const lat = request.tecnico_latitud;
    const lng = request.tecnico_longitud;
    if (
      typeof lat === 'number'
      && typeof lng === 'number'
      && Number.isFinite(lat)
      && Number.isFinite(lng)
    ) {
      return [lat, lng];
    }
    return null;
  }

  private destroyIncidentMap(): void {
    if (this.incidentMap) {
      this.incidentMap.remove();
      this.incidentMap = null;
    }
    this.incidentMarker = null;
    this.technicianMarker = null;
    this.technicianTrailPolyline = null;
    this.technicianTrail = [];
  }

  // ─── PAGOS ───────────────────────────────────────────────────────

  canManagePayment(item: PaymentListItemResponse): boolean {
    return item.status === 'verificacion';
  }

  isPaymentActionInProgress(paymentId: number): boolean {
    return this.confirmingPaymentId === paymentId || this.rejectingPaymentId === paymentId;
  }

  confirmPayment(item: PaymentListItemResponse): void {
    if (this.confirmingPaymentId !== null || this.rejectingPaymentId !== null) {
      return;
    }

    if (!this.canManagePayment(item)) {
      this.paymentActionError = 'Solo puedes confirmar pagos en estado verificación.';
      this.paymentActionSuccess = null;
      return;
    }

    this.paymentActionError = null;
    this.paymentActionSuccess = null;
    this.confirmingPaymentId = item.payment_id;

    this.paymentService.confirmPayment({ payment_id: item.payment_id }).pipe(
      timeout(20000),
      finalize(() => {
        this.confirmingPaymentId = null;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.paymentActionSuccess = response.message || `Pago ${item.payment_id} confirmado correctamente.`;
        this.refreshIncomingRequests();
        this.loadHistory();
        this.loadWorkshopPayments();
      },
      error: (err) => {
        this.paymentActionError = err?.error?.detail || 'No se pudo confirmar el pago.';
      }
    });
  }

  rejectPayment(item: PaymentListItemResponse): void {
    if (this.confirmingPaymentId !== null || this.rejectingPaymentId !== null) {
      return;
    }

    if (!this.canManagePayment(item)) {
      this.paymentActionError = 'Solo puedes rechazar pagos en estado verificación.';
      this.paymentActionSuccess = null;
      return;
    }

    const reason = (this.paymentRejectReasonById[item.payment_id] || '').trim();

    this.paymentActionError = null;
    this.paymentActionSuccess = null;
    this.rejectingPaymentId = item.payment_id;

    this.paymentService.rejectPayment({
      payment_id: item.payment_id,
      reason: reason || null,
    }).pipe(
      timeout(20000),
      finalize(() => {
        this.rejectingPaymentId = null;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.paymentActionSuccess = response.message || `Pago ${item.payment_id} rechazado correctamente.`;
        this.loadWorkshopPayments();
      },
      error: (err) => {
        this.paymentActionError = err?.error?.detail || 'No se pudo rechazar el pago.';
      }
    });
  }

  getPaymentStatusLabel(status: string): string {
    const normalized = (status || '').trim().toLowerCase();
    if (normalized === 'pendiente') {
      return 'Pendiente';
    }
    if (normalized === 'verificacion') {
      return 'En verificación';
    }
    if (normalized === 'confirmado') {
      return 'Confirmado';
    }
    if (normalized === 'rechazado') {
      return 'Rechazado';
    }
    return status || 'Sin estado';
  }

  getPaymentProofUrl(item: PaymentListItemResponse): string {
    const rawUrl = item.proof_image_url_absolute || item.proof_image_url;
    return this.paymentService.getAbsoluteUrl(rawUrl);
  }

  getQrDisplayUrl(): string | null {
    const qrUrl = this.workshopQrImageUrlInput.trim();
    if (!qrUrl) {
      return null;
    }
    const absolute = this.paymentService.getAbsoluteUrl(qrUrl);
    console.log('QR URL:', qrUrl, '-> Absolute:', absolute); // Debug
    return absolute || null;
  }

  onQrImageError(event: Event): void {
    console.error('Error cargando imagen QR:', this.workshopQrImageUrlInput);
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    this.workshopProfileError = 'No se pudo cargar la imagen del QR. Verifica que la URL sea correcta.';
  }

  onQrImageLoad(): void {
    console.log('Imagen QR cargada exitosamente');
    this.workshopProfileError = null;
  }

  // ─── COMISIONES ───────────────────────────────────────────────────────

  loadCommissionSummary(): void {
    this.commissionError = null;
    this.isLoadingCommissionSummary = true;

    this.paymentService.getWorkshopCommissionSummary().pipe(
      timeout(20000),
      finalize(() => {
        this.isLoadingCommissionSummary = false;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.commissionSummary = response;
        this.platformQrUrl = response.qr_image_url || null;
        this.loadCommissionPayments();
      },
      error: (err) => {
        this.commissionError = err?.error?.detail || 'No se pudo cargar el resumen de comisiones.';
      }
    });
  }

  loadCommissionPayments(): void {
    this.paymentService.getWorkshopCommissionPayments().pipe(
      timeout(20000),
      finalize(() => {
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.commissionPayments = Array.isArray(response?.payments) ? response.payments : [];
      },
      error: (err) => {
        console.error('Error loading commission payments:', err);
      }
    });
  }

  openCommissionPaymentModal(): void {
    if (!this.platformQrUrl) {
      this.commissionError = 'La plataforma aún no ha configurado un QR para pagos de comisión.';
      return;
    }

    if (!this.commissionSummary || this.commissionSummary.pending_commission <= 0) {
      this.commissionError = 'No tienes comisiones pendientes por pagar.';
      return;
    }

    this.showCommissionPaymentModal = true;
    this.commissionError = null;
    this.commissionSuccess = null;
    this.selectedCommissionProofFile = null;
    this.createdCommissionPaymentId = null;
  }

  closeCommissionPaymentModal(): void {
    if (this.isCreatingCommissionPayment || this.isUploadingCommissionProof) {
      return;
    }
    this.showCommissionPaymentModal = false;
    this.selectedCommissionProofFile = null;
    this.createdCommissionPaymentId = null;
    this.commissionError = null;
    this.commissionSuccess = null;
  }

  onCommissionProofFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    this.selectedCommissionProofFile = file;
  }

  createCommissionPayment(): void {
    if (this.isCreatingCommissionPayment || this.isUploadingCommissionProof) {
      return;
    }

    if (!this.commissionSummary || this.commissionSummary.pending_commission <= 0) {
      this.commissionError = 'No hay comisión pendiente para pagar.';
      return;
    }

    this.commissionError = null;
    this.commissionSuccess = null;
    this.isCreatingCommissionPayment = true;

    this.paymentService.createCommissionPayment({
      amount: this.commissionSummary.pending_commission
    }).pipe(
      timeout(20000),
      finalize(() => {
        this.isCreatingCommissionPayment = false;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.createdCommissionPaymentId = response.payment_id;
        this.commissionSuccess = response.message || 'Pago de comisión creado. Ahora sube tu comprobante.';
      },
      error: (err) => {
        this.commissionError = err?.error?.detail || 'No se pudo crear el pago de comisión.';
      }
    });
  }

  uploadCommissionProof(): void {
    if (this.isCreatingCommissionPayment || this.isUploadingCommissionProof) {
      return;
    }

    if (!this.createdCommissionPaymentId) {
      this.commissionError = 'Primero debes crear el pago de comisión.';
      return;
    }

    if (!this.selectedCommissionProofFile) {
      this.commissionError = 'Selecciona un comprobante de pago antes de subir.';
      return;
    }

    this.commissionError = null;
    this.commissionSuccess = null;
    this.isUploadingCommissionProof = true;

    this.paymentService.uploadCommissionProof(
      this.createdCommissionPaymentId,
      this.selectedCommissionProofFile
    ).pipe(
      timeout(30000),
      finalize(() => {
        this.isUploadingCommissionProof = false;
        this.requestRender();
      })
    ).subscribe({
      next: (response) => {
        this.commissionSuccess = response.message || 'Comprobante subido correctamente. Esperando validación del administrador.';
        this.selectedCommissionProofFile = null;
        this.loadCommissionSummary();
        setTimeout(() => {
          this.closeCommissionPaymentModal();
        }, 2000);
      },
      error: (err) => {
        this.commissionError = err?.error?.detail || 'No se pudo subir el comprobante de comisión.';
      }
    });
  }

  getCommissionPaymentStatusLabel(status: string): string {
    const normalized = (status || '').trim().toLowerCase();
    if (normalized === 'pendiente') {
      return 'Pendiente';
    }
    if (normalized === 'verificacion') {
      return 'En verificación';
    }
    if (normalized === 'confirmado') {
      return 'Confirmado';
    }
    if (normalized === 'rechazado') {
      return 'Rechazado';
    }
    return status || 'Sin estado';
  }

  getCommissionProofUrl(payment: CommissionPaymentListItemResponse): string {
    const rawUrl = payment.proof_image_url_absolute || payment.proof_image_url;
    return this.paymentService.getAbsoluteUrl(rawUrl);
  }

  getPlatformQrDisplayUrl(): string | null {
    if (!this.platformQrUrl) {
      return null;
    }
    return this.paymentService.getAbsoluteUrl(this.platformQrUrl);
  }

  get activeCommissionPayments(): CommissionPaymentListItemResponse[] {
    return this.commissionPayments.filter(
      (payment) => payment.status === 'pendiente' || payment.status === 'verificacion'
    );
  }

  get historicalCommissionPayments(): CommissionPaymentListItemResponse[] {
    return this.commissionPayments.filter(
      (payment) => payment.status === 'confirmado' || payment.status === 'rechazado'
    );
  }

  toggleCommissionHistory(): void {
    this.showCommissionHistory = !this.showCommissionHistory;
  }

  get activePayments(): PaymentListItemResponse[] {
    return this.workshopPayments.filter(
      (payment) => payment.status === 'pendiente' || payment.status === 'verificacion'
    );
  }

  get historicalPayments(): PaymentListItemResponse[] {
    return this.workshopPayments.filter(
      (payment) => payment.status === 'confirmado' || payment.status === 'rechazado'
    );
  }

  togglePaymentHistory(): void {
    this.showPaymentHistory = !this.showPaymentHistory;
  }
}
