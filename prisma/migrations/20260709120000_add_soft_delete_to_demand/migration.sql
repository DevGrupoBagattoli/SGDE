-- AlterTable
ALTER TABLE "Demand" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Demand_deletedAt_idx" ON "Demand"("deletedAt");
