import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const RECIPE_SORT_FIELDS = ['nome', 'criadoEm', 'alteradoEm'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type RecipeSortField = (typeof RECIPE_SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];

export class QueryRecipesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser maior que zero.' })
  page: number = 1;

  @ApiPropertyOptional({ default: 9, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser maior que zero.' })
  @Max(50, { message: 'O limite máximo é 50.' })
  limit: number = 9;

  @ApiPropertyOptional({ example: 'bolo', description: 'Pesquisa pelo nome da receita.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'A pesquisa deve ser um texto.' })
  @MaxLength(100, { message: 'A pesquisa deve ter no máximo 100 caracteres.' })
  search?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filtra por categoria.' })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'A categoria deve ser um número inteiro.' })
  @Min(1, { message: 'A categoria deve ser maior que zero.' })
  categoriaId?: number;

  @ApiPropertyOptional({ enum: RECIPE_SORT_FIELDS, default: 'criadoEm' })
  @IsOptional()
  @IsIn(RECIPE_SORT_FIELDS, { message: 'Ordenação inválida.' })
  sortBy: RecipeSortField = 'criadoEm';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS, { message: 'Direção de ordenação inválida.' })
  order: SortOrder = 'desc';
}
