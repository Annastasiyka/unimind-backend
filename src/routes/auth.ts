import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

const router = express.Router();

router.post('/signup', async (req: any, res: any) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Такий email вже зареєстровано" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      workSchedule: {},
      semesters: [],
      plans: []
    });

    res.status(201).json({ 
      message: "Користувача створено!", 
      user: { 
        id: newUser.id, 
        name: newUser.name,
        email: newUser.email
      } 
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Помилка при реєстрації" });
  }
});


router.post('/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Акаунт з такою поштою не знайдено" });
    }

    const dbPassword = user.getDataValue('password') || user.password;
    if (!dbPassword) {
      return res.status(500).json({ message: "Помилка бази даних: пароль відсутній" });
    }

    const isMatch = await bcrypt.compare(password, dbPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Неправильний пароль" });
    }

    res.json({ 
      message: "Вхід успішний", 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        avatar: user.avatar,
        workSchedule: user.workSchedule,
        semesters: user.semesters, 
        plans: user.plans          
      } 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Помилка сервера при спробі входу" });
  }
});

export default router;