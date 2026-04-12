export interface LoginRequest {
  correo: string;
  password: string;
  canal: 'mobile' | 'web';
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  usuario_id: number;
  nombre: string;
  correo: string;
  roles: string[];
  perfil_principal: string;
  canal: string;
  mensaje: string;
}
