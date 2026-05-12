import express from 'express';
import { User } from '../models/User.js';

const router = express.Router();

// Головний маршрут для синхронізації всього
router.post('/all', async (req, res) => {
  try {
    const { userId, semesters, plans, workSchedule } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    // Оновлюємо колонки в PostgreSQL (вони мають бути в моделі User.ts)
    if (semesters !== undefined) user.semesters = semesters;
    if (plans !== undefined) user.plans = plans;
    if (workSchedule !== undefined) user.workSchedule = workSchedule;

    await user.save();
    
    res.json({ message: "Дані успішно збережені в базі" });
  } catch (error) {
    console.error("Помилка синхронізації:", error);
    res.status(500).json({ message: "Помилка на сервері" });
  }
});

export default router;