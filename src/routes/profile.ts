import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

const router = express.Router();

/**
 * 1. Отримати дані профілю за ID
 * Використовується при завантаженні сторінки для синхронізації
 */
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: { exclude: ['password'] } // Не відправляємо хеш пароля на фронтенд
    });
    
    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Помилка сервера при отриманні профілю" });
  }
});

/**
 * 2. Оновлення графіка роботи
 */
router.post('/update-schedule', async (req: any, res: any) => {
  const { userId, schedule } = req.body;
  
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "Користувача не знайдено" });

    user.workSchedule = schedule;
    await user.save();

    res.json({ 
      message: "Графік успішно збережено в PostgreSQL", 
      schedule: user.workSchedule 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Не вдалося зберегти графік" });
  }
});

/**
 * 3. Оновлення особистих даних (Ім'я та Аватарка)
 */
router.post('/update-info', async (req: any, res: any) => {
  const { userId, name, avatar } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "Користувача не знайдено" });

    if (name) user.name = name;
    if (avatar) user.avatar = avatar; // Тут зберігається Base64 рядок
    
    await user.save();

    res.json({ 
      message: "Дані профілю оновлено", 
      user: { name: user.name, avatar: user.avatar } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Помилка при оновленні даних" });
  }
});

/**
 * 4. Зміна пароля (з перевіркою старого)
 */
router.post('/update-password', async (req: any, res: any) => {
  const { userId, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "Користувача не знайдено" });

    // Перевірка старого пароля
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Неправильний поточний пароль" });

    // Хешування нового пароля
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();

    res.json({ message: "Пароль успішно змінено" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Помилка при зміні пароля" });
  }
});

export default router;