import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class User extends Model {
  // Використовуємо declare, щоб TypeScript не перекривав логіку Sequelize
  declare id: number;
  declare name: string;
  declare email: string;
  declare password: string;
  declare avatar: string | null;
  declare workSchedule: any; 
  declare semesters: any; // Масив для семестрів та предметів
  declare plans: any;     // Масив для планів користувача
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  avatar: {
    type: DataTypes.TEXT, // Для зберігання base64 рядка зображення
    allowNull: true,
  },
  workSchedule: {
    type: DataTypes.JSONB, // Зберігає об'єкт з графіком (дні та години)
    defaultValue: {},
  },
  semesters: {
    type: DataTypes.JSONB, // Зберігає повну структуру семестрів та їхніх предметів
    defaultValue: [],
  },
  plans: {
    type: DataTypes.JSONB, // Зберігає всі плани та завдання користувача
    defaultValue: [],
  }
}, {
  sequelize,
  modelName: 'User',
});