import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HCMOrchestratorService } from '../../src/hcm/hcm-orchestrator.service';
import { HCMClientService } from '../../src/hcm/hcm-client.service';
import { BalancesService } from '../../src/balances/balances.service';
import { TimeOffRequest } from '../../src/common/entities/time-off-request.entity';
import { SyncLog } from '../../src/common/entities/sync-log.entity';
import { Balance } from '../../src/common/entities/balance.entity';

describe('HCMOrchestratorService', () => {
  let service: HCMOrchestratorService;
  let hcmClient: jest.Mocked<HCMClientService>;
  let balancesService: jest.Mocked<BalancesService>;
  let requestRepository: jest.Mocked<Repository<TimeOffRequest>>;
  let balanceRepository: jest.Mocked<Repository<Balance>>;
  let syncLogRepository: jest.Mocked<Repository<SyncLog>>;

  const mockRequest = {
    id: 'req-1',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    daysRequested: 3,
    syncedToHCM: false,
    syncedAt: null,
    hcmError: null,
  } as TimeOffRequest;

  beforeEach(async () => {
    const requestRepoMock = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const balanceRepoMock = {
      find: jest.fn(),
    };

    const syncLogRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HCMOrchestratorService,
        {
          provide: HCMClientService,
          useValue: {
            deductBalance: jest.fn(),
            getBalance: jest.fn(),
            batchSyncBalances: jest.fn(),
          },
        },
        {
          provide: BalancesService,
          useValue: {
            updateBalanceFromHCM: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: requestRepoMock,
        },
        {
          provide: getRepositoryToken(Balance),
          useValue: balanceRepoMock,
        },
        {
          provide: getRepositoryToken(SyncLog),
          useValue: syncLogRepoMock,
        },
      ],
    }).compile();

    service = module.get<HCMOrchestratorService>(HCMOrchestratorService);
    hcmClient = module.get(HCMClientService);
    balancesService = module.get(BalancesService);
    requestRepository = module.get(getRepositoryToken(TimeOffRequest));
    balanceRepository = module.get(getRepositoryToken(Balance));
    syncLogRepository = module.get(getRepositoryToken(SyncLog));
  });

  describe('syncTimeOffToHCM', () => {
    it('should sync successfully and log success', async () => {
      requestRepository.findOne.mockResolvedValue(mockRequest);
      hcmClient.deductBalance.mockResolvedValue({
        success: true,
        transactionId: 'txn-1',
      });
      syncLogRepository.create.mockReturnValue({} as SyncLog);
      syncLogRepository.save.mockResolvedValue({} as SyncLog);

      await service.syncTimeOffToHCM('req-1');

      expect(hcmClient.deductBalance).toHaveBeenCalledWith({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        days: 3,
        requestId: 'req-1',
      });
      expect(requestRepository.save).toHaveBeenCalled();
      expect(syncLogRepository.create).toHaveBeenCalled();
    });

    it('should handle HCM deduction failure', async () => {
      requestRepository.findOne.mockResolvedValue(mockRequest);
      hcmClient.deductBalance.mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
      });
      syncLogRepository.create.mockReturnValue({} as SyncLog);
      syncLogRepository.save.mockResolvedValue({} as SyncLog);

      await service.syncTimeOffToHCM('req-1');

      expect(requestRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hcmError: 'Insufficient balance',
          syncedToHCM: false,
        }),
      );
    });

    it('should skip sync for non-existent request', async () => {
      requestRepository.findOne.mockResolvedValue(null);

      await service.syncTimeOffToHCM('nonexistent');
      expect(hcmClient.deductBalance).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should process balance_change webhook', async () => {
      balancesService.updateBalanceFromHCM.mockResolvedValue({} as Balance);
      syncLogRepository.create.mockReturnValue({} as SyncLog);
      syncLogRepository.save.mockResolvedValue({} as SyncLog);

      await service.handleWebhook({
        eventType: 'balance_change',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 25,
        timestamp: new Date().toISOString(),
      });

      expect(balancesService.updateBalanceFromHCM).toHaveBeenCalledWith(
        'emp-1',
        'loc-1',
        25,
        undefined,
      );
    });

    it('should process anniversary webhook', async () => {
      balancesService.updateBalanceFromHCM.mockResolvedValue({} as Balance);
      syncLogRepository.create.mockReturnValue({} as SyncLog);
      syncLogRepository.save.mockResolvedValue({} as SyncLog);

      await service.handleWebhook({
        eventType: 'anniversary',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 30,
        usedDays: 0,
        timestamp: new Date().toISOString(),
      });

      expect(balancesService.updateBalanceFromHCM).toHaveBeenCalledWith(
        'emp-1',
        'loc-1',
        30,
        0,
      );
    });

    it('should process yearly_refresh webhook', async () => {
      balancesService.updateBalanceFromHCM.mockResolvedValue({} as Balance);
      syncLogRepository.create.mockReturnValue({} as SyncLog);
      syncLogRepository.save.mockResolvedValue({} as SyncLog);

      await service.handleWebhook({
        eventType: 'yearly_refresh',
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 20,
        usedDays: 5,
        timestamp: new Date().toISOString(),
      });

      expect(balancesService.updateBalanceFromHCM).toHaveBeenCalledWith(
        'emp-1',
        'loc-1',
        20,
        5,
      );
    });
  });

  describe('pushBalancesToHCM', () => {
    it('should push all balances to HCM', async () => {
      const mockBalances = [
        {
          employeeId: 'emp-1',
          locationId: 'loc-1',
          totalDays: 20,
          usedDays: 5,
          pendingDays: 2,
        },
      ] as Balance[];

      balanceRepository.find.mockResolvedValue(mockBalances);
      hcmClient.batchSyncBalances.mockResolvedValue({
        success: true,
        processed: 1,
        errors: [],
      });
      syncLogRepository.create.mockReturnValue({} as SyncLog);
      syncLogRepository.save.mockResolvedValue({} as SyncLog);

      await service.pushBalancesToHCM();

      expect(hcmClient.batchSyncBalances).toHaveBeenCalledWith([
        {
          employeeId: 'emp-1',
          locationId: 'loc-1',
          totalDays: 20,
          usedDays: 7,
        },
      ]);
    });
  });

  describe('pullBalancesFromHCM', () => {
    it('should pull balances from HCM for each local balance', async () => {
      balanceRepository.find.mockResolvedValue([
        { employeeId: 'emp-1', locationId: 'loc-1' },
      ] as Balance[]);
      hcmClient.getBalance.mockResolvedValue({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 25,
        usedDays: 3,
      });
      balancesService.updateBalanceFromHCM.mockResolvedValue({} as Balance);

      await service.pullBalancesFromHCM();

      expect(hcmClient.getBalance).toHaveBeenCalledWith('emp-1', 'loc-1');
      expect(balancesService.updateBalanceFromHCM).toHaveBeenCalledWith(
        'emp-1',
        'loc-1',
        25,
        3,
      );
    });

    it('should gracefully handle HCM fetch failures', async () => {
      balanceRepository.find.mockResolvedValue([
        { employeeId: 'emp-1', locationId: 'loc-1' },
      ] as Balance[]);
      hcmClient.getBalance.mockRejectedValue(new Error('HCM unavailable'));

      await expect(service.pullBalancesFromHCM()).resolves.not.toThrow();
    });
  });
});
