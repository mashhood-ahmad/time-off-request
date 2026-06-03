import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SyncLog,
  SyncEntityType,
  SyncAction,
  SyncStatus,
} from '../common/entities/sync-log.entity';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  async log(
    entityType: SyncEntityType,
    entityId: string,
    action: SyncAction,
    status: SyncStatus,
    requestPayload?: Record<string, unknown>,
    responsePayload?: Record<string, unknown>,
    errorMessage?: string,
  ): Promise<SyncLog> {
    const log = this.syncLogRepository.create({
      entityType: entityType,
      entityId,
      action: action,
      status: status,
      requestPayload: requestPayload ? JSON.stringify(requestPayload) : null,
      responsePayload: responsePayload ? JSON.stringify(responsePayload) : null,
      errorMessage: errorMessage || null,
    });
    return this.syncLogRepository.save(log);
  }

  async getAllLogs(
    entityType?: SyncEntityType,
    status?: SyncStatus,
    limit = 100,
  ): Promise<SyncLog[]> {
    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (status) where.status = status;

    return this.syncLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getLogsForEntity(
    entityType: SyncEntityType,
    entityId: string,
  ): Promise<SyncLog[]> {
    return this.syncLogRepository.find({
      where: { entityType: entityType as string, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
