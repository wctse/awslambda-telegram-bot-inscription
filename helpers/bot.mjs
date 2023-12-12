import TelegramBot from 'node-telegram-bot-api';
const token = process.env.TOKEN;

export const bot = new TelegramBot(token);

export const cancelMainMenuKeyboard = {
    inline_keyboard: [[
        { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
    ]]
};

export const backToMainMenuKeyboard = {
    inline_keyboard: [[
        { text: "️↩️ Back to Main Menu", callback_data: "main_menu" }
    ]]
};

export async function deleteMessage(chatId, messageId) {
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}