import { ApiProperty } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Maria Silva', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'maria.silva' })
  login!: string;

  @ApiProperty({ example: '2026-01-15T12:00:00.000Z', format: 'date-time' })
  createdAt!: Date;
}
