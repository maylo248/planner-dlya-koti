# 🔥 Firebase Setup для Планер для коти

## Шаг 1: Создание проекта Firebase

1. Перейди на https://console.firebase.google.com/
2. Нажми "Добавить проект"
3. Введи имя: `planner-dlya-koti`
4. Отключи Google Analytics (необязательно)
5. Нажми "Создать проект"

## Шаг 2: Регистрация приложения

1. В проекте нажми на иконку "⚙️ Настройки" → "Общие"
2. Прокрути вниз до "Ваши приложения"
3. Нажми "web" (</>) 
4. Введи имя приложения: `Планер для коти`
5. Нажми "Зарегистрировать приложение"
6. **Скопируй `firebaseConfig` объект** — он понадобится для настройки

## Шаг 3: Включение аутентификации

1. В меню слева выбери "Аутентификация"
2. Нажми "Начать"
3. Перейди в "Способ входа" → "Эл. почта"
4. Включи "Эл. почта/пароль"
5. Нажми "Сохранить"

## Шаг 4: Создание базы данных Firestore

1. В меню слева выбери "Firestore Database"
2. Нажми "Создать базу данных"
3. Выбери "Начать в тестовом режиме"
4. Нажми "Далее" → "Включить"

## Шаг 5: Правила безопасности Firestore

1. Перейди в "Правила" для Firestore
2. Замени правила на:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Нажми "Опубликовать"

## Шаг 6: Настройка кода

1. Открой файл `js/firebase-init.js` в проекте
2. Замени `YOUR_API_KEY`, `YOUR_PROJECT_ID` и другие значения на данные из шага 2

## Пример firebaseConfig:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "planner-dlya-koti.firebaseapp.com",
  projectId: "planner-dlya-koti",
  storageBucket: "planner-dlya-koti.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Структура данных в Firestore:

```
users/
  {userId}/
    settings/        - Настройки пользователя
    days_2025_1/    - Дни за январь 2025
    days_2025_2/    - Дни за февраль 2025
    tasks/          - Задачи
    expenses/       - Расходы
    bonuses/        - Бонусы
    dayNotes/       - Заметки на дни
```

---

После настройки пользователи смогут:
- Регистрироваться и входить
- Все данные синхронизируются в облаке
- Данные доступны с любого устройства
