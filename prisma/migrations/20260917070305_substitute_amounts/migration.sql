/*
  Warnings:

  - Added the required column `baseAmount` to the `ingredient_substitutes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxAmount` to the `ingredient_substitutes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minAmount` to the `ingredient_substitutes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roundAmount` to the `ingredient_substitutes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitId` to the `ingredient_substitutes` table without a default value. This is not possible if the table is not empty.

  This migration deletes existing rows in ingredient_substitutes (dev seed
  data only, pre-launch) rather than backfilling a default, since a
  substitute's amount is meaningful, per-row data with no sensible default -
  the seed script recreates them with real values.
*/
-- Clear dev/seed data that predates these required columns.
TRUNCATE TABLE "ingredient_substitutes";

-- AlterTable
ALTER TABLE "ingredient_substitutes" ADD COLUMN     "baseAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "maxAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "minAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "roundAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "unitId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "ingredient_substitutes" ADD CONSTRAINT "ingredient_substitutes_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
