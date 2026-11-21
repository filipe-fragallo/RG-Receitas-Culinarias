import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { QueryRecipesDto } from './dto/query-recipes.dto';
import { PaginatedRecipesDto, RecipeResponseDto, RecipeStatsDto } from './dto/recipe-response.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { RecipesService } from './recipes.service';

/** Mantém a mensagem de ID inválido no mesmo idioma do restante da API. */
const recipeIdPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException('Identificador da receita inválido.'),
});

const CSRF_HEADER_DOC = {
  name: 'X-CSRF-Token',
  description: 'Token devolvido por /api/auth/csrf, /api/auth/me, /auth/login ou /auth/register.',
  required: true,
};

@ApiTags('Recipes')
@ApiCookieAuth('auth-cookie')
@ApiUnauthorizedResponse({
  description: 'Sessão ausente, revogada, inválida ou expirada.',
})
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as receitas do usuário autenticado',
    description:
      'Pesquisa, filtro por categoria, ordenação e paginação são aplicados no banco. ' +
      'Receitas de outros usuários nunca são retornadas.',
  })
  @ApiOkResponse({ description: 'Página de receitas.', type: PaginatedRecipesDto })
  @ApiBadRequestResponse({ description: 'Parâmetros de consulta inválidos.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryRecipesDto,
  ): Promise<PaginatedRecipesDto> {
    return this.recipesService.findAll(user.id, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Resumo das receitas do usuário' })
  @ApiOkResponse({ description: 'Totais calculados no banco.', type: RecipeStatsDto })
  stats(@CurrentUser() user: AuthenticatedUser): Promise<RecipeStatsDto> {
    return this.recipesService.stats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma receita do usuário autenticado' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ description: 'Receita encontrada.', type: RecipeResponseDto })
  @ApiNotFoundResponse({ description: 'Receita inexistente ou pertencente a outro usuário.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', recipeIdPipe) id: number,
  ): Promise<RecipeResponseDto> {
    return this.recipesService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Cadastra uma receita',
    description:
      'O proprietário é sempre o usuário da sessão. Campos como userId não fazem parte ' +
      'do contrato e são rejeitados pela validação.',
  })
  @ApiHeader(CSRF_HEADER_DOC)
  @ApiCreatedResponse({ description: 'Receita criada.', type: RecipeResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou categoria inexistente.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecipeDto,
  ): Promise<RecipeResponseDto> {
    return this.recipesService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma receita do usuário autenticado' })
  @ApiHeader(CSRF_HEADER_DOC)
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ description: 'Receita atualizada.', type: RecipeResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos ou nenhum campo informado.' })
  @ApiNotFoundResponse({ description: 'Receita inexistente ou pertencente a outro usuário.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', recipeIdPipe) id: number,
    @Body() dto: UpdateRecipeDto,
  ): Promise<RecipeResponseDto> {
    return this.recipesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui uma receita do usuário autenticado' })
  @ApiHeader(CSRF_HEADER_DOC)
  @ApiParam({ name: 'id', example: 1 })
  @ApiNoContentResponse({ description: 'Receita excluída.' })
  @ApiNotFoundResponse({ description: 'Receita inexistente ou pertencente a outro usuário.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', recipeIdPipe) id: number,
  ): Promise<void> {
    await this.recipesService.remove(user.id, id);
  }
}
