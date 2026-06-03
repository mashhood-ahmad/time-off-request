import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Employee } from './common/entities/employee.entity';
import { Location } from './common/entities/location.entity';
import { Balance } from './common/entities/balance.entity';
import { TimeOffRequest } from './common/entities/time-off-request.entity';
import { SyncLog } from './common/entities/sync-log.entity';
import { BalancesModule } from './balances/balances.module';
import { TimeOffModule } from './time-off/time-off.module';
import { HCMModule } from './hcm/hcm.module';
import { HCMMockModule } from './hcm/hcm-mock.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      entities: [Employee, Location, Balance, TimeOffRequest, SyncLog],
      synchronize: true,
      autoSave: false,
      logging: false,
    }),
    BalancesModule,
    TimeOffModule,
    HCMModule,
    HCMMockModule,
    SyncModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
