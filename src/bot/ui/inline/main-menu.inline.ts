export const buildHomeInlineKeyboard = (
  pets: Array<{ id: string; name: string }>,
) => {
  const buttons = pets.map((pet) => [
    { text: `🐾 ${pet.name}`, callback_data: `pet:${pet.id}` },
  ]);
  buttons.push([{ text: "➕ Добавить питомца", callback_data: "pet:add" }]);
  buttons.push([
    { text: "🤝 Поделиться информацией", callback_data: "share:open" },
  ]);

  return buttons;
};
