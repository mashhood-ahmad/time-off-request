import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';
import { Balance } from '../common/entities/balance.entity';
import { Employee } from '../common/entities/employee.entity';
import { Location } from '../common/entities/location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Balance, Employee, Location])],
  controllers: [BalancesController],
  providers: [BalancesService],
  exports: [BalancesService],
})
export class BalancesModule {}
