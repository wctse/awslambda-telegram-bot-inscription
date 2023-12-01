import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TOKEN;
export const bot = new TelegramBot(token);