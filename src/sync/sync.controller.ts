import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncEntityType, SyncStatus } from '../common/entities/sync-log.entity';

@ApiTags('Sync Logs')
@Controller('sync/logs')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get()
  @ApiOperation({ summary: 'Get sync logs' })
  async getLogs(
    @Query('entityType') entityType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const et = (entityType as unknown as SyncEntityType) || undefined;
    const st = (status as unknown as SyncStatus) || undefined;
    const lim = limit ? parseInt(limit, 10) || 100 : 100;
    return this.syncService.getAllLogs(et, st, lim);
  }
}
