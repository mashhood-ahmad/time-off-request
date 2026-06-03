# Technical Requirement Document (TRD) — Time-Off Microservice

## 1. Overview

ExampleHR needs a Time-Off Microservice that manages the lifecycle of time-off requests while maintaining balance integrity between ExampleHR and the external Human Capital Management (HCM) system. The HCM system is the single source of truth for employment data.

### 1.1 Goals

- Allow employees to request time off and view accurate balances
- Allow managers to approve/reject requests with validated data
- Keep balances synchronized with HCM despite external changes (anniversary bonuses, yearly refreshes)
- Provide a resilient sync mechanism that handles failures gracefully
- Provide a comprehensive audit trail of all sync operations

## 2. Architecture

### 2.1 Technology Stack

| Component        | Technology      | Rationale                                          |
|------------------|-----------------|----------------------------------------------------|
| Framework        | NestJS 11       | Opinionated, modular, great DI, TypeScript-native  |
| Language         | TypeScript      | Type safety for domain logic                       |
| Database         | SQLite (sql.js) | Embedded, zero-config, in-memory option for tests  |
| ORM              | TypeORM         | Mature, well-integrated with NestJS                |
| Validation       | class-validator | DTO validation with decorators                     |
| API              | REST            | Simple, stateless, universally supported           |
| HTTP Client      | Axios (via @nestjs/axios) | Reliable, promise-based HTTP client     |

### 2.2 Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Time-Off Microservice                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Balance      │  │ Time-Off     │  │ HCM              │  │
│  │ Module       │◄─┤ Module       │◄─┤ Module           │  │
│  │              │  │              │  │  ┌─────────────┐ │  │
│  │ - CRUD       │  │ - Create     │  │  │ Client      │ │  │
│  │ - Reserve    │  │ - Approve    │  │  │ Service     │ │  │
│  │ - Deduct     │  │ - Reject     │  │  ├─────────────┤ │  │
│  │ - Restore    │  │ - Cancel     │  │  │ Orchestrator│ │  │
│  └──────┬───────┘  │ - List       │  │  │ Service     │ │  │
│         │          └──────────────┘  │  ├─────────────┤ │  │
│         │                            │  │ Mock Ctrl   │ │  │
│         │                            │  └─────────────┘ │  │
│         │                            └──────────────────┘  │
│         ▼                                                  │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Sync         │  │ Common       │                        │
│  │ Module       │  │ Module       │                        │
│  │              │  │              │                        │
│  │ - Audit Logs │  │ - Entities   │                        │
│  │ - History    │  │ - DTOs       │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Data Model

#### Employee
| Field      | Type   | Description                        |
|------------|--------|------------------------------------|
| id         | UUID   | Primary key                        |
| externalId | string | HCM employee identifier (unique)   |
| name       | string | Employee name                      |
| email      | string | Employee email                     |

#### Location
| Field      | Type   | Description                        |
|------------|--------|------------------------------------|
| id         | UUID   | Primary key                        |
| externalId | string | HCM location identifier (unique)   |
| name       | string | Location name                      |

#### Balance (Unique: employeeId + locationId)
| Field             | Type   | Description                               |
|-------------------|--------|-------------------------------------------|
| id                | UUID   | Primary key                               |
| employeeId        | UUID   | FK to Employee                            |
| locationId        | UUID   | FK to Location                            |
| totalDays         | float  | Total allocated days                      |
| usedDays          | float  | Days already taken                        |
| pendingDays       | float  | Days in pending requests                  |
| availableDays     | computed | totalDays - usedDays - pendingDays       |
| lastChangeReason  | enum   | What caused the last change               |
| lastSyncedAt      | date   | Last successful HCM sync timestamp        |

#### TimeOffRequest
| Field           | Type   | Description                               |
|-----------------|--------|-------------------------------------------|
| id              | UUID   | Primary key                               |
| employeeId      | UUID   | FK to Employee                            |
| locationId      | UUID   | FK to Location                            |
| startDate       | date   | Time-off start                            |
| endDate         | date   | Time-off end                              |
| daysRequested   | float  | Number of days                            |
| status          | enum   | pending / approved / rejected / cancelled |
| reason          | string | Optional employee reason                  |
| rejectionReason | string | Optional manager rejection reason         |
| syncedToHCM     | bool   | Whether synced to HCM                     |
| syncedAt        | date   | When synced                               |
| hcmError        | string | Error message from HCM, if any            |

#### SyncLog
| Field           | Type   | Description                               |
|-----------------|--------|-------------------------------------------|
| id              | UUID   | Primary key                               |
| entityType      | enum   | time_off_request / balance / employee     |
| entityId        | string | ID of related entity                      |
| action          | enum   | create / update / delete / sync           |
| status          | enum   | success / failed / pending                |
| requestPayload  | text   | Serialized request                        |
| responsePayload | text   | Serialized response                       |
| errorMessage    | text   | Error details, if any                     |

## 3. API Endpoints

### 3.1 Balance Endpoints

| Method | Path                       | Description                              |
|--------|----------------------------|------------------------------------------|
| GET    | /balances                  | List all balances (optional ?employeeId) |
| GET    | /balances/:employeeId/:locationId | Get specific balance              |

### 3.2 Time-Off Request Endpoints

| Method | Path                        | Description                              |
|--------|-----------------------------|------------------------------------------|
| POST   | /time-off                   | Create a new time-off request            |
| GET    | /time-off                   | List requests (filterable)               |
| GET    | /time-off/:id               | Get specific request                     |
| PATCH  | /time-off/:id/status        | Approve / Reject / Cancel request        |

### 3.3 HCM Sync Endpoints

| Method | Path                        | Description                              |
|--------|-----------------------------|------------------------------------------|
| POST   | /hcm/webhook                | Receive balance change events from HCM   |
| POST   | /hcm/sync/push              | Push all balances to HCM                 |
| POST   | /hcm/sync/pull              | Pull all balances from HCM               |

### 3.4 Mock HCM Endpoints (for testing)

| Method | Path                                            | Description                              |
|--------|-------------------------------------------------|------------------------------------------|
| GET    | /hcm-mock/employees/:id/balance                 | Get balance from mock HCM                |
| POST   | /hcm-mock/employees/:id/balance/deduct          | Deduct balance in mock HCM               |
| POST   | /hcm-mock/sync/balances                        | Batch sync to mock HCM                   |
| POST   | /hcm-mock/events/balance-change                | Simulate external balance change         |

## 4. Key Design Decisions

### 4.1 Balance Integrity Strategy

**Three-phase commit pattern for balance updates:**

1. **Reserve (Pending)**: When a request is created, days are moved from `available` to `pending` atomically. This prevents double-booking while the request awaits approval.

2. **Confirm (Approved)**: On approval, `pendingDays` decreases and `usedDays` increases atomically.

3. **Release/Reversal**: On rejection or cancellation, `pendingDays` is released back to `available`.

All balance mutations execute within database transactions to ensure atomicity.

### 4.2 HCM Sync Strategy

| Direction | Trigger              | Method                                      |
|-----------|----------------------|---------------------------------------------|
| Inbound   | HCM webhook          | HCM pushes changes via `/hcm/webhook`       |
| Inbound   | Pull (manual/scheduled) | Service pulls all balances from HCM       |
| Outbound  | On approval          | Service pushes deduction to HCM             |
| Outbound  | Push (manual/scheduled) | Service pushes all balances to HCM       |

### 4.3 Defensive Design

The HCM system may not always return errors for invalid operations. The service implements:

1. **Local balance validation**: Before any HCM sync, the service validates balances locally (sufficient days, valid dimensions)
2. **Fallback on HCM failure**: If HCM is unreachable or returns an error, the request is still tracked locally with `syncedToHCM = false` and the error is logged
3. **Sync audit trail**: Every sync operation is recorded in `SyncLog` for later analysis and reconciliation
4. **Configurable retry**: Failed syncs can be retried via the push/pull endpoints

### 4.4 Overlapping Request Prevention

The service prevents overlapping time-off requests using a query that checks for date range intersection:

```
startDate <= newEndDate AND endDate >= newStartDate
```

Only `pending` and `approved` requests are considered for overlap detection.

## 5. Challenges & Analysis of Alternatives

### 5.1 Optimistic vs Pessimistic Locking

| Approach           | Pros                                      | Cons                                      |
|--------------------|-------------------------------------------|-------------------------------------------|
| Pessimistic Locking | Guarantees no concurrent modifications   | Not supported by SQLite/sql.js; DB lock contention |
| **Transactional (chosen)** | Simple; works with all DBs; atomic | Relies on serial access in single-process |

**Decision**: Database transactions provide sufficient atomicity for SQLite. In production with PostgreSQL, row-level locking would be added.

### 5.2 Webhook vs Polling for HCM Sync

| Approach    | Pros                                      | Cons                                      |
|-------------|-------------------------------------------|-------------------------------------------|
| **Webhook (chosen)** | Real-time updates; low latency        | Requires HCM to support webhooks          |
| Polling     | No HCM changes needed; simpler            | Periodic sync gaps; higher load           |

**Decision**: Support both. Webhooks for real-time changes (anniversary, yearly refresh), and pull/push endpoints for manual/scheduled reconciliation.

### 5.3 In-Memory vs File-Based SQLite

| Approach              | Pros                                      | Cons                                      |
|-----------------------|-------------------------------------------|-------------------------------------------|
| **In-Memory (chosen)** | Fast tests; no cleanup needed            | Data lost on restart                      |
| File-Based            | Persistent data                          | Slower; cleanup needed                    |

**Decision**: Use in-memory for development/testing. Production would use PostgreSQL.

### 5.4 Pending vs Immediate Deduction

| Approach              | Pros                                      | Cons                                      |
|-----------------------|-------------------------------------------|-------------------------------------------|
| **Pending (chosen)**  | Prevents over-booking; accurate balance   | Days unavailable until decision           |
| Immediate Deduction   | Simpler logic                             | Requires reversal on rejection            |

**Decision**: Pending reservation ensures balance accuracy. If the request is rejected, pending days are released back.

## 6. Test Strategy

### 6.1 Test Pyramid

```
            _
           / \
          /   \ 
         ╱     ╲
        ╱  E2E  ╲         full lifecycle scenarios
       ╱──────── ╲
      ╱Integration╲      module interaction + API
     ╱─────────────╲
    ╱   Unit Tests  ╲   service layer isolation, atomic level tests
   ╱─────────────────╲
```

### 6.2 Unit Tests (34 tests)

| Suite                 | Tests | Coverage Areas                                 |
|-----------------------|-------|------------------------------------------------|
| balances.service      | 13    | CRUD, reserve, confirm, release, HCM update    |
| time-off.service      | 10    | Create, approve, reject, cancel, validation    |
| hcm-orchestrator      | 11    | Sync, webhook, push, pull, error handling      |

### 6.3 Integration Tests (22 tests)

| Area                  | Tests | Scenarios                                       |
|-----------------------|-------|-------------------------------------------------|
| Balance API           | 4     | List, filter, get, 404                          |
| Time-Off API          | 8     | Create, validation, overlap, insufficient bal   |
| Status Transitions    | 5     | Approve, reject, cancel, idempotency            |
| Balance Integrity     | 2     | Pending→confirmed, pending→released             |
| HCM Webhook           | 1     | Balance change via webhook                      |
| HCM Mock              | 2     | Mock API, unknown employee                      |

### 6.4 E2E Tests (9 tests)

Complete lifecycle scenarios including balance verification after each state transition.

### 6.5 Mock HCM Server

The `HCMMockController` provides an in-process mock HCM server that:

- Stores balances in memory
- Supports deduction with configurable failure rates
- Supports batch sync operations
- Can simulate external balance change events
- Returns zero balances for unknown employees
