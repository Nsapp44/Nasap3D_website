-- AlterEnum
-- New enum values must be committed in their own migration before a later
-- migration can reference them (e.g. as a column DEFAULT) — see the
-- follow-up migration 20260814214500_order_expertise_workflow_columns.
ALTER TYPE "OrderStatus" ADD VALUE 'EXPERTISE';
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_PAYMENT';
ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED';
