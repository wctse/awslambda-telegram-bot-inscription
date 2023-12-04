import { bot } from './bot.mjs';

export async function handleInscribe(chatId) {
    const keyboard = {
        inline_keyboard: [[
            { text: "📃 Main menu", callback_data: "main_menu" }
        ]]
    };
    
    await bot.sendMessage(chatId, "The inscribe function have not been implemented yet.", { reply_markup: keyboard });
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
}