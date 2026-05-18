import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  options?: string[];
}

export class User extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare password: string;
  declare avatar: string | null;
  declare workSchedule: any; 
  declare semesters: any; 
  declare plans: any; 
  declare chatHistory: ChatMessage[]; 
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
    type: DataTypes.TEXT, 
    allowNull: true,
  },
  workSchedule: {
    type: DataTypes.JSONB, 
    defaultValue: {},
  },
  semesters: {
    type: DataTypes.JSONB, 
    defaultValue: [],
  },
  plans: {
    type: DataTypes.JSONB, 
    defaultValue: [],
  },
  chatHistory: {
    type: DataTypes.JSONB,
    defaultValue: [],
  }
}, {
  sequelize,
  modelName: 'User',
});