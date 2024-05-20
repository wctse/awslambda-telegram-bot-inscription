import { bot } from '../common/bot.mjs';
import { getCurrentGasPrice, getUnits } from '../services/processServices.mjs';
import { editItemInDb } from '../common/db/dbOperations.mjs';
import { getWalletAddress } from '../common/db/walletDb.mjs';
import { editUserState, getCurrentChain } from '../common/db/userDb.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const userTable = process.env.USER_TABLE_NAME;

export async function handleMainMenu(chatId) {
    const chainName = await getCurrentChain(chatId);

    const [walletAddress, gasPrice, [assetName, gasUnitName]] = await Promise.all([
        getWalletAddress(chatId, chainName),
        getCurrentGasPrice(chainName, 0),
        getUnits(chainName)
    ]);

    let mainMenuMessage = 
        `🐉 Welcome to Inscription Dragon, the omnichain bot for inscriptions. \n` + 
        `\n` +
        `Current chain: ${chainName}\n`

    // If the blockchain has floating gas prices, show the current gas price
    if (gasPrice) {
        mainMenuMessage += `Current gas price: ${gasPrice} ${gasUnitName}\n`;
    }

    mainMenuMessage += `\n` +
        `Choose an option:`;

    const mainMenuKeyboard = {
        inline_keyboard: [
            [
                { text: "<<", callback_data: `refresh_wallet_backward_from_${chainName}` },
                { text: `${chainName}`, callback_data: "no_action" },
                { text: ">>", callback_data: `refresh_wallet_forward_from_${chainName}` }
            ]
        ]
    };

    const hasWalletKeyboard = [
        [
            { text: "✍️ Mint", callback_data: "mint" },
            { text: "📚 Multi-mint", callback_data: "multi_mint"}
        ],
        [
            { text: "💸 Transfer", callback_data: "transfer" },
            { text: "📝 Custom data", callback_data: "custom_data"}
        ],
        [
            { text: `🪙 Send ${assetName}`, callback_data: "send_asset" },
        ],
        [
            { text: "💰 View Wallet", callback_data: "view_wallet" },
            { text: "⚙️ Settings", callback_data: "settings" },
            { text: "🔄 Refresh", callback_data: "refresh_main_menu" }
        ]
    ];

    const noWalletKeyboard = [
        [
            { text: "🆕 Create wallet", callback_data: `main_menu_create_wallet_${chainName}` },
            { text: "⚡ Import wallet", callback_data: `main_menu_import_wallet_${chainName}` }
        ]
    ];

    if (walletAddress) {
        mainMenuKeyboard.inline_keyboard.push(...hasWalletKeyboard);
    } else {
        mainMenuKeyboard.inline_keyboard.push(...noWalletKeyboard);
    }

    await editUserState(chatId, "IDLE");
    await bot.sendMessage(chatId, mainMenuMessage, { reply_markup: mainMenuKeyboard });
}

export async function mainMenuWalletBackward(chatId, currentChainName) {
    const chainNames = config.CHAINS.map(chain => chain.name);
    const currentChainIndex = chainNames.indexOf(currentChainName);

    let previousChainIndex = currentChainIndex - 1;
    if (previousChainIndex < 0) {
        previousChainIndex = chainNames.length - 1;
    }

    const previousChainName = chainNames[previousChainIndex];
    await editItemInDb(userTable, { userId: chatId }, { currentChain: previousChainName });

    await handleMainMenu(chatId);
}

export async function mainMenuWalletForward(chatId, currentChainName) {
    const chainNames = config.CHAINS.map(chain => chain.name);
    const currentChainIndex = chainNames.indexOf(currentChainName);

    let nextChainIndex = currentChainIndex + 1;
    if (nextChainIndex >= chainNames.length) {
        nextChainIndex = 0;
    }

    const nextChainName = chainNames[nextChainIndex];
    await editItemInDb(userTable, { userId: chatId }, { currentChain: nextChainName });

    await handleMainMenu(chatId);
}