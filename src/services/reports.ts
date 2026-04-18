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
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Вес");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

export const buildEventsReport = (
  petName: string,
  weights: WeightRow[],
  events: EventRow[],
  feedings: EventRow[],
): Buffer => {
  const wb = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Питомец", petName],
    ["Сгенерировано", new Date().toISOString()],
  ]);
  const weightsSheet = XLSX.utils.json_to_sheet(weights);
  const eventsSheet = XLSX.utils.json_to_sheet(events);
  const feedingSheet = XLSX.utils.json_to_sheet(feedings);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Сводка");
  XLSX.utils.book_append_sheet(wb, weightsSheet, "Вес");
  XLSX.utils.book_append_sheet(wb, eventsSheet, "События");
  XLSX.utils.book_append_sheet(wb, feedingSheet, "Кормления");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};
