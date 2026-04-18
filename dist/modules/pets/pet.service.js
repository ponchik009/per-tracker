"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePetSterilization = exports.updatePetSex = exports.updatePetBirthDate = exports.updatePetBreed = exports.updatePetName = exports.softDeletePet = exports.addPetAccessByCode = exports.createPetFromDraft = exports.listActivePetsByTelegramId = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../prisma");
const listActivePetsByTelegramId = async (telegramId) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        include: { pets: { include: { pet: true } } },
    });
    return user?.pets.filter((x) => !x.pet.isDeleted).map((x) => x.pet) ?? [];
};
exports.listActivePetsByTelegramId = listActivePetsByTelegramId;
const createPetFromDraft = async (userId, draft) => {
    return prisma_1.prisma.pet.create({
        data: {
            name: draft.name,
            breed: draft.breed,
            birthDate: new Date(draft.birthDate),
            currentWeightKg: draft.weightKg,
            sex: draft.sex === "FEMALE" ? client_1.PetSex.FEMALE : client_1.PetSex.MALE,
            isSterilized: draft.isSterilized,
            photoFileId: draft.photoFileId,
            owners: { create: { userId } },
            weightLogs: { create: { weightKg: draft.weightKg } },
        },
    });
};
exports.createPetFromDraft = createPetFromDraft;
const addPetAccessByCode = async (userId, code) => {
    const pet = await prisma_1.prisma.pet.findFirst({ where: { id: code, isDeleted: false } });
    if (!pet)
        return null;
    await prisma_1.prisma.petAccess.upsert({
        where: { userId_petId: { userId, petId: pet.id } },
        update: {},
        create: { userId, petId: pet.id },
    });
    return pet;
};
exports.addPetAccessByCode = addPetAccessByCode;
const softDeletePet = async (petId) => {
    await prisma_1.prisma.pet.update({ where: { id: petId }, data: { isDeleted: true } });
};
exports.softDeletePet = softDeletePet;
const updatePetName = async (petId, name) => {
    await prisma_1.prisma.pet.update({ where: { id: petId }, data: { name } });
};
exports.updatePetName = updatePetName;
const updatePetBreed = async (petId, breed) => {
    await prisma_1.prisma.pet.update({ where: { id: petId }, data: { breed } });
};
exports.updatePetBreed = updatePetBreed;
const updatePetBirthDate = async (petId, birthDate) => {
    await prisma_1.prisma.pet.update({ where: { id: petId }, data: { birthDate } });
};
exports.updatePetBirthDate = updatePetBirthDate;
const updatePetSex = async (petId, sex) => {
    await prisma_1.prisma.pet.update({
        where: { id: petId },
        data: { sex: sex === "FEMALE" ? client_1.PetSex.FEMALE : client_1.PetSex.MALE },
    });
};
exports.updatePetSex = updatePetSex;
const updatePetSterilization = async (petId, isSterilized) => {
    await prisma_1.prisma.pet.update({ where: { id: petId }, data: { isSterilized } });
};
exports.updatePetSterilization = updatePetSterilization;
