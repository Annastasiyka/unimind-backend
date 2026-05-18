import express from 'express';
import { User } from '../models/User.js';

const router = express.Router();

router.post('/chat', async (req: any, res: any) => {
  const { message, userId, workSchedule } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ reply: "Користувача не знайдено 👤" });

    const userPlans = user.plans || [];
    let aiReply = "Я отримав твій запит! Давай щось заплануємо.";
    let newPlan = null;

    const lowerMsg = message.toLowerCase();
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;

    if (lowerMsg.includes("привіт")) {
      aiReply = "Привіт! Я UniMind AI. Твій особистий помічник. Чим сьогодні займемося? ✨";
    } 
    else if (lowerMsg.includes("лаба") || lowerMsg.includes("план") || lowerMsg.includes("додай")) {
      aiReply = "Зрозумів! Додаю завдання у твій розклад на сьогодні. Сподіваюся, ти встигнеш відпочити! ☕";
      
      // Створюємо план з унікальним ID, щоб уникнути помилки Key у React
      newPlan = {
        id: `ai-${Date.now()}`,
        text: message.replace(/додай|план|заплануй/gi, "").trim() || "Важливе завдання",
        completed: false,
        date: dateStr,
        time: "14:00", // Тут в ідеалі AI має шукати вікно в workSchedule
        type: lowerMsg.includes("лаба") ? "Лабораторна" : "Навчання"
      };

      // Оновлюємо базу даних
      user.plans = [...userPlans, newPlan];
      await user.save();
    } else {
      aiReply = "Цікава думка! Поки що я вчуся планувати складні речі, але вже можу додати просте завдання, якщо напишеш 'Додай лабу'.";
    }

    res.json({ reply: aiReply, newPlan });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ reply: "Упс! Мої нейронні мережі трохи заплуталися. Спробуй ще раз пізніше. 🤖" });
  }
});

export default router;