export const bottomNavInlineKeyboard = (petId?: string) => {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  if (petId) {
    rows.push([{ text: "🐾 К питомцу", callback_data: `pet_info:${petId}` }]);
  }

  rows.push([{ text: "🏠 Главное меню", callback_data: "home" }]);

  return rows;
};
