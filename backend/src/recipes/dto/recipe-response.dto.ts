import { ApiProperty } from '@nestjs/swagger';

export class RecipeCategoryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Bolos e tortas doces', nullable: true })
  nome!: string | null;
}

export class RecipeResponseDto {
  @ApiProperty({ example: 10 })
  id!: number;

  @ApiProperty({ example: 'Bolo de cenoura com cobertura', nullable: true })
  nome!: string | null;

  @ApiProperty({ type: RecipeCategoryDto, nullable: true })
  categoria!: RecipeCategoryDto | null;

  @ApiProperty({ example: 45, nullable: true })
  tempoPreparoMinutos!: number | null;

  @ApiProperty({ example: 8, nullable: true })
  porcoes!: number | null;

  @ApiProperty({ example: '3 cenouras médias\n3 ovos', nullable: true })
  ingredientes!: string | null;

  @ApiProperty({ example: 'Bata as cenouras e misture os secos.' })
  modoPreparo!: string;

  @ApiProperty({ example: '2026-01-15T12:00:00.000Z', format: 'date-time' })
  criadoEm!: Date;

  @ApiProperty({ example: '2026-01-15T12:30:00.000Z', format: 'date-time' })
  alteradoEm!: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 9 })
  limit!: number;

  @ApiProperty({ example: 23 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedRecipesDto {
  @ApiProperty({ type: [RecipeResponseDto] })
  data!: RecipeResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class RecipeStatsDto {
  @ApiProperty({ example: 12 })
  totalReceitas!: number;

  @ApiProperty({ example: 5, description: 'Quantidade de categorias distintas usadas.' })
  categoriasUtilizadas!: number;

  @ApiProperty({
    example: '2026-01-15T12:30:00.000Z',
    format: 'date-time',
    nullable: true,
    description: 'Última alteração entre as receitas do usuário.',
  })
  atualizadaEm!: Date | null;
}
