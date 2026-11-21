import { ApiProperty } from '@nestjs/swagger';

import { PublicUserDto } from '../../users/dto/public-user.dto';

export class AuthResponseDto {
  @ApiProperty({
    example: 3600,
    description: 'Validade da sessão em segundos. O JWT fica apenas no cookie HttpOnly.',
  })
  expiresIn!: number;

  @ApiProperty({
    description: 'Token CSRF da sessão, enviado pelo cliente no header X-CSRF-Token.',
  })
  csrfToken!: string;

  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;
}
