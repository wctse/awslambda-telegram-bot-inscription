import TelegramBot from 'node-telegram-bot-api';
const token = process.env.TOKEN;

export const bot = new TelegramBot(token);

export const balanceCalculationMessage =
    `\n\n` +
    `*=======================*\n` +
    `⚠️ Note: Balances are calculated only from actions in this bot. The balances will be inaccurate if you used this address in other wallets.`;

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

export const mainMenuKeyboard = {
    inline_keyboard: [[
        { text: "📃 Main menu", callback_data: "main_menu" }
    ]]
};

export async function deleteMessage(chatId, messageId) {
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}