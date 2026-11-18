import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRecipeDto {
  @ApiProperty({ example: 'Bolo de cenoura com cobertura', minLength: 1, maxLength: 45 })
  @Transform(trim)
  @IsString({ message: 'O nome da receita é obrigatório.' })
  @Length(1, 45, { message: 'O nome da receita deve ter entre 1 e 45 caracteres.' })
  nome!: string;

  @ApiProperty({ example: 1, description: 'ID de uma categoria existente.' })
  @Type(() => Number)
  @IsInt({ message: 'Selecione uma categoria válida.' })
  @Min(1, { message: 'Selecione uma categoria válida.' })
  categoriaId!: number;

  @ApiProperty({ example: 45, minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt({ message: 'O tempo de preparo deve ser um número inteiro de minutos.' })
  @Min(1, { message: 'O tempo de preparo deve ser maior que zero.' })
  @Max(100000, { message: 'O tempo de preparo informado é muito alto.' })
  tempoPreparoMinutos!: number;

  @ApiProperty({ example: 8, minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt({ message: 'A quantidade de porções deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade de porções deve ser maior que zero.' })
  @Max(1000, { message: 'A quantidade de porções informada é muito alta.' })
  porcoes!: number;

  @ApiProperty({
    example: '3 cenouras médias\n3 ovos\n2 xícaras de farinha de trigo',
    description: 'Texto livre. O frontend sugere um ingrediente por linha.',
    maxLength: 5000,
  })
  @Transform(trim)
  @IsString({ message: 'Os ingredientes são obrigatórios.' })
  @Length(1, 5000, { message: 'Os ingredientes devem ter entre 1 e 5000 caracteres.' })
  ingredientes!: string;

  @ApiProperty({
    example:
      'Bata as cenouras, os ovos e o óleo no liquidificador.\nMisture os secos e asse por 40 minutos.',
    description: 'Texto livre com o passo a passo.',
    maxLength: 10000,
  })
  @Transform(trim)
  @IsString({ message: 'O modo de preparo é obrigatório.' })
  @Length(1, 10000, { message: 'O modo de preparo deve ter entre 1 e 10000 caracteres.' })
  modoPreparo!: string;
}
