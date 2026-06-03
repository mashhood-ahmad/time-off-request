import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BalancesService } from './balances.service';
import { BalanceResponseDto } from '../common/dto/balance-response.dto';

@ApiTags('Balances')
@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all balances, optionally filtered by employee',
  })
  @ApiQuery({ name: 'employeeId', required: false })
  async listBalances(@Query('employeeId') employeeId?: string) {
    const balances = await this.balancesService.listBalances(employeeId);
    return balances.map(
      (b) =>
        new BalanceResponseDto({
          employeeId: b.employeeId,
          locationId: b.locationId,
          totalDays: b.totalDays,
          usedDays: b.usedDays,
          pendingDays: b.pendingDays,
          availableDays: b.availableDays,
          lastChangeReason: b.lastChangeReason,
          lastSyncedAt: b.lastSyncedAt,
        }),
    );
  }

  @Get(':employeeId/:locationId')
  @ApiOperation({
    summary: 'Get balance for an employee at a specific location',
  })
  @ApiParam({ name: 'employeeId' })
  @ApiParam({ name: 'locationId' })
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    const balance = await this.balancesService.getBalance(
      employeeId,
      locationId,
    );
    return new BalanceResponseDto({
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      pendingDays: balance.pendingDays,
      availableDays: balance.availableDays,
      lastChangeReason: balance.lastChangeReason,
      lastSyncedAt: balance.lastSyncedAt,
    });
  }
}
