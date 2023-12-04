import { bot } from './bot.mjs';
import { getCurrentGasPrice } from '../helpers/ethers.mjs';
import { deleteMessage } from '../helpers/botActions.mjs';

export async function handleMainMenu(chatId) {
    const currentGasPrice = await getCurrentGasPrice();

    const mainMenuMessage = 
    `Welcome to the main menu! \n` + 
    `Current gas price: ${currentGasPrice} Gwei\n` +
    `\n` +
    `Choose an option:`;

    const mainMenuKeyboard = {
        inline_keyboard: [
            [
                { text: "✍️ Inscribe", callback_data: "inscribe" },
                { text: "💸 Transfer", callback_data: "transfer" },
                { text: "💰 View Wallet", callback_data: "view_wallet" }
            ],
            [
                { text: "🔄 Refresh", callback_data: "refresh_main_menu" }
            ]
        ]
    };

    await bot.sendMessage(chatId, mainMenuMessage, { reply_markup: mainMenuKeyboard });
}

export async function handleRefreshMainMenu(chatId, oldMessageId) {
    await handleMainMenu(chatId);
    await deleteMessage(chatId, oldMessageId);
}