import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

interface BalanceRecord {
  employeeId: string;
  locationId: string;
  totalDays: number;
  usedDays: number;
}

interface DeductRequest {
  employeeId: string;
  locationId: string;
  days: number;
  requestId: string;
}

interface BatchSyncBody {
  balances: BalanceRecord[];
}

interface BalanceChangeEvent {
  eventType: 'balance_change' | 'anniversary' | 'yearly_refresh';
  employeeId: string;
  locationId: string;
  totalDays: number;
  usedDays?: number;
}

@ApiTags('HCM Mock')
@Controller('hcm-mock')
export class HCMMockController {
  private readonly logger = new Logger(HCMMockController.name);
  private balances: Map<string, BalanceRecord> = new Map();
  private deductFailEnabled = false;
  private deductFailRate = 0;
  private balanceChangeListeners: Array<(event: BalanceChangeEvent) => void> =
    [];

  setDeductFailConfig(enabled: boolean, rate: number = 0): void {
    this.deductFailEnabled = enabled;
    this.deductFailRate = rate;
  }

  onBalanceChange(callback: (event: BalanceChangeEvent) => void): void {
    this.balanceChangeListeners.push(callback);
  }

  setBalances(balances: BalanceRecord[]): void {
    for (const b of balances) {
      this.balances.set(`${b.employeeId}:${b.locationId}`, b);
    }
  }

  getBalanceRecord(
    employeeId: string,
    locationId: string,
  ): BalanceRecord | undefined {
    return this.balances.get(`${employeeId}:${locationId}`);
  }

  getAllBalances(): BalanceRecord[] {
    return Array.from(this.balances.values());
  }

  @Get('employees/:employeeId/balance')
  @ApiOperation({ summary: 'Get employee balance from HCM' })
  getBalance(
    @Param('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
  ): BalanceRecord {
    const key = `${employeeId}:${locationId}`;
    const balance = this.balances.get(key);
    if (!balance) {
      return { employeeId, locationId, totalDays: 0, usedDays: 0 };
    }
    return balance;
  }

  @Post('employees/:employeeId/balance/deduct')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deduct balance in HCM' })
  deductBalance(
    @Param('employeeId') employeeId: string,
    @Body() body: DeductRequest,
  ): { success: boolean; transactionId?: string; error?: string } {
    if (body.employeeId && body.employeeId !== employeeId) {
      body.employeeId = employeeId;
    }
    const key = `${employeeId}:${body.locationId}`;
    const balance = this.balances.get(key);

    if (this.deductFailEnabled && Math.random() < this.deductFailRate) {
      return {
        success: false,
        error: 'Simulated HCM deduction failure',
      };
    }

    if (!balance) {
      return {
        success: false,
        error: `Balance not found for employee ${body.employeeId} at location ${body.locationId}`,
      };
    }

    const available = balance.totalDays - balance.usedDays;
    if (available < body.days) {
      return {
        success: false,
        error: `Insufficient balance in HCM: available ${available}, requested ${body.days}`,
      };
    }

    balance.usedDays += body.days;

    return {
      success: true,
      transactionId: `hcm-txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  @Post('sync/balances')
  @HttpCode(200)
  @ApiOperation({ summary: 'Batch sync balances to HCM' })
  batchSync(@Body() body: BatchSyncBody): {
    success: boolean;
    processed: number;
    errors: Array<{ employeeId: string; locationId: string; error: string }>;
  } {
    const errors: Array<{
      employeeId: string;
      locationId: string;
      error: string;
    }> = [];
    let processed = 0;

    for (const balance of body.balances) {
      try {
        this.balances.set(`${balance.employeeId}:${balance.locationId}`, {
          employeeId: balance.employeeId,
          locationId: balance.locationId,
          totalDays: balance.totalDays,
          usedDays: balance.usedDays,
        });
        processed++;
      } catch (err: unknown) {
        let msg: string;
        if (err instanceof Error) msg = err.message;
        else {
          try {
            msg = JSON.stringify(err);
          } catch {
            msg = String(err);
          }
        }
        errors.push({
          employeeId: balance.employeeId,
          locationId: balance.locationId,
          error: msg,
        });
      }
    }

    return { success: errors.length === 0, processed, errors };
  }

  @Post('events/balance-change')
  @HttpCode(200)
  @ApiOperation({ summary: 'Simulate external balance change event' })
  triggerBalanceChange(@Body() body: BalanceChangeEvent): {
    received: boolean;
  } {
    const key = `${body.employeeId}:${body.locationId}`;
    const existing = this.balances.get(key) || {
      employeeId: body.employeeId,
      locationId: body.locationId,
      totalDays: 0,
      usedDays: 0,
    };

    if (body.totalDays !== undefined) existing.totalDays = body.totalDays;
    if (body.usedDays !== undefined) existing.usedDays = body.usedDays;

    this.balances.set(key, existing);

    for (const listener of this.balanceChangeListeners) {
      listener(body);
    }

    this.logger.log(`Balance change event processed: ${JSON.stringify(body)}`);
    return { received: true };
  }
}
