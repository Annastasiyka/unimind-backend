import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error(' DATABASE_URL не знайдено в файлі .env!');
}

export const sequelize = new Sequelize(dbUrl as string, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false 
    }
  }
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log(' Підключення до бази даних Supabase успішно встановлено.');
  } catch (error) {
    console.error(' Не вдалося підключитися до бази даних:', error);
  }
};

testConnection();