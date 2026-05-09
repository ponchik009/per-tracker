export const petMenuInlineKeyboard = (petId: string) => [
  [{ text: "ℹ️ Основная информация", callback_data: `pet_info:${petId}` }],
  [{ text: "🍽️ Покормить", callback_data: `feed:${petId}` }],
  [{ text: "📝 Записать событие", callback_data: `events:${petId}` }],
  [{ text: "🗑️ Удалить информацию", callback_data: `delete:${petId}` }],
  [{ text: "⬅️ Назад", callback_data: "home" }],
];

export const petSectionsInlineKeyboard = (petId: string) => [
  [{ text: "✏️ Редактировать информацию", callback_data: `pet_edit_menu:${petId}` }],
  [{ text: "⚖️ Вес", callback_data: `weight:${petId}` }],
  [{ text: "🍽️ Питание", callback_data: `nut:${petId}` }],
  [{ text: "📋 События", callback_data: `events:${petId}` }],
  [{ text: "⬅️ Назад", callback_data: `pet:${petId}` }],
];

export const petEditMenuInlineKeyboard = (petId: string) => [
  [{ text: "Кличка", callback_data: `pet_edit:${petId}:name` }],
  [{ text: "Порода", callback_data: `pet_edit:${petId}:breed` }],
  [{ text: "Дата рождения", callback_data: `pet_edit:${petId}:birth_date` }],
  [{ text: "Пол", callback_data: `pet_edit:${petId}:sex` }],
  [{ text: "Стерилизация", callback_data: `pet_edit:${petId}:sterilized` }],
  [{ text: "⬅️ Назад", callback_data: `pet_info:${petId}` }],
];

export const deleteConfirmInlineKeyboard = (petId: string) => [
  [{ text: "Да, удалить", callback_data: `delete_confirm:${petId}` }],
  [{ text: "Нет, отмена", callback_data: `pet:${petId}` }],
];

export const openPetCardInlineKeyboard = (petId: string) => [
  [{ text: "ℹ️ Открыть карточку", callback_data: `pet_info:${petId}` }],
];
