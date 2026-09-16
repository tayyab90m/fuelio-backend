import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // --- Test user -----------------------------------------------------
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@fitnessdashboard.dev" },
    update: {},
    create: {
      email: "test@fitnessdashboard.dev",
      passwordHash,
      name: "Test User",
      phoneNumber: "+10000000000",
    },
  });
  console.log(`Seeded user: ${user.email} (password: Password123!)`);

  // --- Activity levels -------------------------------------------------
  const activityLevels = [
    {
      name: "Sedentary",
      multiplier: 1.2,
      description: "Little to no exercise, desk job",
      stepRangeMin: 0,
      stepRangeMax: 4999,
      workoutRangeMin: 0,
      workoutRangeMax: 0,
      state: "active",
    },
    {
      name: "Lightly Active",
      multiplier: 1.375,
      description: "Light exercise 1-3 days a week",
      stepRangeMin: 5000,
      stepRangeMax: 7499,
      workoutRangeMin: 1,
      workoutRangeMax: 3,
      state: "active",
    },
    {
      name: "Moderately Active",
      multiplier: 1.55,
      description: "Moderate exercise 3-5 days a week",
      stepRangeMin: 7500,
      stepRangeMax: 9999,
      workoutRangeMin: 3,
      workoutRangeMax: 5,
      state: "active",
    },
    {
      name: "Very Active",
      multiplier: 1.725,
      description: "Hard exercise 6-7 days a week",
      stepRangeMin: 10000,
      stepRangeMax: 15000,
      workoutRangeMin: 6,
      workoutRangeMax: 7,
      state: "active",
    },
  ];
  for (const level of activityLevels) {
    const existing = await prisma.activityLevel.findFirst({ where: { name: level.name } });
    if (!existing) {
      await prisma.activityLevel.create({ data: level });
    }
  }
  console.log(`Seeded ${activityLevels.length} activity levels`);

  // --- Categories --------------------------------------------------------
  const categoriesData = [
    {
      name: "Balanced",
      description: "A balanced macro split suitable for most goals",
      sortingPriority: 1,
      proteinMin: 20,
      proteinMax: 30,
      fatMin: 20,
      fatMax: 35,
      carbsMin: 40,
      carbsMax: 55,
      minimalDailyCaloriesMen: 1800,
      minimalDailyCaloriesWomen: 1400,
      mealSwapEnabled: true,
      toleranceOfTotalCalories: 5,
      unit: "kcal",
    },
    {
      name: "High Protein",
      description: "A higher protein macro split for muscle building",
      sortingPriority: 2,
      proteinMin: 30,
      proteinMax: 45,
      fatMin: 15,
      fatMax: 30,
      carbsMin: 30,
      carbsMax: 45,
      minimalDailyCaloriesMen: 2000,
      minimalDailyCaloriesWomen: 1600,
      mealSwapEnabled: true,
      toleranceOfTotalCalories: 5,
      unit: "kcal",
    },
    {
      name: "Low Carb",
      description: "A lower carb macro split",
      sortingPriority: 3,
      proteinMin: 25,
      proteinMax: 35,
      fatMin: 35,
      fatMax: 55,
      carbsMin: 10,
      carbsMax: 25,
      minimalDailyCaloriesMen: 1800,
      minimalDailyCaloriesWomen: 1400,
      mealSwapEnabled: false,
      toleranceOfTotalCalories: 3,
      unit: "kcal",
    },
  ];
  const categories = [];
  for (const category of categoriesData) {
    const existing = await prisma.category.findFirst({ where: { name: category.name } });
    categories.push(existing ?? (await prisma.category.create({ data: category })));
  }
  console.log(`Seeded ${categories.length} categories`);

  // --- Goals (linked to categories) --------------------------------------
  const goalsData = [
    {
      name: "Weight Loss",
      description: "Lose weight through a sustained calorie deficit",
      calorieAdjustment: { type: "decrease", percentage: 20 },
      macroRatios: { fats: 25, carbs: 40, protein: 35 },
      state: "active",
      categoryNames: ["Balanced", "Low Carb"],
    },
    {
      name: "Muscle Gain",
      description: "Build muscle through a calorie surplus and high protein intake",
      calorieAdjustment: { type: "increase", percentage: 15 },
      macroRatios: { fats: 20, carbs: 45, protein: 35 },
      state: "active",
      categoryNames: ["High Protein"],
    },
    {
      name: "Maintenance",
      description: "Maintain current weight with balanced nutrition",
      calorieAdjustment: { type: "maintain", percentage: 0 },
      macroRatios: { fats: 30, carbs: 40, protein: 30 },
      state: "active",
      categoryNames: ["Balanced"],
    },
  ];
  for (const goal of goalsData) {
    const existing = await prisma.goal.findFirst({ where: { name: goal.name } });
    if (!existing) {
      const relatedCategories = categories.filter((c) => goal.categoryNames.includes(c.name));
      await prisma.goal.create({
        data: {
          name: goal.name,
          description: goal.description,
          calorieAdjustment: goal.calorieAdjustment,
          macroRatios: goal.macroRatios,
          state: goal.state,
          categories: { connect: relatedCategories.map((c) => ({ id: c.id })) },
        },
      });
    }
  }
  console.log(`Seeded ${goalsData.length} goals`);

  // --- Cuisines ------------------------------------------------------------
  const cuisines = ["Mediterranean", "Asian", "Mexican", "American"];
  for (const name of cuisines) {
    const existing = await prisma.cuisine.findFirst({ where: { name } });
    if (!existing) {
      await prisma.cuisine.create({ data: { name, state: "active" } });
    }
  }
  console.log(`Seeded ${cuisines.length} cuisines`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
