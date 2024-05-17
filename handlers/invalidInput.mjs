import { bot, mainMenuKeyboard } from '../common/bot.mjs';

export async function handleInvalidInput(chatId) {
    const invalidInputMessage = "⚠️ I am sorry. I don't understand that. Please try again.";
    await bot.sendMessage(chatId, invalidInputMessage, { reply_markup: mainMenuKeyboard });
}