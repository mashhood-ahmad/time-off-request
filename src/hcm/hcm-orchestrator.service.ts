import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HCMClientService,
  HCMBalanceResponse,
  HCMWebhookPayload,
} from './hcm-client.service';
import { BalancesService } from '../balances/balances.service';
import { TimeOffRequest } from '../common/entities/time-off-request.entity';
import {
  SyncLog,
  SyncEntityType,
  SyncAction,
  SyncStatus,
} from '../common/entities/sync-log.entity';
import { Balance } from '../common/entities/balance.entity';

@Injectable()
export class HCMOrchestratorService {
  private readonly logger = new Logger(HCMOrchestratorService.name);

  constructor(
    private readonly hcmClient: HCMClientService,
    private readonly balancesService: BalancesService,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  async syncTimeOffToHCM(requestId: string): Promise<void> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });
    if (!request) {
      this.logger.warn(`Cannot sync non-existent request ${requestId}`);
      return;
    }

    const result = await this.hcmClient.deductBalance({
      employeeId: request.employeeId,
      locationId: request.locationId,
      days: request.daysRequested,
      requestId: request.id,
    });

    request.syncedToHCM = result.success;
    request.hcmError = result.error || null;
    request.syncedAt = new Date();

    await this.requestRepository.save(request);

    const syncLog = this.syncLogRepository.create({
      entityType: SyncEntityType.TIME_OFF_REQUEST,
      entityId: request.id,
      action: SyncAction.CREATE,
      status: result.success ? SyncStatus.SUCCESS : SyncStatus.FAILED,
      requestPayload: JSON.stringify({
        employeeId: request.employeeId,
        locationId: request.locationId,
        days: request.daysRequested,
      }),
      responsePayload: JSON.stringify(result),
      errorMessage: result.error || null,
    });
    await this.syncLogRepository.save(syncLog);
  }

  async handleWebhook(payload: HCMWebhookPayload): Promise<void> {
    this.logger.log(
      `Processing HCM webhook: ${payload.eventType} for employee ${payload.employeeId}`,
    );

    switch (payload.eventType) {
      case 'balance_change':
      case 'anniversary':
      case 'yearly_refresh': {
        await this.balancesService.updateBalanceFromHCM(
          payload.employeeId,
          payload.locationId,
          payload.totalDays ?? 0,
          payload.usedDays,
        );

        const syncLog = this.syncLogRepository.create({
          entityType: SyncEntityType.BALANCE,
          entityId:
            (payload.employeeId ?? '') + ':' + (payload.locationId ?? ''),
          action: SyncAction.SYNC,
          status: SyncStatus.SUCCESS,
          requestPayload: JSON.stringify(payload),
          responsePayload: null,
          errorMessage: null,
        });
        await this.syncLogRepository.save(syncLog);
        break;
      }

      default:
        this.logger.warn(
          'Unknown webhook event type: ' + String(payload.eventType),
        );
    }
  }

  async pullBalancesFromHCM(): Promise<void> {
    this.logger.log('Pulling all balances from HCM...');

    const balances = await this.balanceRepository.find({
      relations: ['employee', 'location'],
    });

    const hcmBalances: HCMBalanceResponse[] = [];
    for (const balance of balances) {
      try {
        const hcmBalance = await this.hcmClient.getBalance(
          balance.employeeId,
          balance.locationId,
        );
        hcmBalances.push(hcmBalance);
      } catch {
        this.logger.warn(
          `Could not fetch HCM balance for employee ${balance.employeeId} at location ${balance.locationId}`,
        );
      }
    }

    for (const hcmBalance of hcmBalances) {
      await this.balancesService.updateBalanceFromHCM(
        hcmBalance.employeeId,
        hcmBalance.locationId,
        hcmBalance.totalDays,
        hcmBalance.usedDays,
      );
    }

    this.logger.log(`Synced ${hcmBalances.length} balances from HCM`);
  }

  async pushBalancesToHCM(): Promise<void> {
    this.logger.log('Pushing all balances to HCM...');

    const balances = await this.balanceRepository.find();
    const hcmBalances: HCMBalanceResponse[] = balances.map((b) => ({
      employeeId: b.employeeId,
      locationId: b.locationId,
      totalDays: b.totalDays,
      usedDays: b.usedDays + b.pendingDays,
    }));

    const result = await this.hcmClient.batchSyncBalances(hcmBalances);

    const syncLog = this.syncLogRepository.create({
      entityType: SyncEntityType.BALANCE,
      entityId: 'batch',
      action: SyncAction.SYNC,
      status: result.success ? SyncStatus.SUCCESS : SyncStatus.FAILED,
      requestPayload: JSON.stringify({ count: hcmBalances.length }),
      responsePayload: JSON.stringify(result),
      errorMessage:
        result.errors?.length > 0 ? JSON.stringify(result.errors) : null,
    });
    await this.syncLogRepository.save(syncLog);

    this.logger.log(
      `Pushed ${hcmBalances.length} balances to HCM (${result.processed} processed)`,
    );
  }
}
