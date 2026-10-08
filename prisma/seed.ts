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

  // --- Units (Day 3) -------------------------------------------------------
  const unitsData = [
    { name: "Gram", short: "g", equivalentTo: 1, unitType: "weight", system: "metric" },
    { name: "Kilogram", short: "kg", equivalentTo: 1000, unitType: "weight", system: "metric" },
    { name: "Milliliter", short: "ml", equivalentTo: 1, unitType: "volume", system: "metric" },
    { name: "Piece", short: "pc", equivalentTo: 1, unitType: "count", system: "metric" },
  ];
  const units = [];
  for (const unit of unitsData) {
    const existing = await prisma.unit.findFirst({ where: { name: unit.name } });
    units.push(existing ?? (await prisma.unit.create({ data: unit })));
  }
  console.log(`Seeded ${units.length} units`);
  const gram = units.find((u) => u.name === "Gram")!;
  const piece = units.find((u) => u.name === "Piece")!;

  // --- Ingredients (Day 3, linked to a category + unit) --------------------
  const balancedCategory = categories.find((c) => c.name === "Balanced")!;
  const highProteinCategory = categories.find((c) => c.name === "High Protein")!;
  const ingredientsData = [
    {
      name: "Chicken Breast",
      description: "Skinless, boneless chicken breast",
      calories: 165,
      protein: 31,
      fat: 3.6,
      carbs: 0,
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      soyaFree: true,
      nutFree: true,
      servingSizeAmount: 100,
      servingSizeUnit: "g",
      state: "active",
      categoryId: highProteinCategory.id,
      unitId: gram.id,
    },
    {
      name: "Brown Rice",
      description: "Cooked brown rice",
      calories: 111,
      protein: 2.6,
      fat: 0.9,
      carbs: 23,
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      soyaFree: true,
      nutFree: true,
      servingSizeAmount: 100,
      servingSizeUnit: "g",
      state: "active",
      categoryId: balancedCategory.id,
      unitId: gram.id,
    },
    {
      name: "Broccoli",
      description: "Steamed broccoli florets",
      calories: 35,
      protein: 2.4,
      fat: 0.4,
      carbs: 7,
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      soyaFree: true,
      nutFree: true,
      servingSizeAmount: 100,
      servingSizeUnit: "g",
      state: "active",
      categoryId: balancedCategory.id,
      unitId: gram.id,
    },
    {
      name: "Turkey Breast",
      description: "Skinless, boneless turkey breast — used as a chicken substitute",
      calories: 135,
      protein: 30,
      fat: 1,
      carbs: 0,
      vegan: false,
      vegetarian: false,
      glutenFree: true,
      soyaFree: true,
      nutFree: true,
      servingSizeAmount: 100,
      servingSizeUnit: "g",
      state: "active",
      categoryId: highProteinCategory.id,
      unitId: gram.id,
    },
    {
      name: "Egg",
      description: "Whole large egg",
      calories: 78,
      protein: 6,
      fat: 5,
      carbs: 0.6,
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      soyaFree: true,
      nutFree: true,
      servingSizeAmount: 1,
      servingSizeUnit: "pc",
      state: "active",
      categoryId: highProteinCategory.id,
      unitId: piece.id,
    },
  ];
  const ingredients = [];
  for (const ingredient of ingredientsData) {
    const existing = await prisma.ingredient.findFirst({ where: { name: ingredient.name } });
    ingredients.push(existing ?? (await prisma.ingredient.create({ data: ingredient })));
  }
  console.log(`Seeded ${ingredients.length} ingredients`);
  const chickenBreast = ingredients.find((i) => i.name === "Chicken Breast")!;
  const brownRice = ingredients.find((i) => i.name === "Brown Rice")!;
  const broccoli = ingredients.find((i) => i.name === "Broccoli")!;
  const turkeyBreast = ingredients.find((i) => i.name === "Turkey Breast")!;

  // --- General meal types (Day 3) -------------------------------------------
  const generalMealTypesData = [
    {
      name: "Breakfast",
      description: "First meal of the day",
      state: "active",
      proteinPercentage: 25,
      carbsPercentage: 50,
      fatsPercentage: 25,
      minimumProtein: 20,
      startTime: "06:00",
      endTime: "10:00",
    },
    {
      name: "Lunch",
      description: "Midday meal",
      state: "active",
      proteinPercentage: 30,
      carbsPercentage: 45,
      fatsPercentage: 25,
      minimumProtein: 25,
      startTime: "12:00",
      endTime: "14:00",
    },
    {
      name: "Dinner",
      description: "Evening meal",
      state: "active",
      proteinPercentage: 35,
      carbsPercentage: 35,
      fatsPercentage: 30,
      minimumProtein: 30,
      startTime: "18:00",
      endTime: "21:00",
    },
  ];
  const generalMealTypes = [];
  for (const mealType of generalMealTypesData) {
    const existing = await prisma.generalMealType.findFirst({ where: { name: mealType.name } });
    generalMealTypes.push(existing ?? (await prisma.generalMealType.create({ data: mealType })));
  }
  console.log(`Seeded ${generalMealTypes.length} general meal types`);
  const dinnerType = generalMealTypes.find((t) => t.name === "Dinner")!;

  // --- Recipe (Day 3, with recipeIngredients + a substitute) ---------------
  let chickenRiceRecipe = await prisma.recipe.findFirst({ where: { name: "Chicken & Rice Bowl" } });
  if (!chickenRiceRecipe) {
    chickenRiceRecipe = await prisma.recipe.create({
      data: {
        name: "Chicken & Rice Bowl",
        description: "A simple high-protein bowl of chicken breast, brown rice and broccoli",
        prepTime: 10,
        cookTime: 20,
        difficulty: "easy",
        servings: 2,
        calories: 520,
        protein: 45,
        carbs: 55,
        fat: 10,
        instructions: [
          "Season the chicken breast and grill or pan-sear until cooked through.",
          "Cook the brown rice according to package instructions.",
          "Steam the broccoli until tender.",
          "Slice the chicken and combine with rice and broccoli in a bowl.",
        ],
        recipeIngredients: {
          create: [
            {
              minAmount: 150,
              baseAmount: 200,
              maxAmount: 250,
              roundAmount: 10,
              ingredient: { connect: { id: chickenBreast.id } },
              unit: { connect: { id: gram.id } },
              substitutes: {
                create: [
                  {
                    // Turkey breast is slightly less calorie-dense than
                    // chicken breast per gram, so its base amount is a bit
                    // higher for a roughly equivalent protein/calorie swap -
                    // this is exactly the kind of per-substitute difference
                    // the old schema (no amount fields at all) couldn't
                    // represent.
                    minAmount: 160,
                    baseAmount: 210,
                    maxAmount: 260,
                    roundAmount: 10,
                    substituteIngredient: { connect: { id: turkeyBreast.id } },
                    unit: { connect: { id: gram.id } },
                  },
                ],
              },
            },
            {
              minAmount: 100,
              baseAmount: 150,
              maxAmount: 200,
              roundAmount: 5,
              ingredient: { connect: { id: brownRice.id } },
              unit: { connect: { id: gram.id } },
            },
            {
              minAmount: 75,
              baseAmount: 100,
              maxAmount: 150,
              roundAmount: 5,
              ingredient: { connect: { id: broccoli.id } },
              unit: { connect: { id: gram.id } },
            },
          ],
        },
      },
    });
  }
  console.log(`Seeded recipe: ${chickenRiceRecipe.name}`);

  // --- Meal (Day 3, wiring categories + generalMealTypes + recipes) --------
  const existingMeal = await prisma.meal.findFirst({ where: { name: "High Protein Dinner Bowl" } });
  if (!existingMeal) {
    const meal = await prisma.meal.create({
      data: {
        name: "High Protein Dinner Bowl",
        description: "A high protein dinner option built around the chicken & rice bowl recipe",
        calories: 520,
        protein: 45,
        carbs: 55,
        fat: 10,
        categories: { connect: [{ id: highProteinCategory.id }] },
        generalMealTypes: { connect: [{ id: dinnerType.id }] },
        recipes: { connect: [{ id: chickenRiceRecipe.id }] },
      },
    });
    console.log(`Seeded meal: ${meal.name}`);
  } else {
    console.log(`Seeded meal: ${existingMeal.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
