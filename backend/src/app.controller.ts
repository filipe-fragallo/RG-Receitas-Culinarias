import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

import { Public } from './common/decorators/public.decorator';

@ApiTags('Saúde')
@Controller('health')
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Verifica a API e a conexão com o MySQL' })
  @ApiOkResponse({ description: 'API e banco disponíveis.' })
  async check(): Promise<{ status: string; database: string; timestamp: string }> {
    await this.dataSource.query('SELECT 1');

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
