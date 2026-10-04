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
