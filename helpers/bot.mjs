import TelegramBot from 'node-telegram-bot-api';
const token = process.env.TOKEN;

export const bot = new TelegramBot(token);

export async function deleteMessage(chatId, messageId) {
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}