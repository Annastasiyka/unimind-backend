import express from 'express';
import { User } from '../models/User.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Ініціалізація Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post('/chat', async (req: any, res: any) => {
  const { message, userId, workSchedule } = req.body;

  try {
    // 1. Отримуємо повні дані користувача з БД (PostgreSQL)
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ reply: "Користувача не знайдено 👤" });

const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });    // 2. Формуємо дату у твоєму форматі без нулів (наприклад, 18-5-2026)
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

    // 3. Створюємо максимально деталізований промпт для ШІ
    const prompt = `
      Ти - інтелектуальний ментор UniMind. Твоя мета: стратегічне планування навчання та життя студента.
      Поточна дата: ${dateStr}. Поточний час: ${today.getHours()}:${today.getMinutes()}.
      
      КОНТЕКСТ КОРИСТУВАЧА:
      - Робочий графік (НЕ плануй на цей час): ${JSON.stringify(workSchedule)}.
      - Вже існуючі плани в календарі: ${JSON.stringify(user.plans)}.
      - Навчальна програма (семестри та дедлайни): ${JSON.stringify(user.semesters)}.

      ТВОЇ ПРАВИЛА ТА ЛОГІКА:
      1. КРИТИЧНА ПЕРЕВІРКА: Перед плануванням ПЕРЕВІР масив "Вже існуючі плани". 
         ТИ НЕ МАЄШ ПРАВА видаляти, змінювати або ігнорувати старі плани користувача. 
         Якщо час зайнятий існуючим планом, шукай інше вільне вікно.
      
      2. ОЦІНКА ЧАСУ (АЛГОРИТМ):
         - Лабораторна робота: 1.5 - 4 години (залежно від складності).
         - Підготовка до КР/Іспиту: блоки по 2 - 3 години.
         - Домашнє завдання: 45 - 60 хвилин.
         - Прийоми їжі: до 1 години.
         - Не плануй важкі розумові завдання пізніше 21:00.

      3. СТРАТЕГІЇ (Пропонуй, якщо бачиш дедлайн у semesters або користувач просить план):
         - "Заздалегідь" (Accelerated): інтенсивний блок сьогодні/завтра. Мета: швидше закінчити і мати більше вільного часу потім.
         - "Поволі" (Steady): розподіл завдання на маленькі частини (по 40-50 хв) щодня до дедлайну.
      
      4. КОМУНІКАЦІЯ ТА КНОПКИ (options):
         - Не додавай плани автоматично, якщо користувач просто запитує поради або розпитує.
         - Спочатку запропонуй стратегію ("Розподілити?" чи "Зробити за раз?") і чекай відповіді через КНОПКИ (поле options).
         - Тільки після підтвердження користувачем додавай об'єкти в масив newPlans.

      ПРАВИЛА ВІДПОВІДІ (ТІЛЬКИ JSON):
      {
        "reply": "Текст твоєї відповіді (природний, дружній, українською)",
        "options": ["Текст кнопки 1", "Текст кнопки 2"], 
        "newPlans": [
          { 
            "id": "ai-${Date.now()}", 
            "text": "Назва справи", 
            "time": "HH:mm", 
            "date": "${dateStr}", 
            "type": "Навчання/Особисте/Wellness" 
          }
        ]
      }
      *newPlans має бути порожнім [], поки триває обговорення стратегії.*

      ЗАПИТ КОРИСТУВАЧА: "${message}"
    `;

    // 4. Запит до ШІ та обробка відповіді
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Очищення від Markdown
    responseText = responseText.replace(/```json|```/g, "").trim();
    
    let aiData;
    try {
      aiData = JSON.parse(responseText);
    } catch (e) {
      console.error("JSON Error:", responseText);
      return res.json({ 
        reply: "Я склав чудовий план, але виникла помилка в моїх розрахунках. Спробуй ще раз! 🤖", 
        options: ["Спробувати ще раз"], 
        newPlans: [] 
      });
    }

    // 5. Автоматичне збереження в PostgreSQL, якщо ШІ згенерував плани
    if (aiData.newPlans && aiData.newPlans.length > 0) {
      // Важливо: перевіряємо чи плани за поточний день не дублюються
      user.plans = [...(user.plans || []), ...aiData.newPlans];
      await user.save();
    }

    res.json(aiData);
  } catch (error) {
    console.error("AI Route Error:", error);
    res.status(500).json({ reply: "Мої сервери зараз відпочивають. Спробуй пізніше! 🔌", options: [] });
  }
});

export default router;