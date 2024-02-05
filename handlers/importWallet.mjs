import { ethers } from 'ethers';

import { bot } from '../helpers/bot.mjs';
import { encrypt } from '../helpers/kms.mjs';
import { addItemToDynamoDB, checkPartitionValueExistsInDynamoDB, editUserState } from '../helpers/dynamoDB.mjs';

const walletTable = process.env.WALLET_TABLE_NAME;

/**
 * Import wallet step 1: Prompts the user for private key
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleImportWalletInitiate(chatId) {
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

    const importWalletKeyMessage = 
        `🔑 Please enter your private key below.` + '\n' +
        '\n' +
        `⚠️ Only import private keys with a small amount of funds! We will encrypt your private key in all storages.`;
    
    await bot.sendMessage(chatId, importWalletKeyMessage);
    await editUserState(chatId, "IMPORT_WALLET_INITIATED");
}

/**
 * Import wallet step 2: Handles the user input for private key
 * 
 * @param {number} chatId 
 * @param {str} privateKey 
 */
export async function handleImportWalletKeyInput(chatId, privateKey) {
    // Custom validation rather than isHexString() for private key to cater for the case of having no 0x prefix
    if ((privateKey.length !== 64 && privateKey.length !== 66) || !privateKey.match(/^[0-9a-fx]+$/)) {
        const importWalletInvalidKeyMessage = `⚠️ Invalid private key. Please try again or go back to the previous page.`;
        const importWalletInvalidKeyKeyboard = {
            inline_keyboard: [[
                { text: "🔙 Back", callback_data: "start" }
            ]]
        };

        await bot.sendMessage(chatId, importWalletInvalidKeyMessage, { reply_markup: importWalletInvalidKeyKeyboard });
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
        walletSettings: {
            gas: "auto"
        }
    };

    // Add the user's wallet to DynamoDB
    console.info("Adding new wallet to DynamoDB:", chatId, publicAddress);
    await addItemToDynamoDB(walletTable, newWalletItem);

    const importWalletSuccessMessage = `✅ Your Ethereum wallet has been imported: \`${publicAddress}\``;
    const importWalletSuccessKeyboard = {
        inline_keyboard: [[
            { text: "💰 View wallet", callback_data: "view_wallet" },
            { text: "📃 Main menu", callback_data: "main_menu" }
        ]]
    };

    await bot.sendMessage(chatId, importWalletSuccessMessage, { reply_markup: importWalletSuccessKeyboard, parse_mode: "Markdown" });
    editUserState(chatId, "IDLE");
}