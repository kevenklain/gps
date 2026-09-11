export type ConnectionStatus = 'online' | 'sem_comunicacao' | 'offline' | 'inativo';

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  tipo: 'admin' | 'funcionario';
  ativo: boolean;
};

export type Ambulancia = {
  id: number;
  usuario_id: number | null;
  nome: string;
  identificador: string;
  placa: string | null;
  modelo_veiculo: string | null;
  quilometragem: string | number;
  latitude: string | number | null;
  longitude: string | number | null;
  velocidade: string | number | null;
  precisao_gps: string | number | null;
  bateria: number | null;
  ultima_comunicacao: string | null;
  ativo: boolean;
  status: ConnectionStatus;
};

export type MobileContext = {
  usuario: Usuario;
  ambulancia: Ambulancia;
};

export type ApiErrorPayload = {
  sucesso?: boolean;
  mensagem?: string;
  message?: string;
  errors?: Record<string, string[]>;
};
