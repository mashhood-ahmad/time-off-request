import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HCMClientService } from './hcm-client.service';
import { HCMOrchestratorService } from './hcm-orchestrator.service';
import { HCMController } from './hcm.controller';
import { HCMMockModule } from './hcm-mock.module';
import { BalancesModule } from '../balances/balances.module';
import { TimeOffRequest } from '../common/entities/time-off-request.entity';
import { Balance } from '../common/entities/balance.entity';
import { SyncLog } from '../common/entities/sync-log.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([TimeOffRequest, Balance, SyncLog]),
    ConfigModule,
    BalancesModule,
    HCMMockModule,
  ],
  controllers: [HCMController],
  providers: [HCMClientService, HCMOrchestratorService],
  exports: [HCMClientService, HCMOrchestratorService],
})
export class HCMModule {}
