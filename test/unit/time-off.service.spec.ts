import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TimeOffService } from '../../src/time-off/time-off.service';
import { BalancesService } from '../../src/balances/balances.service';
import {
  TimeOffRequest,
  TimeOffStatus,
} from '../../src/common/entities/time-off-request.entity';
import { Balance } from '../../src/common/entities/balance.entity';
import { Employee } from '../../src/common/entities/employee.entity';
import { Location } from '../../src/common/entities/location.entity';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

function makeMockRequest(
  overrides: Partial<TimeOffRequest> = {},
): TimeOffRequest {
  return {
    id: 'req-1',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    daysRequested: 3,
    status: TimeOffStatus.PENDING,
    reason: null,
    rejectionReason: null,
    syncedToHCM: false,
    syncedAt: null,
    hcmError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as TimeOffRequest;
}

describe('TimeOffService', () => {
  let service: TimeOffService;
  let requestRepository: jest.Mocked<Repository<TimeOffRequest>>;
  let employeeRepository: jest.Mocked<Repository<Employee>>;
  let locationRepository: jest.Mocked<Repository<Location>>;
  let balancesService: jest.Mocked<BalancesService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockEmployee = {
    id: 'emp-1',
    externalId: 'EXT001',
    name: 'John Doe',
  } as Employee;
  const mockLocation = {
    id: 'loc-1',
    externalId: 'LOC001',
    name: 'New York',
  } as Location;

  const createDto = {
    employeeId: 'emp-1',
    locationId: 'loc-1',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    daysRequested: 3,
    reason: 'Vacation',
  };

  beforeEach(async () => {
    const requestRepoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const dataSourceMock = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: requestRepoMock,
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Location),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: BalancesService,
          useValue: {
            reserveDays: jest.fn(),
            confirmDeduction: jest.fn(),
            releasePendingDays: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<TimeOffService>(TimeOffService);
    requestRepository = module.get(getRepositoryToken(TimeOffRequest));
    employeeRepository = module.get(getRepositoryToken(Employee));
    locationRepository = module.get(getRepositoryToken(Location));
    balancesService = module.get(BalancesService);
    dataSource = module.get(DataSource);
  });

  describe('create', () => {
    it('should create a time-off request successfully', async () => {
      employeeRepository.findOne.mockResolvedValue(mockEmployee);
      locationRepository.findOne.mockResolvedValue(mockLocation);

      const queryBuilderMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      requestRepository.createQueryBuilder.mockReturnValue(
        queryBuilderMock as any,
      );
      balancesService.reserveDays.mockResolvedValue({} as Balance);
      requestRepository.create.mockReturnValue(makeMockRequest());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {} as any;
        await cb(manager);
        return makeMockRequest();
      });

      requestRepository.save.mockResolvedValue(makeMockRequest());

      const result = await service.create(createDto);
      expect(result).toBeDefined();
      expect(balancesService.reserveDays).toHaveBeenCalledWith(
        'emp-1',
        'loc-1',
        3,
      );
    });

    it('should throw NotFoundException when employee not found', async () => {
      employeeRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when location not found', async () => {
      employeeRepository.findOne.mockResolvedValue(mockEmployee);
      locationRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when end date precedes start date', async () => {
      employeeRepository.findOne.mockResolvedValue(mockEmployee);
      locationRepository.findOne.mockResolvedValue(mockLocation);

      await expect(
        service.create({
          ...createDto,
          startDate: '2026-07-10',
          endDate: '2026-07-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when overlapping request exists', async () => {
      employeeRepository.findOne.mockResolvedValue(mockEmployee);
      locationRepository.findOne.mockResolvedValue(mockLocation);

      const queryBuilderMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      };
      requestRepository.createQueryBuilder.mockReturnValue(
        queryBuilderMock as any,
      );

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findById', () => {
    it('should return request when found', async () => {
      requestRepository.findOne.mockResolvedValue(makeMockRequest());

      const result = await service.findById('req-1');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when not found', async () => {
      requestRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('req-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all requests with filters', async () => {
      requestRepository.find.mockResolvedValue([makeMockRequest()]);

      const result = await service.findAll({
        employeeId: 'emp-1',
        status: TimeOffStatus.PENDING,
      });
      expect(result).toHaveLength(1);
      expect(requestRepository.find).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should approve a pending request', async () => {
      requestRepository.findOne.mockResolvedValue(
        makeMockRequest({ status: TimeOffStatus.PENDING }),
      );
      balancesService.confirmDeduction.mockResolvedValue({} as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {} as any;
        await cb(manager);
      });

      requestRepository.save.mockResolvedValue(
        makeMockRequest({ status: TimeOffStatus.APPROVED }),
      );

      const result = await service.updateStatus('req-1', {
        status: TimeOffStatus.APPROVED,
      });
      expect(result.status).toBe(TimeOffStatus.APPROVED);
      expect(balancesService.confirmDeduction).toHaveBeenCalledWith(
        'emp-1',
        'loc-1',
        3,
      );
    });

    it('should reject a pending request and release pending days', async () => {
      requestRepository.findOne.mockResolvedValue(
        makeMockRequest({ status: TimeOffStatus.PENDING }),
      );
      balancesService.releasePendingDays.mockResolvedValue({} as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {} as any;
        await cb(manager);
      });

      requestRepository.save.mockResolvedValue(
        makeMockRequest({
          status: TimeOffStatus.REJECTED,
          rejectionReason: 'Not enough coverage',
        }),
      );

      const result = await service.updateStatus('req-1', {
        status: TimeOffStatus.REJECTED,
        rejectionReason: 'Not enough coverage',
      });
      expect(result.status).toBe(TimeOffStatus.REJECTED);
      expect(balancesService.releasePendingDays).toHaveBeenCalledWith(
        'emp-1',
        'loc-1',
        3,
      );
    });

    it('should throw BadRequestException when request is not pending', async () => {
      requestRepository.findOne.mockResolvedValue(
        makeMockRequest({ status: TimeOffStatus.APPROVED }),
      );

      await expect(
        service.updateStatus('req-1', { status: TimeOffStatus.CANCELLED }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
