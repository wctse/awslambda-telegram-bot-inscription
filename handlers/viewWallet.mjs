import { bot } from './bot.mjs';
import { getItemsByPartitionKeyFromDynamoDB } from '../helpers/dynamodb.mjs';
import { getEthBalance } from '../helpers/ethers.mjs';

export async function handleViewWallet(chatId) {
    const userTable = process.env.USERTABLENAME;
    const userItem = await getItemsByPartitionKeyFromDynamoDB(userTable, 'userId', chatId); // TODO: When multiple wallets is implemented, this should be changed to get all wallets for a user

    const publicAddress = userItem[0].publicAddress;
    const chainName = userItem[0].chainName;
    const ethBalance = await getEthBalance(publicAddress);

    const viewWalletMessage = 
        `Wallet information:\n` +
        `\n` +
        `Chain: ${chainName}\n` +
        `Address: \`${publicAddress}\`\n` +
        `ETH Balance: ${ethBalance} ETH`;
        // TODO: Add inscription data by calling API

    const viewWalletKeyboard = {
        inline_keyboard: [[
            { text: "Main menu", callback_data: "main_menu" }
        ]]
    };

    await bot.sendMessage(chatId, viewWalletMessage, { parse_mode: 'Markdown', reply_markup: viewWalletKeyboard });
}