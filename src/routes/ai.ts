import express from "express";
import { User } from "../models/User.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post("/chat", async (req, res) => {
  const { 
    message, userId, workSchedule, realTime, realDate, 
    allPlans, pastOverdue,
    isAutoOptimize, tasksToSchedule, plansForToday 
  } = req.body;

  try {
    const user = userId ? await User.findByPk(userId) : null;
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    let prompt = "";

    if (isAutoOptimize) {
      prompt = `
        Ти - системний скрипт оптимізації. Працюй ТІЛЬКИ в JSON.
        ПОТОЧНА ДАТА: ${realDate}, ЧАС: ${realTime}.
        
        ЩО ТРЕБА ЗРОБИТИ:
        1. Розподіли завдання без часу: ${JSON.stringify(tasksToSchedule || [])}.
        2. Розподіли протерміновані справи: ${JSON.stringify(pastOverdue || [])}.
        3. Зайняті години: ${JSON.stringify(plansForToday || [])}.
        
        Поверни список { "updatedPlans": [...] }.
      `;
    } else {
      prompt = `
        Ти — дружній, емпатичний асистент UniMind. 
        Поточний час: ${realTime}, дата: ${realDate}.
        АКТУАЛЬНІ ПЛАНИ: ${JSON.stringify(allPlans || [])}
        ПРАВИЛО: Використовуй існуючі ID. Для нових - генеруй ID. 

        Твоя поведінка:
        1. ЯКЩО це розмова ("привіт", "як справи", "порадь фільм"): 
           - Відповідай дружньо в полі "reply".
           - Поле "updatedPlans" має бути ЗАВЖДИ порожнім списком: [].
        
        2. ЯКЩО це запит на ДІЮ ("видали", "перенеси", "додай"):
           - Ти ПОВИНЕН знайти ціль у списку АКТУАЛЬНИХ ПЛАНІВ.
           - Для видалення: поверни {"id": "ID_З_СПИСКУ", "action": "delete"}.
           - Для перенесення: знайди об'єкт, зміни час/дату, поверни його з тим самим ID та {"action": "add_or_update"}.
           - Для додавання: створи новий об'єкт з новим ID ("new-" + Date.now()) та {"action": "add_or_update"}.
        
        ВІДПОВІДАЙ ТІЛЬКИ ВАЛІДНИМ JSON ОБ'ЄКТОМ:
        {
          "reply": "Твоя відповідь користувачу",
          "updatedPlans": []
        }
      `;
    }

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().replace(/[\s\S]*?({[\s\S]*})[\s\S]*/, "$1");
    const aiData = JSON.parse(rawText);

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