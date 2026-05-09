import * as XLSX from "xlsx";

type WeightRow = {
  date: string;
  weightKg: number;
};

type EventRow = {
  date: string;
  type: string;
  comment: string;
};

export const buildWeightReport = (rows: WeightRow[]): Buffer => {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: ["date", "weightKg"],
  });
  XLSX.utils.sheet_add_aoa(sheet, [["Дата", "Вес (кг)"]], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, sheet, "Вес");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

export const buildEventsReport = (
  petName: string,
  weights: WeightRow[],
  events: EventRow[],
  feedings: EventRow[],
  timezone: string,
): Buffer => {
  const wb = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Питомец", petName],
    ["Сгенерировано", new Date().toLocaleString("ru-RU", { timeZone: timezone })],
    ["Таймзона", timezone],
  ]);
  const weightsSheet = XLSX.utils.json_to_sheet(weights, {
    header: ["date", "weightKg"],
  });
  XLSX.utils.sheet_add_aoa(weightsSheet, [["Дата", "Вес (кг)"]], { origin: "A1" });
  const eventsSheet = XLSX.utils.json_to_sheet(events, {
    header: ["date", "type", "comment"],
  });
  XLSX.utils.sheet_add_aoa(eventsSheet, [["Дата", "Тип", "Комментарий"]], { origin: "A1" });
  const feedingSheet = XLSX.utils.json_to_sheet(feedings, {
    header: ["date", "type", "comment"],
  });
  XLSX.utils.sheet_add_aoa(feedingSheet, [["Дата", "Тип", "Комментарий"]], { origin: "A1" });
  XLSX.utils.book_append_sheet(wb, summarySheet, "Сводка");
  XLSX.utils.book_append_sheet(wb, weightsSheet, "Вес");
  XLSX.utils.book_append_sheet(wb, eventsSheet, "События");
  XLSX.utils.book_append_sheet(wb, feedingSheet, "Кормления");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};
