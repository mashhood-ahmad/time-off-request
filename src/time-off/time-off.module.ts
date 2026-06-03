import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';
import { TimeOffRequest } from '../common/entities/time-off-request.entity';
import { Employee } from '../common/entities/employee.entity';
import { Location } from '../common/entities/location.entity';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest, Employee, Location]),
    BalancesModule,
  ],
  controllers: [TimeOffController],
  providers: [TimeOffService],
  exports: [TimeOffService],
})
export class TimeOffModule {}
