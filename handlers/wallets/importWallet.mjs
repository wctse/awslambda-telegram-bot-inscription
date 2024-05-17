import { ethers } from 'ethers';
import { bot } from '../../common/bot.mjs';
import { encrypt } from '../../common/kms.mjs';
import { addItemToDynamoDB, checkItemsExistInDb } from '../../common/db/dbOperations.mjs';
import { getWalletAddress } from '../../common/db/walletDb.mjs';
import { editUserState } from '../../common/db/userDb.mjs';
import { getItemFromDb, editItemInDb } from '../../common/db/dbOperations.mjs';
import { chunkArray } from '../../common/utils.mjs';
import config from '../../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work
import { getEvmAddressFromPrivateKey, validateEvmPrivateKey } from '../../blockchains/evm/common/wallets.mjs';

const userTable = process.env.USER_TABLE_NAME;
const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;

/**
 * Import wallet step 1: Prompts the user to select the blockchain
 * 
 * @param {number} chatId Telegram user ID
 */

export async function handleImportWalletInitiate(chatId) {
    const chainNames = config.CHAINS.map(chain => chain.name);
    const chainNameChunks = chunkArray(chainNames, 3);

    const importWalletChainNameMessage = `Which blockchain would you like to import your wallet for?`;
    const importWalletChainNameKeyboard = {
        inline_keyboard: [
            ...chainNameChunks.map(chunk => {
                return chunk.map(chainName => {
                    return {
                        text: chainName,
                        callback_data: `start_import_wallet_chain_${chainName}`
                    };
                });
            }),
            [{ text: "🔙 Back", callback_data: "start" }]
        ]
    };

    await Promise.all([
        bot.sendMessage(chatId, importWalletChainNameMessage, { reply_markup: importWalletChainNameKeyboard }),
        editUserState(chatId, "START_IMPORT_WALLET_INITIATED")
    ])
}


/**
 * Import wallet step 2: Prompts the user for private key
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleImportWalletChainName(chatId, chainName) {
    const chainWalletAddress = await getWalletAddress(chatId, chainName)

    if (chainWalletAddress) {
        const walletExistsMessage = `⚠️ You already have a wallet on ${chainName}. You can view your wallet's address with the View wallet button.`;
        const walletExistsKeyboard = {
            inline_keyboard: [[
                { text: "🔙 Back", callback_data: "start" },
                { text: "💰 View wallet", callback_data: "view_wallet" },
                { text: "📃 Main menu", callback_data: "main_menu" }
            ]]
        };

        await bot.sendMessage(chatId, walletExistsMessage, { reply_markup: walletExistsKeyboard });
        return;
    }

    const importWalletKeyMessage = 
        `🔑 You are importing your wallet for \`${chainName}\`. Please enter your private key below.` + '\n' +
        '\n' +
        `⚠️ We will encrypt your private key in all storages, but still only import private keys with a small amount of funds!`;

    const importWalletKeyKeyboard = {
        inline_keyboard: [[
            { text: "🔙 Back", callback_data: "start" }
        ]]
    }
    
    await Promise.all([
        editItemInDb(processTable, { userId: chatId } , { startImportWalletChainName: chainName }),
        bot.sendMessage(chatId, importWalletKeyMessage, { reply_markup: importWalletKeyKeyboard, parse_mode: "Markdown" }),
        editUserState(chatId, "START_IMPORT_WALLET_CHAIN_NAME_INPUT"),
    ])
}

/**
 * Import wallet step 3: Handles the user input for private key
 * 
 * @param {number} chatId 
 * @param {str} privateKey 
 */
export async function handleImportWalletKeyInput(chatId, privateKey) {
    const chainName = (await getItemFromDb(processTable, { userId: chatId })).startImportWalletChainName;
    
    if (!validatePrivateKey(chainName, privateKey)) {
        const importWalletInvalidKeyMessage = `⚠️ Invalid private key. Please try again or go back to the starting page.`;
        const importWalletInvalidKeyKeyboard = {
            inline_keyboard: [[
                { text: "🔙 Back", callback_data: "start" }
            ]]
        };

        await bot.sendMessage(chatId, importWalletInvalidKeyMessage, { reply_markup: importWalletInvalidKeyKeyboard });
        return;
    }
    
    const publicAddress = getAddressFromPrivateKey(chainName, privateKey);

    // Check if the wallet is already imported by another user
    const walletExists = await checkItemsExistInDb(walletTable, `publicAddress`, publicAddress, null, null, "publicAddress-index");

    if (walletExists) {
        const walletExistsMessage = `⚠️ This wallet is already imported by you or another user. Please use a different wallet.`;
        const walletExistsKeyboard = {
            inline_keyboard: [[
                { text: "🔙 Back", callback_data: "start" }
            ]]
        };

        await bot.sendMessage(chatId, walletExistsMessage, { reply_markup: walletExistsKeyboard });
        return;
    }

    const encryptedPrivateKey = await encrypt(privateKey);

    // DynamoDB wallet data table item
    const newWalletItem = {
        userId: chatId, // Partition key; For Telegram bots, chatId == userId
        publicAddress: publicAddress, // Sort key for flexibility to supporting multiple wallets per user in the future
        chainName: chainName,
        encryptedPrivateKey: encryptedPrivateKey,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        walletSource: "IMPORTED_BY_USER",
        walletSettings: {
            gas: "auto"
        }
    };

    // Add the user's wallet to DynamoDB
    console.info("Adding new wallet to DynamoDB:", chatId, publicAddress);

    const importWalletSuccessMessage = `✅ Your Ethereum wallet has been imported: \`${publicAddress}\``;
    const importWalletSuccessKeyboard = {
        inline_keyboard: [[
            { text: "💰 View wallet", callback_data: "view_wallet" },
            { text: "📃 Main menu", callback_data: "main_menu" }
        ]]
    };

    await Promise.all([
        bot.sendMessage(chatId, importWalletSuccessMessage, { reply_markup: importWalletSuccessKeyboard, parse_mode: "Markdown" }),
        addItemToDynamoDB(walletTable, newWalletItem),
        editUserState(chatId, "IDLE"),
        editItemInDb(userTable, { userId: chatId }, { currentChain: chainName })
    ]);
}

function validatePrivateKey(chainName, privateKey) {
    switch (chainName) {
        case "Ethereum":
            return validateEvmPrivateKey(privateKey);

        default:
            throw new Error(`validatePrivateKey: Chain ${chainName} not supported`);
    }
}

function getAddressFromPrivateKey(chainName, privateKey) {
    switch (chainName) {
        case "Ethereum":
            return getEvmAddressFromPrivateKey(privateKey);

        default:
            throw new Error(`getAddressFromPrivateKey: Chain ${chainName} not supported`);
    }
}