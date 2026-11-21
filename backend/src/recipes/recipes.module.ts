import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { CategoriesModule } from '../categories/categories.module';
import { Recipe } from '../database/models/recipe.model';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [SequelizeModule.forFeature([Recipe]), CategoriesModule],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
