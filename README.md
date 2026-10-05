# ACM Incursion — Conflict-Aware Events and Expenses Manager

A centralized institutional management system for ACM campus events, scheduling conflicts, expenses, budgets, receipts, audit history, and institutional memory.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Validation | Zod |
| Testing | Vitest |
| Money | `decimal.js` / Prisma `Decimal` |

---

## Architecture

```
src/
  app/
    api/                  # Route handlers (auth → validate → authorize → service → respond)
  server/
    services/             # Business logic (Phase 3+)
    repositories/         # Prisma queries (Phase 3+)
    policies/             # RBAC authorization predicates (Phase 2+)
    validators/           # Zod schemas (Phase 2+)
    lib/
      prisma.ts           # Prisma singleton client
      api-response.ts     # Uniform JSON response helpers
      errors.ts           # Domain error classes
      timezone.ts         # UTC/IST utilities + overlap formula
    types/
      index.ts            # Shared TypeScript types

prisma/
  schema.prisma           # Complete database schema
  seed.ts                 # Deterministic demo seed

tests/
  unit/                   # Pure logic tests (no DB)
  integration/            # DB integration tests
```

---

## Database Entities

| Model | Purpose |
|---|---|
| `User` | System users with role-based access |
| `Club` | Campus clubs (including ACM itself) |
| `Venue` | Event venues with turnaround buffer |
| `Semester` | Financial + historical boundary; lockable |
| `Event` | Event proposals with structured audience |
| `EventReview` | ACM Core verify/reject decisions |
| `ConflictRecord` | Detected scheduling conflicts (NEVER auto-resolved) |
| `ExpenseCategory` | Spending categories (Logistics, Honorarium, etc.) |
| `BudgetAllocation` | Per-semester/category/club budget lines |
| `Expense` | Individual expense records with approval lifecycle |
| `Receipt` | File attachment metadata with SHA-256 deduplication |
| `Notification` | Per-user alerts |
| `AuditLog` | Immutable state-change history |

---

## Setup

### 1. Prerequisites

- Node.js ≥ 22
- PostgreSQL (local or remote)

### 2. Clone and install

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and set your database connection:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/acm_incursion?schema=public"
```

### 4. Run migrations

```bash
npx prisma migrate dev
```

This creates the database and applies the initial migration.

### 5. Seed the database

```bash
npx prisma db seed
```

Or using the npm script:
```bash
npm run db:seed
```

### 6. Run tests

Unit tests (no database required):
```bash
npm test
```

Integration tests require the database to be migrated and seeded first.

---

## Available Scripts

| Script | Command |
|---|---|
| Dev server | `npm run dev` |
| Generate Prisma client | `npm run db:generate` |
| Run migrations | `npm run db:migrate` |
| Seed database | `npm run db:seed` |
| Open Prisma Studio | `npm run db:studio` |
| Reset database | `npm run db:reset` |
| Run tests | `npm test` |
| Watch tests | `npm run test:watch` |
| Coverage report | `npm run test:coverage` |

---

## Critical Design Decisions

### 1. UTC Timestamps (NON-NEGOTIABLE)

All `DateTime` fields in PostgreSQL store UTC. The application timezone is `Asia/Kolkata` (IST, UTC+5:30).

**Rule:** Never store IST as the canonical database timestamp.  
**Seed data** uses `istToUtc()` to convert human-readable IST times to UTC before persisting.

```
4:00 PM IST = 10:30 AM UTC
8:00 PM IST = 14:30 PM UTC
```

### 2. End-Exclusive Overlap (NON-NEGOTIABLE)

Two events overlap if and only if:
```
A.startAt < B.endAt  AND  B.startAt < A.endAt
```

Events at `10:00–11:00` and `11:00–12:00` are **NOT** conflicting. The `intervalsOverlap()` function in `src/server/lib/timezone.ts` encodes this.

The database **does not** enforce any constraint preventing overlapping events. The conflict engine (Phase 4) detects and flags them for ACM Core to decide.

### 3. Decimal Money (NON-NEGOTIABLE)

All monetary fields use PostgreSQL `DECIMAL(12, 2)` via Prisma's `@db.Decimal(12, 2)`:

```prisma
totalBudget     Decimal  @db.Decimal(12, 2)  // Semester
allocatedAmount Decimal  @db.Decimal(12, 2)  // BudgetAllocation
amount          Decimal  @db.Decimal(12, 2)  // Expense
```

JavaScript `number` (IEEE 754 float) is **never** used for financial calculations.

### 4. Non-Destructive Conflict Handling (NON-NEGOTIABLE)

The system **NEVER** automatically cancels, reschedules, or rejects events due to conflicts. The `ConflictRecord` table flags conflicts. Only authorized `ACM_CORE` users can act on them.

### 5. Soft Deletion

`Event`, `Expense`, `Receipt`, `Club` all carry `deletedAt DateTime?`. Soft-deleted records remain in the database for historical/audit purposes. `AuditLog` has **no** soft delete and **no** `updatedAt`.

### 6. ConflictRecord Uniqueness

Conflict pairs are stored in canonical order: `eventAId < eventBId` (lexicographic). The unique constraint is `(eventAId, eventBId, conflictType)`. This means:

- No duplicate `(A, B, VENUE)` rows.
- A pair CAN have both `(A, B, VENUE)` AND `(A, B, AUDIENCE)` — two legitimate conflict types.
- The conflict service **must** sort the pair before upserting.

### 7. Structured Audience Representation

Events store audience as two PostgreSQL arrays:

```prisma
targetYears    Int[]     // [] = ALL years; [1,2] = 1st and 2nd year only
targetBranches String[]  // [] = ALL branches; ["CSE"] = CSE only
```

The conflict engine (Phase 4) expands these into `(year, branch)` cell pairs and checks intersection. An empty array in either dimension means that dimension is universal.

### 8. onDelete Behavior

| Relationship | Behavior | Reason |
|---|---|---|
| `Event → Club` | `Restrict` | Deleting a club must not silently erase its event history |
| `Event → Venue` | `Restrict` | Venues must be archived, not deleted, if events exist |
| `Event → Semester` | `Restrict` | Semesters are financial boundaries; must persist |
| `Expense → Club` | `Restrict` | Financial records are permanent |
| `Expense → Semester` | `Restrict` | Semester is the financial container |
| `Expense → Event` | `SetNull` | If an event is soft-deleted, linked expenses remain valid |
| `User → Club` | `SetNull` | If a club is deactivated, user's club reference becomes null |
| `Receipt → Expense` | `Restrict` | Receipts are proof of payment; must not be orphaned |
| `AuditLog → User` | `SetNull` | If actor user is deleted, logs remain; actorUserId becomes null |
| `Notification → User` | `Cascade` | User notifications can be deleted with the user |

---

## Seed Summary

The seed creates:

- **5 Clubs**: ACM Student Chapter, Coding Club, Robotics Club, GDSC, Entrepreneurship Cell
- **8 Users**: 1 SUPER_ADMIN, 1 ACM_CORE, 1 ACM_EXEC, 4 CLUB_REPs (Coding, Robotics, GDSC, E-Cell), 1 VIEWER
- **7 Venues**: LT-1, LT-2, Seminar Hall, Main Auditorium, CS-LAB-1, CS-LAB-2, Open Air Amphitheater
- **2 Semesters**: Even Semester 2025-26 (locked), Odd Semester 2026-27 (active, ₹50,000 budget)
- **8 Expense Categories**: Logistics, Refreshments, Marketing & Printing, Equipment & Supplies, Travel & Accommodation, Honorarium & Prizes, Venue & Infrastructure, Miscellaneous
- **8 Budget Allocations**: Full ₹50,000 distributed across categories for the current semester
- **17+ Events**: Historical + current, across all clubs and event types
- **28+ Expenses**: Across both semesters with varying statuses (APPROVED, PENDING, REJECTED)
- **5 Audit Logs**: Seed samples including semester lock, event submit, event verify, budget allocate

### Demo Conflict Scenario

The seed creates two events specifically designed to demonstrate the conflict detection engine:

| | Hackathon | Workshop |
|---|---|---|
| **Title** | [DEMO] Technical Hackathon — Coding Club | [DEMO] Technical Workshop on DSA — ACM |
| **Club** | Coding Club | ACM Student Chapter |
| **Venue** | LT-1 | **LT-1 (SAME)** |
| **Time (IST)** | 4:00 PM – 8:00 PM | **5:00 PM – 7:00 PM (OVERLAP)** |
| **Time (UTC)** | 10:30 – 14:30 | 11:30 – 13:30 |
| **Audience** | 2nd Year, CSE/IT | **2nd Year, CSE/IT (SAME)** |
| **Status** | VERIFIED | SUBMITTED |

The conflict engine (Phase 4) will detect:
- `VENUE` conflict (HIGH severity) — same LT-1 at overlapping times
- `AUDIENCE` conflict (MEDIUM severity) — identical audience cell expansion

Both events coexist in the database without any constraint violations. ⚠️

---

## ER Overview

```
Semester ←──── Event ────→ Venue
   │              │
   │              ├──→ Club ←── User
   │              ├──→ EventReview
   │              ├──→ ConflictRecord (self-join via eventAId/eventBId)
   │              └──→ Expense ────→ Receipt
   │
   └──→ BudgetAllocation ────→ ExpenseCategory
                                    ↑
                              Expense ──────────→ AuditLog
                                         User ──→ Notification
```

---

## Phase 2: Authentication & Authorization Foundation

### 1. Architecture

Authentication is powered by **Auth.js / NextAuth v5** for Next.js 16 App Router using a JWT session strategy:

- **Endpoint**: `/api/auth/[...nextauth]`
- **Credentials Provider**: For local development and demonstration. Validates email against database, compares passwords using `bcryptjs`, and ensures `user.isActive === true`.
- **Google OAuth Provider**: Environment-driven (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- **Domain Restriction**: Enforces `ALLOWED_EMAIL_DOMAIN` (e.g. `@college.edu`). Non-matching domains are rejected during OAuth callback.
- **Safe Provisioning**: Newly created OAuth users are strictly assigned `role: VIEWER`. Elevated roles (`ACM_CORE`, `SUPER_ADMIN`, `ACM_EXEC`) cannot be self-assigned through OAuth.
- **Client Identity Invariant**: Identity, role, and club ownership are derived exclusively from the authenticated session and database. Request body fields attempting to specify `userId`, `role`, or `clubId` are strictly ignored.

### 2. Available Roles & RBAC Matrix

| Role | Meaning & Primary Capabilities |
|---|---|
| `SUPER_ADMIN` | Full system governance, global access, budget allocation, audit visibility. |
| `ACM_CORE` | Institutional authority: verify/reject events, resolve/override conflicts, approve/reject expenses, manage budgets, lock semesters, view audit. |
| `ACM_EXEC` | ACM operational role: submit ACM events, create ACM expenses, view verified calendar and budget. Cannot verify events or approve expenses. |
| `CLUB_REP` | External club representative: submit events and expenses for their assigned club ONLY. Acknowledge conflicts involving their events. |
| `VIEWER` | Read-only access: view verified calendar and published events. No write or mutation permissions. |

#### Permission Matrix

| Action | SUPER_ADMIN | ACM_CORE | ACM_EXEC | CLUB_REP | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|
| `VIEW_CALENDAR` / `VIEW_EVENT` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CREATE_EVENT` / `UPDATE_EVENT` / `SUBMIT_EVENT` | ✅ | ✅ | ✅ (ACM) | ✅ (Own Club) | ❌ |
| `VERIFY_EVENT` / `REJECT_EVENT` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `CANCEL_EVENT` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ACKNOWLEDGE_CONFLICT` | ✅ | ✅ | ❌ | ✅ (Party) | ❌ |
| `RESOLVE_CONFLICT` / `OVERRIDE_CONFLICT` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `CREATE_EXPENSE` / `UPDATE_EXPENSE` | ✅ | ✅ | ✅ (ACM) | ✅ (Own Club) | ❌ |
| `APPROVE_EXPENSE` / `REJECT_EXPENSE` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `VIEW_BUDGET` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `MANAGE_BUDGET` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `LOCK_SEMESTER` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `VIEW_ARCHIVE` / `VIEW_REPORTS` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `VIEW_AUDIT` | ✅ | ✅ | ❌ | ❌ | ❌ |

### 3. Resource Ownership & Multi-Tenancy Rules

RBAC is paired with strict resource ownership:
- `canAccessClub(user, clubId)`:
  - `SUPER_ADMIN` & `ACM_CORE`: Multi-tenant institutional access across any club.
  - `ACM_EXEC`: Access restricted to ACM club (`user.clubId`).
  - `CLUB_REP`: Strictly isolated to `user.clubId`. Attempts to act on another club throw `ForbiddenError` (HTTP 403).
  - `VIEWER`: Denied club administration access.
- `canManageEvent(user, event)`: Requires `UPDATE_EVENT` permission AND `canAccessClub(user, event.clubId)`.
- `canManageExpense(user, expense)`: Requires `UPDATE_EXPENSE` permission AND `canAccessClub(user, expense.clubId)`.

### 4. Demo Login Credentials

For local development and testing, all seeded accounts are provisioned with:

- **Password**: `DemoPassword123!`

| Role | Demo Email |
|---|---|
| `SUPER_ADMIN` | `superadmin@acm-demo.college.edu` |
| `ACM_CORE` | `core@acm-demo.college.edu` |
| `ACM_EXEC` | `exec@acm-demo.college.edu` |
| `CLUB_REP` (Coding Club) | `rep.coding@acm-demo.college.edu` |
| `CLUB_REP` (Robotics Club) | `rep.robotics@acm-demo.college.edu` |
| `CLUB_REP` (GDSC) | `rep.gdsc@acm-demo.college.edu` |
| `CLUB_REP` (E-Cell) | `rep.ecell@acm-demo.college.edu` |
| `VIEWER` | `viewer@acm-demo.college.edu` |

### 5. Error Handling: 401 vs 403

- **HTTP 401 (`UnauthorizedError`)**: Thrown when a request lacks an authenticated session or has an invalid/expired token (`requireUser()`).
- **HTTP 403 (`ForbiddenError`)**: Thrown when an authenticated user lacks the required RBAC permission or attempts a cross-tenant ownership violation (`requirePermission()`, `requireClubAccess()`).

---

## Phase 3: Event Management & Calendar API

Phase 3 introduces the complete event management domain service and Calendar API consumed by the Phase 4 Conflict Engine and Phase 9 FullCalendar UI.

### 1. Event State Machine

```text
       ┌───────────┐
       │   DRAFT   │
       └─────┬─────┘
             │ (SUBMIT_EVENT by Club Owner / ACM)
             ▼
       ┌───────────┐
       │ SUBMITTED │
       └─┬───────┬─┘
         │       │
(REJECT) │       │ (VERIFY_EVENT by ACM Core / Super Admin)
         ▼       ▼
   ┌──────────┐ ┌──────────┐
   │ REJECTED │ │ VERIFIED │
   └──────────┘ └─┬──────┬─┘
                  │      │
(CANCEL with note)│      │ (Auto-transition on completion)
                  ▼      ▼
            ┌───────────┐┌───────────┐
            │ CANCELLED ││ COMPLETED │
            └───────────┘└───────────┘
```

#### Lifecycle Rules & Invariants:
- **`DRAFT`**: Initial state on creation. Can be updated or soft-deleted by the owning club rep or ACM Core.
- **`SUBMITTED`**: Event submitted for institutional verification. Edits remain permitted.
- **`VERIFIED`**: Approved by ACM Core or Super Admin. Records an `EventReview` decision row (`VERIFIED`) and transactional `AuditLog` entry. Direct updates are locked.
- **`REJECTED`**: Rejected by ACM Core with mandatory `reason`. Records `EventReview` row (`REJECTED`) and `AuditLog`.
- **`CANCELLED`**: Cancelled by owning club or ACM Core with mandatory `reason`.
- **Soft Deletion**: `deletedAt` timestamp set. Never physically deleted from PostgreSQL. Automatically filtered out from calendar feeds and query listings.

### 2. Endpoints Summary

| Method | Endpoint | Description | Permissions |
|---|---|---|---|
| `POST` | `/api/events` | Create new event in `DRAFT` status | `CREATE_EVENT` + Club ownership |
| `GET` | `/api/events` | List events with filters & pagination | `VIEW_CALENDAR` (Scoped by role) |
| `GET` | `/api/events/[id]` | Get event detail with reviews & relations | `VIEW_EVENT` (Drafts scoped) |
| `PATCH` | `/api/events/[id]` | Update draft/submitted event | `UPDATE_EVENT` + Club ownership |
| `DELETE` | `/api/events/[id]` | Soft-delete draft event | `UPDATE_EVENT` + Club ownership |
| `POST` | `/api/events/[id]/submit` | Transition `DRAFT` -> `SUBMITTED` | `SUBMIT_EVENT` + Club ownership |
| `POST` | `/api/events/[id]/verify` | Transition `SUBMITTED` -> `VERIFIED` | `VERIFY_EVENT` (ACM Core/Admin) |
| `POST` | `/api/events/[id]/reject` | Transition `SUBMITTED` -> `REJECTED` | `REJECT_EVENT` (ACM Core/Admin) |
| `POST` | `/api/events/[id]/cancel` | Transition `VERIFIED/SUBMITTED` -> `CANCELLED` | `CANCEL_EVENT` or Club owner |
| `GET` | `/api/calendar` | FullCalendar event feed (`from`, `to`) | `VIEW_CALENDAR` |

### 3. Calendar Feed (`GET /api/calendar`)

Queries events overlapping the specified `[from, to)` ISO-8601 UTC window (up to 366 days).

**Response format (`FullCalendarEvent`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cm123456789...",
      "title": "[DEMO] Technical Hackathon — Coding Club",
      "start": "2026-09-20T10:30:00.000Z",
      "end": "2026-09-20T14:30:00.000Z",
      "extendedProps": {
        "status": "VERIFIED",
        "clubId": "cm123...",
        "clubName": "Coding Club",
        "clubCode": "CC",
        "venueId": "cm456...",
        "venueName": "Lecture Theatre 1 (LT-1)",
        "eventType": "HACKATHON",
        "expectedAttendees": 80,
        "targetYears": [2],
        "targetBranches": ["CSE", "IT"],
        "organizer": "Coding Club"
      }
    }
  ]
}
```


---

## Phase 4: Conflict Detection Engine

Phase 4 introduces the core scheduling conflict engine, designed to detect, score, and flag overlapping events without automatically altering them (Human Decision Principle).

### 1. Conflict Types

The engine identifies four primary conflict conditions between overlapping events:

1. **VENUE**: Two events claim the same physical venue simultaneously.
2. **ORGANIZER**: The same club (clubId) attempts to organize overlapping events.
3. **AUDIENCE**: Two events simultaneously target overlapping demographics (Years & Branches).
4. **TIGHT_TURNAROUND**: Sequential events have a gap of less than 30 minutes, risking setup/teardown overlap.

### 2. Time Overlap Semantics

- **End-Exclusive Interval**: Two events A and B overlap temporally if and only if A.startAt < B.endAt AND B.startAt < A.endAt.
- Boundary-touching events (e.g. 10:00-11:00 and 11:00-12:00) do **NOT** overlap in time.

### 3. Jaccard Audience Similarity

Audience targets are expanded into logical cells: (year, branch). 
Similarity is calculated using the Jaccard index:
Jaccard = |A n B| / |A ? B|

Wildcards ([] representing ALL years or ALL branches) automatically expand to match any opposing targets proportionally.

### 4. Weighted Scoring Formula

A normalized   to 1 score determines conflict severity:

`	ext
Score = 0.4 * (Jaccard Audience Similarity) 
      + 0.3 * (Temporal Overlap Ratio) 
      + 0.2 * (Same Event Type Match) 
      + 0.1 * (Normalized Expected Audience Size)
`

- **Severity Thresholds**:
  - HIGH: Score >= 0.70
  - MEDIUM: Score >= 0.40 and < 0.70
  - LOW: Score < 0.40 (Filtered if strictly audience-based, retained if Venue/Organizer/Turnaround).

### 5. Idempotent Data Model

Conflicts are stored transactionally with a canonical unique constraint:
[eventAId, eventBId, conflictType] where eventAId is always the lexicographically smaller ID. This guarantees no duplicate pairs. 

When events are updated and no longer conflict, stale records are gracefully marked RESOLVED.

### 6. Conflict APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/events/[id]/conflicts/detect | Triggers detection for an event, upserts records |
| GET | /api/events/[id]/conflicts | Retrieves all detected conflicts involving the event |
| POST | /api/conflicts/[id]/acknowledge | Club Rep acknowledges the conflict |
| POST | /api/conflicts/[id]/resolve | ACM Core resolves the conflict with notes |
| POST | /api/conflicts/[id]/override | Super Admin forcibly overrides the conflict |

