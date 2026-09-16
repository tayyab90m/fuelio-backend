/*
  Warnings:

  - Added the required column `calories` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carbs` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cookTime` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difficulty` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fat` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instructions` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prepTime` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `protein` to the `recipes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `servings` to the `recipes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "calories" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "carbs" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "cookTime" INTEGER NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "difficulty" TEXT NOT NULL,
ADD COLUMN     "fat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "instructions" JSONB NOT NULL,
ADD COLUMN     "prepTime" INTEGER NOT NULL,
ADD COLUMN     "protein" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "servings" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION NOT NULL,
    "roundAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_substitutes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipeIngredientId" TEXT NOT NULL,
    "substituteIngredientId" TEXT NOT NULL,

    CONSTRAINT "ingredient_substitutes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_substitutes" ADD CONSTRAINT "ingredient_substitutes_recipeIngredientId_fkey" FOREIGN KEY ("recipeIngredientId") REFERENCES "recipe_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_substitutes" ADD CONSTRAINT "ingredient_substitutes_substituteIngredientId_fkey" FOREIGN KEY ("substituteIngredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
