import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

import { Match } from '../../common/decorators/match.decorator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva', minLength: 3, maxLength: 100 })
  @Transform(trim)
  @IsString({ message: 'O nome é obrigatório.' })
  @Length(3, 100, { message: 'O nome deve ter entre 3 e 100 caracteres.' })
  nome!: string;

  @ApiProperty({ example: 'maria.silva', minLength: 3, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({ message: 'O login é obrigatório.' })
  @Length(3, 100, { message: 'O login deve ter entre 3 e 100 caracteres.' })
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'O login deve conter apenas letras, números, ponto, hífen ou sublinhado.',
  })
  login!: string;

  @ApiProperty({ example: 'Senha@123', minLength: 8, maxLength: 72 })
  @IsString({ message: 'A senha é obrigatória.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha!: string;

  @ApiProperty({ example: 'Senha@123', minLength: 8, maxLength: 72 })
  @IsString({ message: 'A confirmação de senha é obrigatória.' })
  @Match('senha', { message: 'As senhas não conferem.' })
  confirmarSenha!: string;
}
