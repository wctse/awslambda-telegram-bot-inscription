import { ethers } from 'ethers';
import { bot, mainMenuKeyboard } from '../../common/bot.mjs';
import { encrypt } from '../../common/kms.mjs';
import { addItemToDynamoDB, checkItemsExistInDb, editItemInDb } from '../../common/db/dbOperations.mjs';
import { editUserState } from '../../common/db/userDb.mjs';
import { chunkArray } from '../../common/utils.mjs';
import config from '../../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work
import { createEvmWallet } from '../../blockchains/evm/common/wallets.mjs';

const userTable = process.env.USER_TABLE_NAME;

/**
 * Create wallet step 1: Prompts the user to select the blockchain
 * 
 * @param {str} chatId 
 */
export async function handleStartCreateWalletInitiate(chatId) {
    const chainNames = config.CHAINS.map(chain => chain.name);
    const chainNameChunks = chunkArray(chainNames, 3);

    const createWalletChainNameMessage = `Which blockchain would you like to create your wallet for?`;
    const createWalletChainNameKeyboard = {
        inline_keyboard: [
            ...chainNameChunks.map(chunk => {
                return chunk.map(chainName => {
                    return {
                        text: chainName,
                        callback_data: `start_create_wallet_chain_${chainName}`
                    };
                });
            }),
            [{ text: "🔙 Back", callback_data: "start" }]
        ]
    };

    await Promise.all([
        bot.sendMessage(chatId, createWalletChainNameMessage, { reply_markup: createWalletChainNameKeyboard }),
        editUserState(chatId, "START_CREATE_WALLET_INITIATED")
    ])
}

/**
 * Create wallet step 2: Handles the chain name input and create the wallet
 * 
 * @param {str} chatId 
 * @param {str} chainName 
 * @returns 
 */
export async function handleStartCreateWalletChainName(chatId, chainName) {
    const walletTable = process.env.WALLET_TABLE_NAME;
    const walletExistsForUser = await checkItemsExistInDb(walletTable, `userId`, chatId );

    if (walletExistsForUser) {
        console.warn("User `" + chatId + "` already has a wallet but attempted to create a new one.");

        const walletExistsMessage = `⚠️ You already have a wallet for ${chainName}. You can view your wallet's address by tapping the button below.`;
        const walletExistsKeyboard = {
            inline_keyboard: [[
                { text: "💰 View wallet", callback_data: "view_wallet" },
                { text: "📃 Main menu", callback_data: "main_menu" }
            ]]
        };

        await bot.sendMessage(chatId, walletExistsMessage, { reply_markup: walletExistsKeyboard });
        return;
    }
    
    await bot.sendMessage(chatId, "⏳ Creating wallet...");
    
    const {publicAddress, privateKey} = await routeCreateWallet(chainName);
    const encryptedPrivateKey = await encrypt(privateKey);

    // DynamoDB wallet data table item
    const newWalletItem = {
        userId: chatId, // Partition key; For Telegram bots, chatId == userId
        publicAddress: publicAddress, // Sort key for flexibility to supporting multiple wallets per user in the future
        chainName: chainName,
        encryptedPrivateKey: encryptedPrivateKey,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        walletSource: "CREATED_IN_BOT",
        walletSettings: {
            gas: "auto"
        }
    };

    // Add the user's wallet to DynamoDB
    console.info("Adding new wallet to DynamoDB:", chatId, publicAddress);

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

    Promise.all([
        (async () => {
            await bot.sendMessage(chatId, privateKeyMessage, { parse_mode: "Markdown" }); // Is there a way to let the user copy the private key without showing it in the chat? Maybe send a file with the private key? Or send a message with a button that copies the private key to the clipboard?
            await bot.sendMessage(chatId, publicAddressMessage, { parse_mode: "Markdown", reply_markup: mainMenuKeyboard });
        })(),
        addItemToDynamoDB(walletTable, newWalletItem),
        editUserState(chatId, "IDLE"),
        editItemInDb(userTable, { userId: chatId }, { currentChain: chainName })
    ]);
}

function routeCreateWallet(chainName) {
    switch (chainName) {
        case "Ethereum":
            return createEvmWallet();

        default:
            return handleStartCreateWalletChainName;
    }
}