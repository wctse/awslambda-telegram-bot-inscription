import { bot } from './bot.mjs';

export async function handleStart(chatId) {
    const keyboard = {
        inline_keyboard: [[
            { text: "🆕 Create wallet", callback_data: "create_wallet" }
        ]]
    };
    
    await bot.sendMessage(chatId, "Hello! This is the start command.", { reply_markup: keyboard });
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
}