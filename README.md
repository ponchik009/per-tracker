# Pet Tracker Bot

Telegram-бот на `Node.js + TypeScript` для учета жизни кошки: питание, туалет, события, вес, отчеты и напоминания.

## Стек

- `Telegraf` для Telegram Bot API
- `Prisma ORM` + `PostgreSQL`
- `node-cron` для уведомлений
- `xlsx` для выгрузок отчетов
- Docker для БД

## Архитектура

Проект разделен на слои, чтобы его можно было спокойно масштабировать:

- `src/bot` — Telegram transport-слой (обработчики, кнопки, тексты)
- `src/modules` — прикладная бизнес-логика по доменам:
  - `users` — user onboarding, user lookups
  - `pets` — питомцы и доступы
  - `feeding` — питание и расписание кормлений
  - `events` — события и кастомные типы
  - `sessions` — хранение состояния диалога
- `src/services` — кросс-функциональные сервисы (уведомления, отчеты XLSX)
- `src/utils` — парсинг/даты/вспомогательные функции
- `src/index.ts` — точка запуска приложения

## Почему Prisma

- Быстрая разработка схемы и миграций с type-safe клиентом.
- Удобно работать с вложенными связями (`pet -> feedingConfig -> scheduleItems`) без ручного SQL.
- Меньше бойлерплейта по сравнению с классическим подходом через репозитории в TypeORM.
- Хороший DX для дальнейшего роста проекта (в том числе refactor под сложные фильтры и отчеты).

TypeORM тоже подходит, но здесь Prisma дает более компактный и предсказуемый слой данных.

## Запуск

1. Скопируй `.env.example` в `.env` и заполни `TELEGRAM_BOT_TOKEN`.
2. Подними БД:

```bash
docker compose up -d
```

3. Прогони миграции и сгенерируй Prisma client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

4. Запусти бота:

```bash
npm run dev
```

## Продакшен-деплой на VPS через GitHub Actions

Серверу нужен только Docker + Docker Compose. Node.js/Prisma/npm на VPS не нужны.

### 1) Подготовь GitHub Secrets

- `VPS_HOST` — IP/домен VPS
- `VPS_USERNAME` — SSH пользователь
- `VPS_SSH_KEY` — приватный SSH ключ
- `GHCR_USERNAME` — пользователь GitHub для pull образа
- `GHCR_PAT` — токен с правом `read:packages`
- `PROD_ENV_FILE` — полный текст production `.env`

Пример `PROD_ENV_FILE`:

```dotenv
POSTGRES_USER=pet_user
POSTGRES_PASSWORD=strong_password
POSTGRES_DB=pet_tracker
DATABASE_URL=postgresql://pet_user:strong_password@postgres:5432/pet_tracker?schema=public
TELEGRAM_BOT_TOKEN=...
BOT_USERNAME=...
DEFAULT_TIMEZONE=Europe/Moscow
```

### 2) Запусти workflow

Workflow `.github/workflows/deploy.yml`:

- проверяет типы,
- собирает Docker image,
- пушит в `ghcr.io`,
- копирует `docker-compose.prod.yml` и deploy script на VPS,
- выполняет `docker compose pull && docker compose up -d`.

## Что уже есть

- Регистрация питомца (имя, порода, дата рождения, вес, пол, стерилизация, фото)
- Главное меню со списком питомцев и добавлением нового
- Карточка питомца + разделы веса, питания, событий
- Быстрое и плановое логирование кормления
- Добавление типовых и кастомных событий с комментариями
- XLSX отчеты по весу и событиям
- Напоминания о кормлении и еженедельном взвешивании
- Шаринг доступа к питомцу через код
- Мягкое удаление питомца

## Следующие шаги

- Настройка расписания кормления с произвольным количеством слотов
- Гибкая настройка уведомлений (вкл/выкл, окна тишины)
- Галерея питомца
- Калькулятор нормы сухого корма
