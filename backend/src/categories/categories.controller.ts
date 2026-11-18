import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CategoriesService } from './categories.service';
import { CategoryResponseDto } from './dto/category-response.dto';

@ApiTags('Categorias')
@ApiBearerAuth('access-token')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as categorias cadastradas',
    description: 'Retorna as 13 categorias carregadas pelo script SQL do desafio.',
  })
  @ApiOkResponse({ description: 'Categorias em ordem alfabética.', type: [CategoryResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.' })
  findAll(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll();
  }
}
