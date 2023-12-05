import { ethers } from 'ethers';

import { bot } from './bot.mjs';
import { encrypt } from '../helpers/kms.mjs';
import { addItemToDynamoDB, checkPartitionValueExistsInDynamoDb } from '../helpers/dynamoDb.mjs';

export async function handleCreateWallet(chatId) {
    const walletTable = process.env.WALLET_TABLE_NAME;
    const walletExistsForUser = await checkPartitionValueExistsInDynamoDb(walletTable, `userId`, chatId )

    if (walletExistsForUser) {
        console.warn("User `" + chatId + "` already has a wallet but attempted to create a new one.");

        const walletExistsMessage = `⚠️ You already have a wallet. You can view your wallet's address by tapping the button below.`;
        const walletExistsKeyboard = {
            inline_keyboard: [[
                { text: "💰 View wallet", callback_data: "view_wallet" }, // TODO: Implement view wallet handler
                { text: "📃 Main menu", callback_data: "main_menu" }
            ]]
        };

        await bot.sendMessage(chatId, walletExistsMessage, { reply_markup: walletExistsKeyboard });
        return;
    }
    
    await bot.sendMessage(chatId, "⏳ Creating wallet...");
    
    // Generate a new Ethereum wallet
    const wallet = ethers.Wallet.createRandom();
    const publicAddress = wallet.address;
    const privateKey = wallet.privateKey;

    const encryptedPrivateKey = await encrypt(privateKey);

    // DynamoDB user data table item
    const newUserItem = {
        userId: chatId, // Partition key; For Telegram bots, chatId == userId
        publicAddress: publicAddress, // Sort key for flexibility to supporting multiple wallets per user in the future
        chainName: "Ethereum", // TODO: Make this configurable when adding support for other blockchains
        encryptedPrivateKey: encryptedPrivateKey,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
    };

    // Add the user's wallet to DynamoDB
    console.info("Adding new user to DynamoDB:", chatId, publicAddress)
    await addItemToDynamoDB(walletTable, newUserItem);

    // Private key message
    const privateKeyMessage = 
        `⚠️ IMPORTANT: Your private key is confidential. Do not share it with anyone! ⚠️\n` + 
        `If you delete this message, you will not be shown the private key again.\n` +
        `\n` + 
        `Private Key:\n\`${privateKey}\``;

    const publicAddressMessage = 
        `✅ Your new Ethereum wallet has been created.\n` + 
        `\n` + 
        `Address: \`${publicAddress}\``;

    const publicAddressKeyboard = {
            inline_keyboard: [[
                { text: "📃 Main menu", callback_data: "main_menu" }
            ]]
        };

    // TODO: Is there a way to let the user copy the private key without showing it in the chat? Maybe send a file with the private key? Or send a message with a button that copies the private key to the clipboard?
    await bot.sendMessage(chatId, privateKeyMessage,{ parse_mode: "Markdown" });
    await bot.sendMessage(chatId, publicAddressMessage, { parse_mode: "Markdown", reply_markup: publicAddressKeyboard });
}