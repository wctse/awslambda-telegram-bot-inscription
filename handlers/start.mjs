import { bot } from '../common/bot.mjs';
import { addItemToDynamoDB, getItemsFromDb, checkItemsExistInDb } from '../common/db/dbOperations.mjs';
import { editUserState } from '../common/db/userDb.mjs';
import { handleMainMenu } from './mainMenu.mjs';

/**
 * Handles the /start command. If user has a wallet, show the main menu. Otherwise, prompt the user to create or import a wallet.
 * 
 * @param {str} chatId
 */
export async function handleStart(chatId) {
    const userTable = process.env.USER_TABLE_NAME;
    const processTable = process.env.PROCESS_TABLE_NAME;
    const walletTable = process.env.WALLET_TABLE_NAME;

    const userExists = await checkItemsExistInDb(userTable, `userId`, chatId );

    if (userExists) {
        const userWallets = await getItemsFromDb(walletTable, `userId`, chatId);

        // If user has wallets in any chain, show the main menu
        if (userWallets?.length > 0) {
            await handleMainMenu(chatId);
            return;
        }

    } else {
        const userItem = {
            userId: chatId, 
            lastActiveAt: Date.now(),
            userState: "IDLE", // used to track flows that requires back-and-forth messaging with the user
            userSettings: {},
            currentChain: null
        };

        const processItem = {
            userId: chatId,
        };
    
        await Promise.all([
            addItemToDynamoDB(userTable, userItem),
            addItemToDynamoDB(processTable, processItem)
        ]);
    }
    
    const startKeyboard = {
        inline_keyboard: [[
            { text: "🆕 Create wallet", callback_data: "start_create_wallet" },
            { text: "⚡ Import wallet", callback_data: "start_import_wallet" }
        ]]
    };
    
    await Promise.all([
        bot.sendMessage(chatId, "🐉 Welcome to Inscription Dragon, the ultimate bot for inscriptions. Create or import your wallet:", { reply_markup: startKeyboard }),
        editUserState(chatId, "IDLE")
    ]);
}