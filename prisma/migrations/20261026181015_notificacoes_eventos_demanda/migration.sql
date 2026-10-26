-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_SCHEDULE_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_DESCRIPTION_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_DELETED';
ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_ACK_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'DEMAND_UNSEEN_ESCALATION';
