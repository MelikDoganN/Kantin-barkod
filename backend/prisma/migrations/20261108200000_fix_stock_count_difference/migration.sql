-- v2's currency mapper scaled StockCountItem.difference by 100 like Shift.difference.
-- Quantities must be integer units. Preserve the displayed historical quantity difference.
BEGIN TRANSACTION;
UPDATE "StockCountItem" SET "difference" = "difference" / 100 WHERE "difference" IS NOT NULL;
COMMIT;
