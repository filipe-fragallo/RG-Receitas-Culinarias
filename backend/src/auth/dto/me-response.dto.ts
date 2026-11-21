import { ApiProperty } from '@nestjs/swagger';

import { PublicUserDto } from '../../users/dto/public-user.dto';

export class MeResponseDto {
  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;

  @ApiProperty({
    description: 'Token CSRF vigente, usado nas requisições que modificam dados.',
  })
  csrfToken!: string;
}
