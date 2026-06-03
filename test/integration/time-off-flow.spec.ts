import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { Employee } from '../../src/common/entities/employee.entity';
import { Location } from '../../src/common/entities/location.entity';
import {
  Balance,
  BalanceChangeReason,
} from '../../src/common/entities/balance.entity';
import { TimeOffRequest } from '../../src/common/entities/time-off-request.entity';
import { SyncLog } from '../../src/common/entities/sync-log.entity';
import { BalancesModule } from '../../src/balances/balances.module';
import { TimeOffModule } from '../../src/time-off/time-off.module';
import { HCMModule } from '../../src/hcm/hcm.module';
import { HCMMockModule } from '../../src/hcm/hcm-mock.module';
import { SyncModule } from '../../src/sync/sync.module';
import { HCMMockController } from '../../src/hcm/hcm-mock.controller';

describe('Time-Off Integration (e2e)', () => {
  let app: INestApplication;
  let employeeRepo: Repository<Employee>;
  let locationRepo: Repository<Location>;
  let balanceRepo: Repository<Balance>;
  let hcmMockController: HCMMockController;

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
    hcmMockController = app.get(HCMMockController);

    await employeeRepo.save([
      {
        id: 'emp-001',
        externalId: 'EXT001',
        name: 'Alice',
        email: 'alice@example.com',
      },
      {
        id: 'emp-002',
        externalId: 'EXT002',
        name: 'Bob',
        email: 'bob@example.com',
      },
    ]);

    await locationRepo.save([
      { id: 'loc-001', externalId: 'LOC001', name: 'New York' },
      { id: 'loc-002', externalId: 'LOC002', name: 'London' },
    ]);

    await balanceRepo.save([
      {
        id: 'bal-001',
        employeeId: 'emp-001',
        locationId: 'loc-001',
        totalDays: 20,
        usedDays: 0,
        pendingDays: 0,
        lastChangeReason: BalanceChangeReason.INITIAL,
      },
      {
        id: 'bal-002',
        employeeId: 'emp-002',
        locationId: 'loc-001',
        totalDays: 15,
        usedDays: 3,
        pendingDays: 1,
        lastChangeReason: BalanceChangeReason.INITIAL,
      },
    ]);

    hcmMockController.setBalances([
      {
        employeeId: 'emp-001',
        locationId: 'loc-001',
        totalDays: 20,
        usedDays: 0,
      },
      {
        employeeId: 'emp-002',
        locationId: 'loc-001',
        totalDays: 15,
        usedDays: 3,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    it('should return all balances', () => {
      return request(app.getHttpServer())
        .get('/balances')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
        });
    });

    it('should filter balances by employee', () => {
      return request(app.getHttpServer())
        .get('/balances?employeeId=emp-001')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(1);
          expect(res.body[0].employeeId).toBe('emp-001');
        });
    });
  });

  describe('GET /balances/:employeeId/:locationId', () => {
    it('should return balance for specific employee and location', () => {
      return request(app.getHttpServer())
        .get('/balances/emp-001/loc-001')
        .expect(200)
        .expect((res) => {
          expect(res.body.employeeId).toBe('emp-001');
          expect(res.body.locationId).toBe('loc-001');
          expect(res.body.totalDays).toBe(20);
          expect(res.body.availableDays).toBe(20);
        });
    });

    it('should return 404 for non-existent balance', () => {
      return request(app.getHttpServer())
        .get('/balances/non-existent/loc-001')
        .expect(404);
    });
  });

  describe('POST /time-off', () => {
    it('should create a time-off request and reserve balance', () => {
      return request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-001',
          locationId: 'loc-001',
          startDate: '2026-08-01',
          endDate: '2026-08-03',
          daysRequested: 3,
          reason: 'Family vacation',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('pending');
          expect(res.body.employeeId).toBe('emp-001');
          expect(res.body.daysRequested).toBe(3);
          expect(res.body.id).toBeDefined();
        });
    });

    it('should return 404 for non-existent employee', () => {
      return request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'nonexistent',
          locationId: 'loc-001',
          startDate: '2026-08-01',
          endDate: '2026-08-03',
          daysRequested: 2,
        })
        .expect(404);
    });

    it('should return 400 when end date before start date', () => {
      return request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-001',
          locationId: 'loc-001',
          startDate: '2026-08-10',
          endDate: '2026-08-01',
          daysRequested: 2,
        })
        .expect(400);
    });

    it('should return 409 for overlapping time-off request', async () => {
      await request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-001',
          locationId: 'loc-001',
          startDate: '2026-09-01',
          endDate: '2026-09-05',
          daysRequested: 5,
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-001',
          locationId: 'loc-001',
          startDate: '2026-09-03',
          endDate: '2026-09-07',
          daysRequested: 4,
        })
        .expect(409);
    });

    it('should return 409 when insufficient balance', async () => {
      const bobBalance = await balanceRepo.findOne({
        where: { employeeId: 'emp-002', locationId: 'loc-001' },
      });
      const available =
        bobBalance!.totalDays - bobBalance!.usedDays - bobBalance!.pendingDays;

      return request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-002',
          locationId: 'loc-001',
          startDate: '2026-10-01',
          endDate: '2026-10-20',
          daysRequested: available + 1,
        })
        .expect(409);
    });
  });

  describe('PATCH /time-off/:id/status', () => {
    it('should approve a pending request', async () => {
      const res = await request(app.getHttpServer()).post('/time-off').send({
        employeeId: 'emp-001',
        locationId: 'loc-001',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        daysRequested: 2,
        reason: 'Test approval flow',
      });

      return request(app.getHttpServer())
        .patch(`/time-off/${res.body.id}/status`)
        .send({ status: 'approved' })
        .expect(200)
        .expect((res2) => {
          expect(res2.body.status).toBe('approved');
        });
    });

    it('should reject a pending request', async () => {
      const res = await request(app.getHttpServer()).post('/time-off').send({
        employeeId: 'emp-001',
        locationId: 'loc-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        daysRequested: 2,
      });

      return request(app.getHttpServer())
        .patch(`/time-off/${res.body.id}/status`)
        .send({ status: 'rejected', rejectionReason: 'Business need' })
        .expect(200)
        .expect((res2) => {
          expect(res2.body.status).toBe('rejected');
          expect(res2.body.rejectionReason).toBe('Business need');
        });
    });

    it('should return 400 for already processed request', async () => {
      const res = await request(app.getHttpServer()).post('/time-off').send({
        employeeId: 'emp-001',
        locationId: 'loc-001',
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        daysRequested: 2,
      });

      await request(app.getHttpServer())
        .patch(`/time-off/${res.body.id}/status`)
        .send({ status: 'approved' })
        .expect(200);

      return request(app.getHttpServer())
        .patch(`/time-off/${res.body.id}/status`)
        .send({ status: 'rejected' })
        .expect(400);
    });

    it('should cancel a pending request', async () => {
      const res = await request(app.getHttpServer()).post('/time-off').send({
        employeeId: 'emp-001',
        locationId: 'loc-001',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        daysRequested: 2,
      });

      return request(app.getHttpServer())
        .patch(`/time-off/${res.body.id}/status`)
        .send({ status: 'cancelled' })
        .expect(200)
        .expect((res2) => {
          expect(res2.body.status).toBe('cancelled');
        });
    });
  });

  describe('GET /time-off/:id', () => {
    it('should return a specific time-off request', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-001',
          locationId: 'loc-001',
          startDate: '2026-12-15',
          endDate: '2026-12-19',
          daysRequested: 5,
        });

      return request(app.getHttpServer())
        .get(`/time-off/${createRes.body.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createRes.body.id);
          expect(res.body.daysRequested).toBe(5);
        });
    });

    it('should return 404 for non-existent request', () => {
      return request(app.getHttpServer())
        .get('/time-off/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('HCM Webhook', () => {
    it('should process HCM webhook for balance change', () => {
      return request(app.getHttpServer())
        .post('/hcm/webhook')
        .send({
          eventType: 'anniversary',
          employeeId: 'emp-001',
          locationId: 'loc-001',
          totalDays: 25,
          usedDays: 0,
          timestamp: new Date().toISOString(),
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.received).toBe(true);
        });
    });
  });

  describe('Balance integrity after approval flow', () => {
    it('should correctly update balance after creating and approving a request', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-001',
          locationId: 'loc-001',
          startDate: '2027-01-01',
          endDate: '2027-01-05',
          daysRequested: 5,
          reason: 'Integrity test',
        })
        .expect(201);

      expect(createRes.body.status).toBe('pending');

      const balanceBefore = await request(app.getHttpServer())
        .get('/balances/emp-001/loc-001')
        .expect(200);

      expect(balanceBefore.body.pendingDays).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .patch(`/time-off/${createRes.body.id}/status`)
        .send({ status: 'approved' })
        .expect(200);

      const balanceAfter = await request(app.getHttpServer())
        .get('/balances/emp-001/loc-001')
        .expect(200);

      expect(balanceAfter.body.usedDays).toBe(balanceBefore.body.usedDays + 5);
      expect(balanceAfter.body.pendingDays).toBe(
        balanceBefore.body.pendingDays - 5,
      );
    });

    it('should restore pending days when request is rejected', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/time-off')
        .send({
          employeeId: 'emp-001',
          locationId: 'loc-001',
          startDate: '2027-02-01',
          endDate: '2027-02-03',
          daysRequested: 2,
        })
        .expect(201);

      const balanceBefore = await request(app.getHttpServer())
        .get('/balances/emp-001/loc-001')
        .expect(200);
      const pendingBefore = balanceBefore.body.pendingDays;

      await request(app.getHttpServer())
        .patch(`/time-off/${createRes.body.id}/status`)
        .send({ status: 'rejected', rejectionReason: 'No coverage' })
        .expect(200);

      const balanceAfter = await request(app.getHttpServer())
        .get('/balances/emp-001/loc-001')
        .expect(200);

      expect(balanceAfter.body.pendingDays).toBe(pendingBefore - 2);
      expect(balanceAfter.body.availableDays).toBe(
        balanceBefore.body.availableDays + 2,
      );
    });
  });

  describe('HCM Mock endpoints', () => {
    it('should get balance from HCM mock', () => {
      return request(app.getHttpServer())
        .get('/hcm-mock/employees/emp-001/balance?locationId=loc-001')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalDays).toBe(20);
          expect(res.body.usedDays).toBe(0);
        });
    });

    it('should return zero balance for unknown employee from HCM mock', () => {
      return request(app.getHttpServer())
        .get('/hcm-mock/employees/unknown/balance?locationId=loc-001')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalDays).toBe(0);
        });
    });

    it('should trigger balance change event on HCM mock', () => {
      return request(app.getHttpServer())
        .post('/hcm-mock/events/balance-change')
        .send({
          eventType: 'balance_change',
          employeeId: 'emp-001',
          locationId: 'loc-001',
          totalDays: 30,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.received).toBe(true);
        });
    });
  });
});
