import { balanceCalculationMessage, bot } from '../helpers/bot.mjs';
import { getEthPrice } from '../helpers/coingecko.mjs';
import { getItemsFromDynamoDb } from '../helpers/dynamoDB.mjs';
import { getEthBalance } from '../helpers/ethers.mjs';
import { round } from '../helpers/commonUtils.mjs';
import { getIerc20Balance } from '../helpers/ierc20.mjs';

export async function handleViewWallet(chatId) {
    const walletTable = process.env.WALLET_TABLE_NAME;

    const userItem = await getItemsFromDynamoDb(walletTable, 'userId', chatId); // TODO: When multiple wallets is implemented, this should be changed to get all wallets for a user
    const publicAddress = userItem[0].publicAddress;
    const chainName = userItem[0].chainName;
    const ethBalance = round(await getEthBalance(publicAddress), 6);
    const ethBalanceUsd = round(ethBalance * await getEthPrice(), 2);
    
    const ierc20Balances = await getIerc20Balance(publicAddress);

    let viewWalletMessage = 
        `Wallet information:\n` +
        `\n` +
        `Chain: \`${chainName}\`\n` +
        `Address: \`${publicAddress}\`\n` +
        `ETH Balance: ${ethBalance} ETH (\$${ethBalanceUsd})\n` +
        `\n` +
        `*ierc-20 Balances*\n`;

    for (const[ierc20Ticker, ierc20Balance] of Object.entries(ierc20Balances)) {
        viewWalletMessage += `${ierc20Ticker}: \`${ierc20Balance}\`\n`;
    }

    if (Object.keys(ierc20Balances).length === 0) {
        viewWalletMessage += `None\n`;
    }

    viewWalletMessage = viewWalletMessage.slice(0, -1); // Remove last newline
    viewWalletMessage += balanceCalculationMessage;

    const viewWalletKeyboard = {
        inline_keyboard: [[
            { text: "📃 Main menu", callback_data: "main_menu" },
            { text: "🔄 Refresh", callback_data: "refresh_view_wallet" }
        ]]
    };

    await bot.sendMessage(chatId, viewWalletMessage, { parse_mode: 'Markdown', reply_markup: viewWalletKeyboard });
}