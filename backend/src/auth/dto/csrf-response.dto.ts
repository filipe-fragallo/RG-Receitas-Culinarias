import { ApiProperty } from '@nestjs/swagger';

export class CsrfResponseDto {
  @ApiProperty({
    description: 'Token CSRF vinculado à sessão atual ou ao cookie temporário pré-autenticação.',
  })
  csrfToken!: string;
}
