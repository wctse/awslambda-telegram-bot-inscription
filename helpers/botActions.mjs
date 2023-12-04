import { bot } from '../handlers/bot.mjs';

export async function deleteMessage(chatId, messageId) {
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}