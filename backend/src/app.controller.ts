import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Sequelize } from 'sequelize-typescript';

import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(private readonly sequelize: Sequelize) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Verifica a API e a conexão com o MySQL' })
  @ApiOkResponse({ description: 'API e banco disponíveis.' })
  async check(): Promise<{ status: string; database: string; timestamp: string }> {
    await this.sequelize.query('SELECT 1');

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
