// Erros do app com mensagens genéricas. Detalhes do servidor/banco nunca chegam à interface.
export type AppErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'network'
  | 'ai_unavailable'
  | 'unknown';

const MESSAGES: Record<AppErrorCode, string> = {
  unauthenticated: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Você não tem permissão para esta ação.',
  validation: 'Confira os dados informados e tente novamente.',
  not_found: 'Registro não encontrado.',
  conflict: 'Este registro já existe.',
  rate_limited: 'Limite de uso atingido. Tente novamente mais tarde.',
  network: 'Sem conexão. Verifique a internet e tente novamente.',
  ai_unavailable: 'O assistente não está disponível agora. Tente novamente.',
  unknown: 'Algo deu errado. Tente novamente.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  constructor(code: AppErrorCode) {
    super(MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
  }
}

interface PostgrestLike {
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

/** Converte qualquer erro em AppError. Nunca repassa a mensagem original. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError) return new AppError('network');
  if (typeof error === 'object' && error !== null) {
    const e = error as PostgrestLike;
    const code = typeof e.code === 'string' ? e.code : '';
    const status = typeof e.status === 'number' ? e.status : 0;
    const message = typeof e.message === 'string' ? e.message : '';
    if (status === 401 || code === 'PGRST301' || code === 'PGRST303' || /jwt/i.test(message)) {
      return new AppError('unauthenticated');
    }
    if (code === '42501' || status === 403) return new AppError('forbidden');
    if (code === 'PGRST116') return new AppError('not_found');
    if (code === '23505' || status === 409) return new AppError('conflict');
    if (code === '23514' || code === '22P02' || code === '22003' || code === '23502') {
      return new AppError('validation');
    }
  }
  return new AppError('unknown');
}

export function messageFor(error: unknown): string {
  return toAppError(error).message;
}
