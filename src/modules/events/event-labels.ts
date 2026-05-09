import { PetEventKind } from "@prisma/client";

export const petEventLabelsRu: Record<PetEventKind, string> = {
  PEE: "Пописала",
  POO: "Покакала",
  PLAY: "Поиграла",
  SYMPTOM: "Симптом",
  CUSTOM: "Другое",
  FEEDING: "Кормление",
};
