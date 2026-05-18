import express from 'express';
import { User } from '../models/User.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post('/chat', async (req: any, res: any) => {
  const { message, userId, workSchedule, realTime, realDate } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ reply: "Користувача не знайдено 👤" });

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const recentHistory = user.chatHistory ? user.chatHistory.slice(-5) : [];

    const prompt = `
      Ти - інтелектуальний ментор UniMind. Твій стиль: лаконічність, конкретика, проактивність.
      СЬОГОДНІ: ${realDate}, ЧАС: ${realTime}.

      ДАНІ:
      - КАЛЕНДАР (вже зайнято або завдання без часу): ${JSON.stringify(user.plans || [])}.
      - СЕМЕСТРИ (дедлайни/завдання, які ТРЕБА внести): ${JSON.stringify(user.semesters || [])}.
      - РОБОЧІ ГОДИНИ (коли можна планувати): ${JSON.stringify(workSchedule || {})}.
      - КОНТЕКСТ ДІАЛОГУ: ${JSON.stringify(recentHistory)}.

      ТВОЯ МІСІЯ (ПРОАКТИВНЕ ПЛАНУВАННЯ):
      1. АВТО-ПЛАНУВАННЯ: Якщо користувач просить план, або якщо в "КАЛЕНДАРІ" є завдання БЕЗ часу (поле time порожнє), ти МАЄШ САМОСТІЙНО призначити їм вільний час сьогодні. Не питай дозволу — пропонуй готовий графік.
      2. БІОЛОГІЧНІ ПОТРЕБИ: Обов'язково вписуй прийоми їжі (Wellness), якщо їх ще немає в планах на сьогодні:
         - Сніданок (08:00-09:00), Обід (13:00-14:30), Вечеря (18:30-20:00).
      3. ПРАВИЛА ВІЛЬНИХ ВІКОН:
         - НЕ плануй на час, який вже зайнятий у Календарі конкретною справою з часом.
         - Між завданнями залишай 10-15 хв перерви.
      4. СТИЛЬ: Без води. Не вживай багато "Привіт", "Я радий допомогти". Одразу до справи. Структура: "Я додав [назва] на [час], бо [причина]".
      5. АНТИ-ПОВТОР: Не пропонуй стратегію, якщо вона вже обговорювалася. Просто давай оновлений список завдань.

      ПРАВИЛА ВІДПОВІДІ (JSON):
      {
        "reply": "Текст (коротко, структуровано списком)",
        "options": ["Підтверджую", "Зміни час для їжі", "Давай іншу стратегію"],
        "newPlans": [
          { 
            "id": "ai-${Date.now()}", 
            "text": "Назва справи", 
            "time": "HH:mm", 
            "date": "${realDate}", 
            "type": "Wellness / Навчання / Особисте" 
          }
        ]
      }
      *newPlans заповнюй щоразу, коли призначаєш час для справи або додаєш їжу.*

      ЗАПИТ: "${message}"
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().replace(/```json|```/g, "").trim();
    
    let aiData;
    try {
      aiData = JSON.parse(responseText);
    } catch (e) {
      console.error("JSON Error:", responseText);
      return res.status(500).json({ reply: "Помилка форматування ШІ 🧠" });
    }

    const userMsg = { id: `u-${Date.now()}`, role: "user", text: message };
    const aiMsg = { id: `a-${Date.now()}`, role: "ai", text: aiData.reply, options: aiData.options };

    const updatedHistory = [...(user.chatHistory || []), userMsg, aiMsg].slice(-50);
    let updatedPlans = user.plans || [];
    
    if (aiData.newPlans && aiData.newPlans.length > 0) {
      updatedPlans = [...updatedPlans, ...aiData.newPlans];
    }

    await user.update({
      chatHistory: updatedHistory,
      plans: updatedPlans
    });

    res.json(aiData);

  } catch (error) {
    console.error("AI Route Error:", error);
    res.status(500).json({ reply: "ШІ тимчасово недоступний 🔌", options: [] });
  }
});

export default router;