export interface RegisterRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
  tipo_usuario: 'cliente' | 'taller' | 'tecnico' | 'empleado';
  nombre_taller?: string;
  ubicacion_taller?: string;
}

export interface RegisterResponse {
  id: number;
  nombre: string;
  correo: string;
  tipo_usuario: string;
  creado_en: string;
  mensaje: string;
}
