# Time-Off Microservice

A NestJS-based time-off request management service with HCM balance synchronization, built for ExampleHR.

## Prerequisites

- **Node.js** v18+ (tested on v20.18.0)
- **npm** v9+

## Setup

```bash
npm install
```

## Run

```bash
# development (port 3000)
npm run start

# watch mode (auto-restart on changes)
npm run start:dev

# production
npm run build && npm run start:prod
```

## Test

```bash
# unit + integration tests (56 tests)
npm test

# e2e tests (9 tests)
npm run test:e2e

# all tests with coverage
npm run test:cov
```

## API Reference

### Balances

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/balances` | List all balances. Optional `?employeeId=` filter. |
| `GET` | `/balances/:employeeId/:locationId` | Get specific balance. |

### Time-Off Requests

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/time-off` | Create a new time-off request. |
| `GET` | `/time-off` | List requests. Filters: `employeeId`, `status`, `fromDate`, `toDate`. |
| `GET` | `/time-off/:id` | Get request by ID. |
| `PATCH` | `/time-off/:id/status` | Approve, reject, or cancel. Body: `{ "status": "approved" \| "rejected" \| "cancelled" }`. |

### HCM Sync

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/hcm/webhook` | Receive balance change events from HCM. |
| `POST` | `/hcm/sync/push` | Push all local balances to HCM. |
| `POST` | `/hcm/sync/pull` | Pull all balances from HCM. |

### Mock HCM (for testing)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/hcm-mock/employees/:id/balance?locationId=` | Get balance from mock HCM. |
| `POST` | `/hcm-mock/employees/:id/balance/deduct` | Deduct balance in mock HCM. |
| `POST` | `/hcm-mock/sync/balances` | Batch sync balances to mock HCM. |
| `POST` | `/hcm-mock/events/balance-change` | Simulate external balance change. |

## Request/Response Examples

### Create time-off request

```
POST /time-off
{
  "employeeId": "emp-001",
  "locationId": "loc-001",
  "startDate": "2026-06-10",
  "endDate": "2026-06-12",
  "daysRequested": 3,
  "reason": "Vacation"
}
```

### Approve request

```
PATCH /time-off/<uuid>/status
{
  "status": "approved"
}
```

### HCM webhook (balance change)

```
POST /hcm/webhook
{
  "eventType": "anniversary",
  "employeeId": "emp-001",
  "locationId": "loc-001",
  "totalDays": 25,
  "usedDays": 0,
  "timestamp": "2026-06-04T12:00:00Z"
}
```

## Project Structure

```
src/
├── app.module.ts              # Root module (TypeORM sqljs, global ValidationPipe)
├── main.ts                    # Bootstrap (port 3000)
├── balances/                  # Balance CRUD, reserve, confirm, release
│   ├── balances.controller.ts
│   └── balances.service.ts
├── time-off/                  # Request lifecycle (create/approve/reject/cancel)
│   ├── time-off.controller.ts
│   └── time-off.service.ts
├── hcm/                       # HCM integration
│   ├── hcm.controller.ts      # Sync push/pull, webhook endpoints
│   ├── hcm-client.service.ts  # HTTP client to external HCM
│   ├── hcm-orchestrator.service.ts  # Sync orchestration logic
│   ├── hcm-mock.controller.ts # In-process mock HCM for testing
│   └── hcm-mock.module.ts
├── sync/                      # Sync audit log
│   ├── sync.controller.ts
│   └── sync.service.ts
└── common/
    ├── entities/              # Employee, Location, Balance, TimeOffRequest, SyncLog
    └── dto/                   # CreateTimeOffRequestDto, UpdateTimeOffStatusDto, etc.

test/
├── unit/                      # unit tests (services in isolation)
│   ├── balances.service.spec.ts
│   ├── time-off.service.spec.ts
│   └── hcm-orchestrator.spec.ts
├── integration/               # integration tests (API + module interaction)
│   └── time-off-flow.spec.ts
└── app.e2e-spec.ts            # e2e tests (full lifecycle)
```

## Design Decisions

For detailed architecture, trade-offs, and test strategy, see [`TRD.md`](TRD.md).

Key points:
- **SQLite via sql.js** (pure JS) avoids native module compilation issues
- **Three-phase balance commitment**: reserve → confirm/release for atomicity
- **In-process mock HCM**: avoids separate server processes in tests
- **Transactional integrity**: all balance mutations wrapped in DB transactions
- **Overlap detection**: prevents double-booking via date range intersection
