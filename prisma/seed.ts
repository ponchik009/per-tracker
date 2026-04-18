import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const mockUser = await prisma.user.upsert({
    where: { telegramId: BigInt(111111111) },
    update: {},
    create: {
      telegramId: BigInt(111111111),
      firstName: "Demo",
      timezone: "Europe/Moscow",
      timezoneOffsetMin: 180,
    },
  });

  const existingPet = await prisma.pet.findFirst({
    where: {
      name: "Аска (демо)",
      owners: { some: { userId: mockUser.id } },
      isDeleted: false,
    },
  });

  if (existingPet) {
    console.log("Seed already exists");
    return;
  }

  const mockPet = await prisma.pet.create({
    data: {
      name: "Аска (демо)",
      breed: "Шотландская вислоухая",
      birthDate: new Date("2024-05-15T00:00:00.000Z"),
      currentWeightKg: 3.5,
      sex: "FEMALE",
      isSterilized: true,
      photoFileId: "demo-file-id",
      owners: { create: { userId: mockUser.id } },
      weightLogs: {
        createMany: {
          data: [{ weightKg: 3.2 }, { weightKg: 3.3 }, { weightKg: 3.4 }, { weightKg: 3.5 }],
        },
      },
      feedingConfig: {
        create: {
          dryFoodDailyGrams: 20,
          wetFoodDailyPacks: 1,
          scheduleItems: {
            createMany: {
              data: [
                { feedType: "WET", amount: 0.5, minutesOfDay: 360 },
                { feedType: "DRY", amount: 10, minutesOfDay: 480 },
                { feedType: "WET", amount: 0.5, minutesOfDay: 1080 },
                { feedType: "DRY", amount: 10, minutesOfDay: 1200 },
              ],
            },
          },
        },
      },
    },
  });

  await prisma.petEvent.createMany({
    data: [
      { petId: mockPet.id, kind: "PEE", comment: "Утро" },
      { petId: mockPet.id, kind: "POO", comment: "После завтрака" },
      { petId: mockPet.id, kind: "PLAY", comment: "Играла с мячиком" },
    ],
  });

  console.log("Seed data prepared");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
