import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'maria.silva' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({ message: 'O login é obrigatório.' })
  @MinLength(1, { message: 'O login é obrigatório.' })
  @MaxLength(100, { message: 'O login deve ter no máximo 100 caracteres.' })
  login!: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString({ message: 'A senha é obrigatória.' })
  @MinLength(1, { message: 'A senha é obrigatória.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha!: string;
}
