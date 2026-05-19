import express from "express";
import { User } from "../models/User.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 1. ЧАТ З ШІ ТА ОПТИМІЗАЦІЯ ГРАФІКА
router.post("/chat", async (req: express.Request, res: express.Response) => {
  const { message, userId, workSchedule, realTime, realDate, plansForToday, pastOverdue, semesters } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ reply: "Користувача не знайдено 👤" });

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const prompt = `
      Ти - інтелектуальний планувальник UniMind.
      ПОТОЧНА ДАТА: ${realDate}, ЧАС: ${realTime}.
      
      КОНТЕКСТ ДЛЯ ОПТИМІЗАЦІЇ:
      - Активні години користувача: ${JSON.stringify(workSchedule)}.
      - ПЛАНИ НА СЬОГОДНІ (включаючи завдання без часу): ${JSON.stringify(plansForToday)}.
      - ПРОСТРОЧЕНІ ЗАВДАННЯ: ${JSON.stringify(pastOverdue || [])}.
      - ДЕДЛАЙНИ (Семестр): ${JSON.stringify(semesters || [])}.

      ТВОЄ ЗАВДАННЯ: 
      1. Сформувати список updatedPlansForToday.
      2. ПРАВИЛО "БЕЗ ВТРАТ": Поверни ВСІ плани на сьогодні, що були передані тобі у "plansForToday". Не видаляй жодної справи! Якщо користувач просить щось перенести, просто зміни дату або час цього завдання, не дублюючи його.
      3. РОЗПОДІЛ ЧАСУ: Признач оптимальний час "HH:mm" для завдань, у яких поле time порожнє або відсутнє, враховуючи активні години користувача.
      4. СТАБІЛЬНІСТЬ: Якщо у завдання вже є час, не змінюй його, якщо немає критичних конфліктів з іншими справами.
      5. УНІКАЛЬНІСТЬ ХАРЧУВАННЯ: Ти можеш додавати або змінювати час прийомів їжі (сніданок, обід, вечеря). Якщо прийом їжі вже є в планах, просто відкоригуй або залиш його час.
      6. МОВНЕ ПРАВИЛО: СУВОРЕ ЗАБОРОНЕНО використовувати слова "Wellness", "велнес", "кат-велнес" у полі "reply". Пиши чистою українською мовою: "Обід", "Вечеря", "Час для здоров'я", "Відпочинок".
      7. СУВОРЕ УНИКНЕННЯ НАКЛАДАННЯ ЧАСУ (КОНФЛІКТІВ): 
         Завдання НЕ ПОВИННІ перетинатися між собою за часом. Враховуй середню тривалість справ:
         - "Навчання" та "Лабораторна" тривають 90 хвилин (1.5 год).
         - "Робота", "Персональне", "Wellness" (прийоми їжі/відпочинок) тривають 60 хвилин (1 год).
         Розставляй час "time" так, щоб кожне наступне завдання починалося лише ПІСЛЯ завершення попереднього (з урахуванням його тривалості).

      ФОРМАТ JSON (БЕЗ МАРКДАУНУ, ЛИШЕ ЧИСТИЙ ОБ'ЄКТ):
      {
        "reply": "Дружня відповідь користувачу українською мовою з підсумком змін (БЕЗ слів Wellness/велнес у тексті!)",
        "recommendations": ["Порада 1", "Порада 2"],
        "updatedPlansForToday": [ { "id": "копіювати існуючий id або згенерувати новий", "text": "назва", "time": "HH:mm", "date": "${realDate}", "type": "Навчання/Робота/Wellness/Персональне", "completed": false } ]
      }
    `;

    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());

    // Зберігаємо історію чату в БД
    const updatedHistory = [
      ...(user.chatHistory || []), 
      { id: `u-${Date.now()}`, role: "user", text: message }, 
      { id: `a-${Date.now()}`, role: "ai", text: aiData.reply }
    ].slice(-40);
    
    await user.update({ chatHistory: updatedHistory });

    res.json(aiData);
  } catch (error) {
    console.error("Помилка ШІ:", error);
    res.status(500).json({ reply: "ШІ тимчасово в офлайні 🔌" });
  }
});

// 2. ЗБЕРЕЖЕННЯ ПЛАНІВ У БАЗУ ДАНИХ (СИНХРОНІЗАЦІЯ ДЛЯ ІНШИХ ПРИСТРОЇВ)
router.post("/save-plans", async (req: express.Request, res: express.Response) => {
  const { userId, plans } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "Користувача не знайдено" });

    await user.update({ plans });
    res.json({ success: true, message: "Плани успішно збережено у хмарі ☁️" });
  } catch (error) {
    res.status(500).json({ error: "Не вдалося зберегти плани на сервері" });
  }
});

// 3. ОЧИЩЕННЯ ІСТОРІЇ ЧАТУ
router.post("/clear-history", async (req: express.Request, res: express.Response) => {
  const { userId } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "Користувача не знайдено" });

    await user.update({ chatHistory: [] });
    res.json({ success: true, message: "Історію чату очищено" });
  } catch (error) {
    res.status(500).json({ error: "Не вдалося очистити історію чату" });
  }
});

export default router;