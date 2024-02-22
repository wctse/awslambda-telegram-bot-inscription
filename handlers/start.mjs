import { bot } from '../helpers/bot.mjs';
import { addItemToDynamoDB, checkItemsExistInDynamoDb } from '../helpers/dynamoDB.mjs';
import { handleMainMenu } from './mainMenu.mjs';

export async function handleStart(chatId) {
    const userTable = process.env.USER_TABLE_NAME;
    const processTable = process.env.PROCESS_TABLE_NAME;
    const walletTable = process.env.WALLET_TABLE_NAME;

    const userExists = await checkItemsExistInDynamoDb(userTable, `userId`, chatId );

    if (userExists) {
        const userHasWallet = await checkItemsExistInDynamoDb(walletTable, `userId`, chatId );

        if (userHasWallet) {
            await handleMainMenu(chatId);
            return;
        }

    } else {
        const userItem = {
            userId: chatId,
            lastActiveAt: Date.now(),
            userState: "IDLE", // used to track flows that requires back-and-forth messaging with the user
            userSettings: {}
        };

        const processItem = {
            userId: chatId,
        };
    
        await Promise.all([
            addItemToDynamoDB(userTable, userItem),
            addItemToDynamoDB(processTable, processItem)
        ]);
    }
    
    const keyboard = {
        inline_keyboard: [[
            { text: "🆕 Create wallet", callback_data: "create_wallet" },
            { text: "⚡ Import wallet", callback_data: "import_wallet" }
        ]]
    };
    
    await bot.sendMessage(chatId, "🐉 Welcome to Inscription Dragon, the ultimate bot for inscriptions. Create or import your wallet seamlessly with one click:", { reply_markup: keyboard });
}