export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }

  static badRequest(message: string) {
    return new AppError(message, 400, 'BAD_REQUEST');
  }

  static unauthorized(message: string = 'Não autorizado') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Acesso negado') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Não encontrado') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string) {
    return new AppError(message, 409, 'CONFLICT');
  }

  static internal(message: string = 'Erro interno do servidor') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}
