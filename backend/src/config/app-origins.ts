import { ConfigService } from '@nestjs/config';

export function getAllowedOrigins(configService: ConfigService): string[] {
  return configService
    .get<string>('CORS_ORIGIN', 'http://localhost:3000,http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
