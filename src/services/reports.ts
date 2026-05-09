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

const appendSheetFromAoa = (
  wb: XLSX.WorkBook,
  name: string,
  aoa: (string | number)[][],
) => {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
};

export const buildWeightReport = (rows: WeightRow[]): Buffer => {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number)[][] = [["Дата и время", "Вес (кг)"]];
  for (const row of rows) {
    aoa.push([row.date, row.weightKg]);
  }
  appendSheetFromAoa(wb, "Вес", aoa);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

export const buildEventsReport = (
  petName: string,
  weights: WeightRow[],
  events: EventRow[],
  feedings: EventRow[],
  timezone: string,
  periodLabel: string,
): Buffer => {
  const wb = XLSX.utils.book_new();

  const summaryAoa: (string | number)[][] = [
    ["Питомец", petName],
    ["Сгенерировано", new Date().toLocaleString("ru-RU", { timeZone: timezone })],
    ["Таймзона", timezone],
    ["Период", periodLabel],
    [],
    ["События (журнал PetEvent, как в боте)", "", ""],
    ["Дата и время", "Тип", "Комментарий"],
  ];

  if (events.length) {
    for (const e of events) {
      summaryAoa.push([e.date, e.type, e.comment]);
    }
  } else {
    summaryAoa.push(["— за этот период записей нет —", "", ""]);
  }

  summaryAoa.push([]);
  summaryAoa.push(["Кормления по расписанию / порции (FeedingLog)", "", ""]);
  summaryAoa.push(["Дата и время", "Тип", "Детали"]);

  if (feedings.length) {
    for (const f of feedings) {
      summaryAoa.push([f.date, f.type, f.comment]);
    }
  } else {
    summaryAoa.push(["— за этот период записей нет —", "", ""]);
  }

  summaryAoa.push([]);
  summaryAoa.push(["Вес (WeightLog)", "", ""]);
  summaryAoa.push(["Дата и время", "Вес (кг)", ""]);

  if (weights.length) {
    for (const w of weights) {
      summaryAoa.push([w.date, w.weightKg, ""]);
    }
  } else {
    summaryAoa.push(["— за этот период записей нет —", "", ""]);
  }

  appendSheetFromAoa(wb, "Сводка", summaryAoa);

  appendSheetFromAoa(wb, "События", [
    ["Дата и время", "Тип", "Комментарий"],
    ...events.map((e) => [e.date, e.type, e.comment]),
  ]);

  appendSheetFromAoa(wb, "Кормления", [
    ["Дата и время", "Тип", "Детали"],
    ...feedings.map((f) => [f.date, f.type, f.comment]),
  ]);

  appendSheetFromAoa(wb, "Вес", [
    ["Дата и время", "Вес (кг)"],
    ...weights.map((w) => [w.date, w.weightKg]),
  ]);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};
