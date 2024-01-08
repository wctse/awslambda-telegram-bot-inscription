import { ethers } from 'ethers';

import { bot, mainMenuKeyboard } from '../helpers/bot.mjs';
import { encrypt } from '../helpers/kms.mjs';
import { addItemToDynamoDB, checkPartitionValueExistsInDynamoDB, editUserState } from '../helpers/dynamoDB.mjs';

const walletTable = process.env.WALLET_TABLE_NAME;

export async function handleImportWalletStep1(chatId) {
    const walletExistsForUser = await checkPartitionValueExistsInDynamoDB(walletTable, `userId`, chatId );

    if (walletExistsForUser) {
        console.warn("User `" + chatId + "` already has a wallet but attempted to create a new one.");

        const walletExistsMessage = `⚠️ You already have a wallet. You can view your wallet's address by tapping the button below.`;
        const walletExistsKeyboard = {
            inline_keyboard: [[
                { text: "💰 View wallet", callback_data: "view_wallet" },
                { text: "📃 Main menu", callback_data: "main_menu" }
            ]]
        };

        await bot.sendMessage(chatId, walletExistsMessage, { reply_markup: walletExistsKeyboard });
        return;
    }

    const importWalletStep1Message = 
        `🔑 Please enter your private key below.` + '\n' +
        '\n' +
        `⚠️ Only import private keys with a small amount of funds! We will encrypt your private key in all storages.`;
    
    await bot.sendMessage(chatId, importWalletStep1Message);
    await editUserState(chatId, "IMPORT_WALLET_STEP1");
}

export async function handleImportWalletStep2(chatId, privateKey) {
    // If the private key is not 64 or 66 characters long, and not (text.match(/^[0-9a-fx]+$/)
    if ((privateKey.length !== 64 && privateKey.length !== 66) || !privateKey.match(/^[0-9a-fx]+$/)) {
        const invalidPrivateKeyMessage = `⚠️ Invalid private key. Please try again or go back to the previous page.`;
        const invalidPrivateKeyButton = {
            inline_keyboard: [[
                { text: "🔙 Back", callback_data: "start" }
            ]]
        };

        await bot.sendMessage(chatId, invalidPrivateKeyMessage, { reply_markup: invalidPrivateKeyButton });
        return;
    }
    
    const wallet = new ethers.Wallet(privateKey);
    const publicAddress = wallet.address;

    const encryptedPrivateKey = await encrypt(privateKey);

    // DynamoDB wallet data table item
    const newWalletItem = {
        userId: chatId, // Partition key; For Telegram bots, chatId == userId
        publicAddress: publicAddress, // Sort key for flexibility to supporting multiple wallets per user in the future
        chainName: "Ethereum", // TODO: Make this configurable when adding support for other blockchains
        encryptedPrivateKey: encryptedPrivateKey,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
    };

    // Add the user's wallet to DynamoDB
    console.info("Adding new wallet to DynamoDB:", chatId, publicAddress);
    await addItemToDynamoDB(walletTable, newWalletItem);

    await bot.sendMessage(chatId, `✅ Your Ethereum wallet has been imported: \`${publicAddress}\``, { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard }, );
    editUserState(chatId, "IDLE");
}