import { bot } from '../helpers/bot.mjs';
import { getCurrentGasPrice } from '../helpers/ethers.mjs';
import { round } from '../helpers/commonUtils.mjs';
import { editItemInDynamoDB, editUserState, getCurrentChain, getWalletAddress } from '../helpers/dynamoDB.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const userTable = process.env.USER_TABLE_NAME;

export async function handleMainMenu(chatId) {
    const chainName = await getCurrentChain(chatId);
    const walletAddress = await getWalletAddress(chatId, chainName);
    const currentGasPrice = round(await getCurrentGasPrice(), 4);

    const mainMenuMessage = 
    `🐉 Welcome to Inscription Dragon, the omnichain bot for inscriptions! \n` + 
    `\n` +
    `Current chain: ${chainName}\n` +
    `Current gas price: ${currentGasPrice} Gwei\n` +
    `\n` +
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
            { text: "🪙 Send ETH", callback_data: "send_eth" },
        ],
        [
            { text: "💰 View Wallet", callback_data: "view_wallet" },
            { text: "⚙️ Settings", callback_data: "settings" },
            { text: "🔄 Refresh", callback_data: "refresh_main_menu" }
        ]
    ];

    const noWalletKeyboard = [
        [
            { text: "🆕 Create wallet", callback_data: "main_menu_create_wallet" },
            { text: "⚡ Import wallet", callback_data: "main_menu_import_wallet" }
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
    await editItemInDynamoDB(userTable, { userId: chatId }, { currentChain: previousChainName });

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
    await editItemInDynamoDB(userTable, { userId: chatId }, { currentChain: nextChainName });

    await handleMainMenu(chatId);
}