import { ChangeDetectorRef, Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import * as L from 'leaflet';
import { IncidentService, WorkshopIncomingRequestItem } from '../../core/services/incident.service';
import {
  WorkshopService,
  WorkshopTechnicianListItemResponse,
  WorkshopTechnicianLocationItem,
  WorkshopIncidentHistoryItemResponse,
  WorkshopTechnicianCandidateResponse,
  WorkshopVehicleCreateRequest,
  WorkshopVehicleResponse,
  WorkshopVehicleUpdateRequest
} from '../../core/services/workshop.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private incidentService = inject(IncidentService);
  private workshopService = inject(WorkshopService);
  private cdr = inject(ChangeDetectorRef);
  
  // Pestaña actual
  currentTab: 'inicio' | 'vehiculos' | 'tecnicos' | 'historial' = 'inicio';

  // Nombre del taller simulado por defecto
  tallerNombre = 'Taller Mecánico';
  
  // Estado para la tabla/lista principal
  solicitudesEntrantes: WorkshopIncomingRequestItem[] = [];
  errorMessage: string | null = null;
  
  // Estado para Técnicos
  tecnicos: WorkshopTechnicianListItemResponse[] = [];
  ubicaciones: WorkshopTechnicianLocationItem[] = [];
  tecnicosError: string | null = null;

  // Estado para Historial
  historial: WorkshopIncidentHistoryItemResponse[] = [];
  historialError: string | null = null;

  // Timer para actualización
  ubicacionTimer: any;
  incomingTimer: any;
  incomingToastTimer: any;
  incomingNotice: string | null = null;
  knownIncomingRequestIds: Set<number> = new Set<number>();

  // Estado del modal de detalle y aceptación
  selectedRequest: WorkshopIncomingRequestItem | null = null;
  showModal = false;
  isLoadingDecisionResources = false;
  selectedTransportId: number | null = null;
  private incidentMap: L.Map | null = null;
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
    if (this.mapInitTimer) {
      clearTimeout(this.mapInitTimer);
      this.mapInitTimer = null;
    }
    this.destroyIncidentMap();
  }

  setTab(tab: 'inicio' | 'vehiculos' | 'tecnicos' | 'historial') {
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
    // Refresca solicitudes en segundo plano para notificar nuevas emergencias.
    this.incomingTimer = setInterval(() => this.loadIncomingRequests(true), 10000);
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
    }
  }

  loadIncomingRequests(showNoticeForNew = false) {
    this.errorMessage = null;
    this.incidentService.getIncomingRequests().subscribe({
      next: (res) => {
        const previousIds = this.knownIncomingRequestIds;
        const hadPreviousSync = previousIds.size > 0;

        this.solicitudesEntrantes = res.solicitudes;

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
        this.historial = res.historial;
        this.requestRender();
      },
      error: (err) => {
        console.error('Error cargando historial:', err);
        this.historialError = 'No se pudo cargar el historial.';
        this.requestRender();
      }
    });
  }

  openDetails(request: WorkshopIncomingRequestItem) {
    this.selectedRequest = request;
    this.showModal = true;
    this.selectedTransportId = null;
    this.loadDecisionResources();
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
        this.loadIncomingRequests();
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
        this.loadIncomingRequests();
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
    const lat = this.selectedRequest.latitud;
    const lng = this.selectedRequest.longitud;
    return (
      typeof lat === 'number'
      && typeof lng === 'number'
      && Number.isFinite(lat)
      && Number.isFinite(lng)
    );
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
    return this.isVehicleActionInProgress || this.isTechnicianActionInProgress || this.isRequestDecisionInProgress;
  }

  private requestRender(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignorar si el componente ya fue destruido mientras resolvia una peticion.
    }
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
      (e) => e.tipo === 'audio' || this.looksLikeAudioUrl(e.url)
    );
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

    const latitude = Number(this.selectedRequest.latitud);
    const longitude = Number(this.selectedRequest.longitud);

    this.incidentMap = L.map(mapElement, {
      zoomControl: true,
      attributionControl: true
    }).setView([latitude, longitude], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.incidentMap);

    L.circleMarker([latitude, longitude], {
      radius: 9,
      color: '#1d4ed8',
      weight: 3,
      fillColor: '#60a5fa',
      fillOpacity: 0.75
    })
      .addTo(this.incidentMap)
      .bindPopup('Ubicación reportada del incidente')
      .openPopup();

    setTimeout(() => {
      this.incidentMap?.invalidateSize();
    }, 0);
  }

  private destroyIncidentMap(): void {
    if (this.incidentMap) {
      this.incidentMap.remove();
      this.incidentMap = null;
    }
  }
}
