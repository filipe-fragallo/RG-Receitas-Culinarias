import { ApiProperty } from '@nestjs/swagger';

import { PublicUserDto } from '../../users/dto/public-user.dto';

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 3600, description: 'Validade do token em segundos.' })
  expiresIn!: number;

  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;
}
