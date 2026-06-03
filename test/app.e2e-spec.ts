import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { Employee } from '../src/common/entities/employee.entity';
import { Location } from '../src/common/entities/location.entity';
import {
  Balance,
  BalanceChangeReason,
} from '../src/common/entities/balance.entity';
import { TimeOffRequest } from '../src/common/entities/time-off-request.entity';
import { SyncLog } from '../src/common/entities/sync-log.entity';
import { BalancesModule } from '../src/balances/balances.module';
import { TimeOffModule } from '../src/time-off/time-off.module';
import { HCMModule } from '../src/hcm/hcm.module';
import { HCMMockModule } from '../src/hcm/hcm-mock.module';
import { SyncModule } from '../src/sync/sync.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HCMMockController } from '../src/hcm/hcm-mock.controller';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';

describe('Time-Off Microservice (e2e)', () => {
  let app: INestApplication;
  let employeeRepo: Repository<Employee>;
  let locationRepo: Repository<Location>;
  let balanceRepo: Repository<Balance>;
  let hcmMock: HCMMockController;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          entities: [Employee, Location, Balance, TimeOffRequest, SyncLog],
          synchronize: true,
          logging: false,
        }),
        BalancesModule,
        TimeOffModule,
        HCMModule,
        HCMMockModule,
        SyncModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    employeeRepo = moduleFixture.get<Repository<Employee>>(
      getRepositoryToken(Employee),
    );
    locationRepo = moduleFixture.get<Repository<Location>>(
      getRepositoryToken(Location),
    );
    balanceRepo = moduleFixture.get<Repository<Balance>>(
      getRepositoryToken(Balance),
    );
    hcmMock = app.get(HCMMockController);

    await employeeRepo.save([
      {
        id: 'emp-e2e-1',
        externalId: 'E2E001',
        name: 'Test User',
        email: 'test@example.com',
      },
    ]);
    await locationRepo.save([
      { id: 'loc-e2e-1', externalId: 'E2EL001', name: 'Test Location' },
    ]);
    await balanceRepo.save([
      {
        id: 'bal-e2e-1',
        employeeId: 'emp-e2e-1',
        locationId: 'loc-e2e-1',
        totalDays: 15,
        usedDays: 2,
        pendingDays: 0,
        lastChangeReason: BalanceChangeReason.INITIAL,
      },
    ]);
    hcmMock.setBalances([
      {
        employeeId: 'emp-e2e-1',
        locationId: 'loc-e2e-1',
        totalDays: 15,
        usedDays: 2,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health & Balance', () => {
    it('GET /balances/emp-e2e-1/loc-e2e-1 returns correct balance', () => {
      return request(app.getHttpServer())
        .get('/balances/emp-e2e-1/loc-e2e-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalDays).toBe(15);
          expect(res.body.usedDays).toBe(2);
          expect(res.body.availableDays).toBe(13);
        });
    });
  });

  describe('Complete time-off lifecycle', () => {
    let requestId: string;

    it('POST /time-off creates a pending request', async () => {
      const res = await request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-e2e-1',
          locationId: 'loc-e2e-1',
          startDate: '2026-07-15',
          endDate: '2026-07-17',
          daysRequested: 3,
          reason: 'E2E test vacation',
        })
        .expect(201);
      expect(res.body.status).toBe('pending');
      expect(res.body.daysRequested).toBe(3);
      requestId = res.body.id;
    });

    it('Balance reflects pending reservation', async () => {
      const res = await request(app.getHttpServer())
        .get('/balances/emp-e2e-1/loc-e2e-1')
        .expect(200);
      expect(res.body.pendingDays).toBe(3);
      expect(res.body.availableDays).toBe(10);
    });

    it('PATCH /time-off/:id/status approves request', async () => {
      await request(app.getHttpServer())
        .patch(`/time-off/${requestId}/status`)
        .send({ status: 'approved' })
        .expect(200);
    });

    it('Balance confirms deduction after approval', async () => {
      const res = await request(app.getHttpServer())
        .get('/balances/emp-e2e-1/loc-e2e-1')
        .expect(200);
      expect(res.body.usedDays).toBe(5);
      expect(res.body.pendingDays).toBe(0);
      expect(res.body.availableDays).toBe(10);
    });

    it('HCM webhook updates balance from external change', async () => {
      await request(app.getHttpServer())
        .post('/hcm/webhook')
        .send({
          eventType: 'anniversary',
          employeeId: 'emp-e2e-1',
          locationId: 'loc-e2e-1',
          totalDays: 20,
          usedDays: 5,
          timestamp: new Date().toISOString(),
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/balances/emp-e2e-1/loc-e2e-1')
        .expect(200);
      expect(res.body.totalDays).toBe(20);
      expect(res.body.availableDays).toBe(15);
    });

    it('Validation: rejects overlapping request', async () => {
      await request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-e2e-1',
          locationId: 'loc-e2e-1',
          startDate: '2026-07-16',
          endDate: '2026-07-18',
          daysRequested: 2,
        })
        .expect(409);
    });

    it('Validation: rejects negative days', async () => {
      await request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-e2e-1',
          locationId: 'loc-e2e-1',
          startDate: '2026-08-01',
          endDate: '2026-08-02',
          daysRequested: -1,
        })
        .expect(400);
    });
  });

  describe('HCM Mock endpoints', () => {
    it('POST /hcm-mock/events/balance-change simulates external change', () => {
      return request(app.getHttpServer())
        .post('/hcm-mock/events/balance-change')
        .send({
          eventType: 'balance_change',
          employeeId: 'emp-e2e-1',
          locationId: 'loc-e2e-1',
          totalDays: 25,
        })
        .expect(200);
    });
  });
});
