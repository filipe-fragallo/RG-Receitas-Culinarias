import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  errors?: string[];
  timestamp: string;
  path: string;
}

const STATUS_TEXT: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Padroniza todos os erros da API no mesmo formato e evita vazar
 * detalhes internos (stack trace, SQL) em respostas 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const { message, errors } = this.extractError(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} falhou`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      error: STATUS_TEXT[status] ?? 'Error',
      message,
      ...(errors && errors.length > 0 ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.status(status).json(body);
  }

  private extractError(exception: unknown): { message: string; errors?: string[] } {
    if (!(exception instanceof HttpException)) {
      return { message: 'Erro interno do servidor. Tente novamente mais tarde.' };
    }

    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { message: payload };
    }

    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      const payloadMessage = record.message;

      if (Array.isArray(payloadMessage)) {
        const errors = [
          ...new Set(payloadMessage.filter((item): item is string => typeof item === 'string')),
        ];
        return {
          message: 'Dados inválidos. Revise os campos e tente novamente.',
          errors,
        };
      }

      if (typeof payloadMessage === 'string') {
        return { message: payloadMessage };
      }
    }

    return { message: exception.message };
  }
}
