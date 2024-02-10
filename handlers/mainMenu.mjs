import { bot } from '../helpers/bot.mjs';
import { getCurrentGasPrice } from '../helpers/ethers.mjs';
import { round } from '../helpers/commonUtils.mjs';
import { editUserState } from '../helpers/dynamoDB.mjs';

export async function handleMainMenu(chatId) {
    const currentGasPrice = round(await getCurrentGasPrice(), 4);

    const mainMenuMessage = 
    `Welcome to 1bot, the ultimate bot for inscriptions! \n` + 
    `Current gas price: ${currentGasPrice} Gwei\n` +
    `\n` +
    `Choose an option:`;

    const mainMenuKeyboard = {
        inline_keyboard: [
            [
                { text: "✍️ Mint", callback_data: "mint" },
                { text: "📚 Multi-mint", callback_data: "multi_mint"}
            ],
            [
                { text: "💸 Transfer", callback_data: "transfer" },
                { text: "📝 Custom data", callback_data: "custom_data"}
            ],
            [
                { text: "🪙 Send ETH", callback_data: "send_eth" },
            ],
            [
                { text: "💰 View Wallet", callback_data: "view_wallet" },
                { text: "⚙️ Settings", callback_data: "settings" },
                { text: "🔄 Refresh", callback_data: "refresh_main_menu" }
            ]
        ]
    };

    await editUserState(chatId, "IDLE");
    await bot.sendMessage(chatId, mainMenuMessage, { reply_markup: mainMenuKeyboard });
}