-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "stepRangeMin" INTEGER NOT NULL,
    "stepRangeMax" INTEGER NOT NULL,
    "workoutRangeMin" INTEGER NOT NULL,
    "workoutRangeMax" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calorieAdjustment" JSONB NOT NULL,
    "macroRatios" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortingPriority" INTEGER NOT NULL,
    "proteinMin" DOUBLE PRECISION NOT NULL,
    "proteinMax" DOUBLE PRECISION NOT NULL,
    "fatMin" DOUBLE PRECISION NOT NULL,
    "fatMax" DOUBLE PRECISION NOT NULL,
    "carbsMin" DOUBLE PRECISION NOT NULL,
    "carbsMax" DOUBLE PRECISION NOT NULL,
    "minimalDailyCaloriesMen" INTEGER NOT NULL,
    "minimalDailyCaloriesWomen" INTEGER NOT NULL,
    "mealSwapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "toleranceOfTotalCalories" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuisines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuisines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT,
    "equivalentTo" DOUBLE PRECISION,
    "unitType" TEXT,
    "system" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "vegan" BOOLEAN NOT NULL DEFAULT false,
    "vegetarian" BOOLEAN NOT NULL DEFAULT false,
    "glutenFree" BOOLEAN NOT NULL DEFAULT false,
    "soyaFree" BOOLEAN NOT NULL DEFAULT false,
    "nutFree" BOOLEAN NOT NULL DEFAULT false,
    "servingSizeAmount" DOUBLE PRECISION NOT NULL,
    "servingSizeUnit" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "unitId" TEXT,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "general_meal_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "proteinPercentage" DOUBLE PRECISION NOT NULL,
    "carbsPercentage" DOUBLE PRECISION NOT NULL,
    "fatsPercentage" DOUBLE PRECISION NOT NULL,
    "minimumProtein" DOUBLE PRECISION NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_meal_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GoalCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_MealCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_MealGeneralMealTypes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_MealRecipes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_GoalCategories_AB_unique" ON "_GoalCategories"("A", "B");

-- CreateIndex
CREATE INDEX "_GoalCategories_B_index" ON "_GoalCategories"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MealCategories_AB_unique" ON "_MealCategories"("A", "B");

-- CreateIndex
CREATE INDEX "_MealCategories_B_index" ON "_MealCategories"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MealGeneralMealTypes_AB_unique" ON "_MealGeneralMealTypes"("A", "B");

-- CreateIndex
CREATE INDEX "_MealGeneralMealTypes_B_index" ON "_MealGeneralMealTypes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MealRecipes_AB_unique" ON "_MealRecipes"("A", "B");

-- CreateIndex
CREATE INDEX "_MealRecipes_B_index" ON "_MealRecipes"("B");

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoalCategories" ADD CONSTRAINT "_GoalCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoalCategories" ADD CONSTRAINT "_GoalCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealCategories" ADD CONSTRAINT "_MealCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealCategories" ADD CONSTRAINT "_MealCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealGeneralMealTypes" ADD CONSTRAINT "_MealGeneralMealTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "general_meal_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealGeneralMealTypes" ADD CONSTRAINT "_MealGeneralMealTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealRecipes" ADD CONSTRAINT "_MealRecipes_A_fkey" FOREIGN KEY ("A") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealRecipes" ADD CONSTRAINT "_MealRecipes_B_fkey" FOREIGN KEY ("B") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
