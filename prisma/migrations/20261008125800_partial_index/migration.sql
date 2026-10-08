CREATE UNIQUE INDEX budget_allocations_generic_unique ON "budget_allocations" ("semesterId", "categoryId") WHERE "clubId" IS NULL;
