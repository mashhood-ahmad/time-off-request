import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Balance,
  BalanceChangeReason,
} from '../common/entities/balance.entity';

@Injectable()
export class BalancesService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly dataSource: DataSource,
  ) {}

  async getBalance(employeeId: string, locationId: string): Promise<Balance> {
    const balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      throw new NotFoundException(
        `Balance not found for employee ${employeeId} at location ${locationId}`,
      );
    }

    return balance;
  }

  async ensureBalance(
    employeeId: string,
    locationId: string,
  ): Promise<Balance> {
    const existing = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (existing) return existing;

    const balance = this.balanceRepository.create({
      employeeId,
      locationId,
      totalDays: 0,
      usedDays: 0,
      pendingDays: 0,
      lastChangeReason: BalanceChangeReason.INITIAL,
    });

    return this.balanceRepository.save(balance);
  }

  async reserveDays(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { employeeId, locationId },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance not found for employee ${employeeId} at location ${locationId}`,
        );
      }

      const available =
        balance.totalDays - balance.usedDays - balance.pendingDays;
      if (available < days) {
        throw new ConflictException({
          message: 'Insufficient balance',
          available,
          requested: days,
          employeeId,
          locationId,
        });
      }

      balance.pendingDays += days;
      balance.lastChangeReason = BalanceChangeReason.TIME_OFF_REQUEST;

      return manager.save(balance);
    });
  }

  async confirmDeduction(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { employeeId, locationId },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance not found for employee ${employeeId} at location ${locationId}`,
        );
      }

      balance.pendingDays -= days;
      balance.usedDays += days;
      balance.lastChangeReason = BalanceChangeReason.TIME_OFF_REQUEST;

      return manager.save(balance);
    });
  }

  async releasePendingDays(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { employeeId, locationId },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance not found for employee ${employeeId} at location ${locationId}`,
        );
      }

      balance.pendingDays = Math.max(0, balance.pendingDays - days);
      balance.lastChangeReason = BalanceChangeReason.TIME_OFF_CANCELLED;

      return manager.save(balance);
    });
  }

  async restoreDays(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { employeeId, locationId },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance not found for employee ${employeeId} at location ${locationId}`,
        );
      }

      balance.usedDays -= days;
      balance.pendingDays = Math.max(0, balance.pendingDays);
      balance.lastChangeReason = BalanceChangeReason.TIME_OFF_CANCELLED;

      return manager.save(balance);
    });
  }

  async updateBalanceFromHCM(
    employeeId: string,
    locationId: string,
    totalDays: number,
    usedDays?: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      let balance = await manager.findOne(Balance, {
        where: { employeeId, locationId },
      });

      if (!balance) {
        balance = manager.create(Balance, {
          employeeId,
          locationId,
        });
      }

      balance.totalDays = totalDays;
      if (usedDays !== undefined) {
        balance.usedDays = usedDays;
      }
      balance.lastChangeReason = BalanceChangeReason.HCM_SYNC;
      balance.lastSyncedAt = new Date();

      return manager.save(balance);
    });
  }

  async listBalances(employeeId?: string): Promise<Balance[]> {
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;

    return this.balanceRepository.find({
      where,
      relations: ['employee', 'location'],
    });
  }
}
