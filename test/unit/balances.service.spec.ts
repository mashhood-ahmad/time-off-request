import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BalancesService } from '../../src/balances/balances.service';
import {
  Balance,
  BalanceChangeReason,
} from '../../src/common/entities/balance.entity';
import { Employee } from '../../src/common/entities/employee.entity';
import { Location } from '../../src/common/entities/location.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { describe, beforeEach, it, jest, expect } from '@jest/globals';

function makeMockBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    id: 'balance-1',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    totalDays: 20,
    usedDays: 5,
    pendingDays: 2,
    lastChangeReason: BalanceChangeReason.INITIAL,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    availableDays: 13,
    employee: null,
    location: null,
    ...overrides,
  } as Balance;
}

describe('BalancesService', () => {
  let service: BalancesService;
  let balanceRepository: jest.Mocked<Repository<Balance>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const dataSourceMock: any = {
      transaction: jest.fn(),
    };

    const balanceRepoMock: any = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        {
          provide: getRepositoryToken(Balance),
          useValue: balanceRepoMock,
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Location),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
    balanceRepository = module.get(getRepositoryToken(Balance));
    dataSource = module.get(DataSource);
  });

  describe('getBalance', () => {
    it('should return balance when found', async () => {
      balanceRepository.findOne.mockResolvedValue(makeMockBalance());

      const result = await service.getBalance('emp-1', 'loc-1');
      expect(result).toBeDefined();
      expect(balanceRepository.findOne).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', locationId: 'loc-1' },
      });
    });

    it('should throw NotFoundException when balance not found', async () => {
      balanceRepository.findOne.mockResolvedValue(null);

      await expect(service.getBalance('emp-1', 'loc-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ensureBalance', () => {
    it('should return existing balance when found', async () => {
      balanceRepository.findOne.mockResolvedValue(makeMockBalance());

      const result = await service.ensureBalance('emp-1', 'loc-1');
      expect(result).toBeDefined();
    });

    it('should create new balance when not found', async () => {
      balanceRepository.findOne.mockResolvedValue(null);
      balanceRepository.create.mockReturnValue(makeMockBalance());
      balanceRepository.save.mockResolvedValue(makeMockBalance());

      const result = await service.ensureBalance('emp-1', 'loc-1');
      expect(result).toBeDefined();
      expect(balanceRepository.create).toHaveBeenCalledWith({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 0,
        usedDays: 0,
        pendingDays: 0,
        lastChangeReason: BalanceChangeReason.INITIAL,
      });
    });
  });

  describe('reserveDays', () => {
    it('should reserve days when sufficient balance', async () => {
      const updatedBalance = makeMockBalance({
        pendingDays: 3,
        lastChangeReason: BalanceChangeReason.TIME_OFF_REQUEST,
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(makeMockBalance()),
          save: (jest.fn() as any).mockResolvedValue(updatedBalance),
        };
        return cb(manager);
      });

      const result = await service.reserveDays('emp-1', 'loc-1', 1);
      expect(result.pendingDays).toBe(3);
    });

    it('should throw NotFoundException when balance not found', async () => {
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(null),
          save: jest.fn(),
        };
        return cb(manager);
      });

      await expect(service.reserveDays('emp-1', 'loc-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when insufficient balance', async () => {
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(makeMockBalance()),
          save: jest.fn(),
        };
        return cb(manager);
      });

      await expect(service.reserveDays('emp-1', 'loc-1', 99)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('confirmDeduction', () => {
    it('should move days from pending to used', async () => {
      const updatedBalance = makeMockBalance({
        pendingDays: 1,
        usedDays: 6,
        lastChangeReason: BalanceChangeReason.TIME_OFF_REQUEST,
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(makeMockBalance()),
          save: (jest.fn() as any).mockResolvedValue(updatedBalance),
        };
        return cb(manager);
      });

      const result = await service.confirmDeduction('emp-1', 'loc-1', 1);
      expect(result.usedDays).toBe(6);
      expect(result.pendingDays).toBe(1);
    });
  });

  describe('releasePendingDays', () => {
    it('should release pending days', async () => {
      const updatedBalance = makeMockBalance({
        pendingDays: 0,
        lastChangeReason: BalanceChangeReason.TIME_OFF_CANCELLED,
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(makeMockBalance()),
          save: (jest.fn() as any).mockResolvedValue(updatedBalance),
        };
        return cb(manager);
      });

      const result = await service.releasePendingDays('emp-1', 'loc-1', 2);
      expect(result.pendingDays).toBe(0);
      expect(result.lastChangeReason).toBe(
        BalanceChangeReason.TIME_OFF_CANCELLED,
      );
    });
  });

  describe('restoreDays', () => {
    it('should restore used days', async () => {
      const updatedBalance = makeMockBalance({
        usedDays: 3,
        lastChangeReason: BalanceChangeReason.TIME_OFF_CANCELLED,
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(makeMockBalance()),
          save: (jest.fn() as any).mockResolvedValue(updatedBalance),
        };
        return cb(manager);
      });

      const result = await service.restoreDays('emp-1', 'loc-1', 2);
      expect(result.usedDays).toBe(3);
    });
  });

  describe('updateBalanceFromHCM', () => {
    it('should update balance from HCM data', async () => {
      const updatedBalance = makeMockBalance({
        totalDays: 25,
        usedDays: 3,
        lastChangeReason: BalanceChangeReason.HCM_SYNC,
        lastSyncedAt: new Date(),
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(makeMockBalance()),
          save: (jest.fn() as any).mockResolvedValue(updatedBalance),
          create: jest.fn(),
        };
        return cb(manager);
      });

      const result = await service.updateBalanceFromHCM(
        'emp-1',
        'loc-1',
        25,
        3,
      );
      expect(result.totalDays).toBe(25);
      expect(result.lastChangeReason).toBe(BalanceChangeReason.HCM_SYNC);
    });

    it('should create balance if not exists', async () => {
      const newBalance = makeMockBalance({ totalDays: 15, usedDays: 0 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: (jest.fn() as any).mockResolvedValue(null),
          save: (jest.fn() as any).mockResolvedValue(newBalance),
          create: (jest.fn() as any).mockReturnValue(newBalance),
        };
        return cb(manager);
      });

      const result = await service.updateBalanceFromHCM(
        'emp-new',
        'loc-1',
        15,
        0,
      );
      expect(result.totalDays).toBe(15);
    });
  });

  describe('listBalances', () => {
    it('should return all balances', async () => {
      balanceRepository.find.mockResolvedValue([makeMockBalance()]);

      const result = await service.listBalances();
      expect(result).toHaveLength(1);
    });

    it('should filter by employeeId', async () => {
      balanceRepository.find.mockResolvedValue([makeMockBalance()]);

      await service.listBalances('emp-1');
      expect(balanceRepository.find).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1' },
        relations: ['employee', 'location'],
      });
    });
  });
});
