import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { Category } from '../database/models/category.model';

@Injectable()
export class CategoriesService {
  constructor(@InjectModel(Category) private readonly categoryModel: typeof Category) {}

  async findAll(): Promise<Category[]> {
    return this.categoryModel.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
  }

  async findById(id: number): Promise<Category | null> {
    return this.categoryModel.findByPk(id);
  }
}
