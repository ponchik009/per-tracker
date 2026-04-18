import { PetSex } from "@prisma/client";
import { prisma } from "../../prisma";

export const listActivePetsByTelegramId = async (telegramId: bigint) => {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: { pets: { include: { pet: true } } },
  });
  return user?.pets.filter((x) => !x.pet.isDeleted).map((x) => x.pet) ?? [];
};

export const createPetFromDraft = async (
  userId: string,
  draft: {
    name: string;
    breed: string;
    birthDate: string;
    weightKg: number;
    sex: "FEMALE" | "MALE";
    isSterilized: boolean;
    photoFileId: string;
  },
) => {
  return prisma.pet.create({
    data: {
      name: draft.name,
      breed: draft.breed,
      birthDate: new Date(draft.birthDate),
      currentWeightKg: draft.weightKg,
      sex: draft.sex === "FEMALE" ? PetSex.FEMALE : PetSex.MALE,
      isSterilized: draft.isSterilized,
      photoFileId: draft.photoFileId,
      owners: { create: { userId } },
      weightLogs: { create: { weightKg: draft.weightKg } },
    },
  });
};

export const addPetAccessByCode = async (userId: string, code: string) => {
  const pet = await prisma.pet.findFirst({ where: { id: code, isDeleted: false } });
  if (!pet) return null;
  await prisma.petAccess.upsert({
    where: { userId_petId: { userId, petId: pet.id } },
    update: {},
    create: { userId, petId: pet.id },
  });
  return pet;
};

export const softDeletePet = async (petId: string) => {
  await prisma.pet.update({ where: { id: petId }, data: { isDeleted: true } });
};

export const updatePetName = async (petId: string, name: string) => {
  await prisma.pet.update({ where: { id: petId }, data: { name } });
};

export const updatePetBreed = async (petId: string, breed: string) => {
  await prisma.pet.update({ where: { id: petId }, data: { breed } });
};

export const updatePetBirthDate = async (petId: string, birthDate: Date) => {
  await prisma.pet.update({ where: { id: petId }, data: { birthDate } });
};

export const updatePetSex = async (petId: string, sex: "FEMALE" | "MALE") => {
  await prisma.pet.update({
    where: { id: petId },
    data: { sex: sex === "FEMALE" ? PetSex.FEMALE : PetSex.MALE },
  });
};

export const updatePetSterilization = async (petId: string, isSterilized: boolean) => {
  await prisma.pet.update({ where: { id: petId }, data: { isSterilized } });
};
