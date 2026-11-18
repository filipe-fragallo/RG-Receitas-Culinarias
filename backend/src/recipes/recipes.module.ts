import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesModule } from '../categories/categories.module';
import { Recipe } from './recipe.entity';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Recipe]), CategoriesModule],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
