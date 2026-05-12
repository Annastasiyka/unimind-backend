import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Перевіряємо, чи є рядок підключення в .env
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ ПОМИЛКА: DATABASE_URL не знайдено в файлі .env!');
}

export const sequelize = new Sequelize(dbUrl as string, {
  dialect: 'postgres',
  logging: false,
  // Налаштування для роботи з хмарними базами (Supabase/Render)
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // Це дозволить підключитися до Supabase без помилок сертифіката
    }
  }
});

// Перевірка підключення
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Підключення до бази даних Supabase успішно встановлено.');
  } catch (error) {
    console.error('❌ Не вдалося підключитися до бази даних:', error);
  }
};

testConnection();