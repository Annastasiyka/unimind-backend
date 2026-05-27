import express from "express";
import { User } from "../models/User.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post("/chat", async (req, res) => {
  const { 
    message, userId,  realTime, realDate, 
    allPlans, pastOverdue, workSchedule,
    isAutoOptimize, tasksToSchedule, plansForToday 
  } = req.body;

  try {
    const user = userId ? await User.findByPk(userId) : null;
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const [d, m, y] = realDate.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const dayNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
    const dayOfWeek = dayNames[dateObj.getDay()];

    let prompt = "";
    if (isAutoOptimize) {
      prompt = `
        Ти — системний алгоритм планування розкладу UniMind. Відповідай ТІЛЬКИ валідним JSON.
        Поточний час: ${realTime}, поточна дата: ${realDate} (${dayOfWeek}).
        
        ВХІДНІ ДАНІ:
        1. Зайняті плани (уникай перетинів з ними!): ${JSON.stringify(plansForToday || [])}
        2. Графік роботи: ${JSON.stringify(workSchedule || {})}
        3. Завдання БЕЗ вказаного часу: ${JSON.stringify(tasksToSchedule || [])}
        4. ПРОТЕРМІНОВАНІ завдання: ${JSON.stringify(pastOverdue || [])}
        
        ТВОЯ ЗАДАЧА:
        Взяти КОЖНЕ завдання з масивів (3) і (4), знайти для нього вільний час і призначити нову дату (сьогодні ${realDate} або завтра).
        
        КРИТИЧНІ ПРАВИЛА:
        1. ЗБЕРІГАЙ ОРИГІНАЛЬНІ ID: Ти ПОВИНЕН повернути той самий "id", який має завдання у вхідних даних! Інакше система зламається.
        2. ТРИВАЛІСТЬ: Кожне завдання типу "Навчання" або "Лабораторна" займає 1.5 години (90 хв). Всі інші типи займають 1 годину (60 хв).
        3. БЕЗ ПЕРЕТИНІВ: Додавай тривалість до часу початку. Наступне завдання став ТІЛЬКИ після завершення попереднього у вільне "вікно".
        4. ЛОГІКА ЧАСУ: Не виходь за межі "Графік роботи" і не став час у минулому (раніше ${realTime} сьогодні). Якщо сьогодні місця немає — перенось на завтра.
        
        Поверни JSON строго у цьому форматі:
        {
          "updatedPlans": [
            { 
              "id": "ОРИГІНАЛЬНИЙ_ID_З_ВХІДНОГО_МАСИВУ", 
              "date": "ДД-ММ-РРРР", 
              "time": "15:30", 
              "action": "add_or_update" 
            }
          ]
        }
      `;
    } else {
      prompt = `
        Ти — системний асистент планувальника UniMind. Працюй ТІЛЬКИ в JSON.
        Поточний час: ${realTime}, дата: ${realDate}.
        
        АКТУАЛЬНІ ПЛАНИ: ${JSON.stringify(allPlans || [])}
        
        ПОВІДОМЛЕННЯ КОРИСТУВАЧА: "${message}"

        ПРАВИЛО: Використовуй існуючі ID планів. Для нових - генеруй унікальні ID.

        Твоя поведінка залежить від запиту:
        1. ЯКЩО це розмова (наприклад, "привіт", "як справи", "порадь фільм"): 
           - Будь дружнім та емпатичним у полі "reply".
           - Поле "updatedPlans" має бути ЗАВЖДИ порожнім списком: [].
        
        2. ЯКЩО це запит на ДІЮ з планами (наприклад, "видали", "перенеси", "додай"):
           - У полі "reply" коротко прокоментуй дію.
           - У полі "updatedPlans" поверни масив дій. Приклад:
             [
               { "id": "ID_З_СПИСКУ", "action": "delete" },
               { "id": "ID_З_СПИСКУ", "text": "Оновлений текст", "date": "ДД-ММ-РРРР", "time": "14:00", "action": "add_or_update" },
               { "id": "new-12345", "text": "Нове завдання", "date": "ДД-ММ-РРРР", "time": "15:00", "type": "Навчання", "action": "add_or_update" }
             ]

        ВІДПОВІДАЙ ТІЛЬКИ ВАЛІДНИМ JSON:
        {
          "reply": "Текст твоєї відповіді",
          "updatedPlans": []
        }
      `;
    }

    const result = await model.generateContent(prompt);
    
    // Більш надійний парсинг JSON (відрізаємо markdown і шукаємо межі об'єкта)
    let cleanText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const startIndex = cleanText.indexOf('{');
    const endIndex = cleanText.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
       cleanText = cleanText.substring(startIndex, endIndex + 1);
    }
    
    const aiData = JSON.parse(cleanText);

    let currentPlans = user ? (user.plans || []) : [];

    if (aiData.updatedPlans && Array.isArray(aiData.updatedPlans)) {
      aiData.updatedPlans.forEach((incomingPlan: any) => {
        if (incomingPlan.action === 'delete') {
            currentPlans = currentPlans.filter((p: any) => String(p.id) !== String(incomingPlan.id));
        } else {
            const index = currentPlans.findIndex((p: any) => String(p.id) === String(incomingPlan.id));
            if (index !== -1) {
              currentPlans[index] = { ...currentPlans[index], ...incomingPlan };
            } else {
              currentPlans.push(incomingPlan);
            }
        }
      });
    }

    if (user && !isAutoOptimize) {
        const updatedHistory = [
            ...(user.chatHistory || []), 
            { id: `u-${Date.now()}`, role: "user", text: message }, 
            { id: `a-${Date.now()}`, role: "ai", text: aiData.reply }
        ].slice(-40);
        await user.update({ chatHistory: updatedHistory, plans: currentPlans });
    } else if (user) {
        await user.update({ plans: currentPlans });
    }

    res.json(aiData);
  } catch (error) {
    console.error("Помилка ШІ:", error);
    res.status(500).json({ reply: "ШІ тимчасово в офлайні" });
  }
});

router.post("/save-plans", async (req, res) => {
  const { userId, plans } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "Користувача не знайдено" });
    await user.update({ plans });
    res.json({ success: true, message: "Плани успішно збережено у хмарі ☁️" });
  } catch (error) {
    res.status(500).json({ error: "Не вдалося зберегти плани" });
  }
});

router.post("/clear-history", async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "Користувача не знайдено" });
    await user.update({ chatHistory: [] });
    res.json({ success: true, message: "Історію чату очищено" });
  } catch (error) {
    res.status(500).json({ error: "Не вдалося очистити історію" });
  }
});

export default router;