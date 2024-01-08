import { bot } from '../helpers/bot.mjs';
import { addItemToDynamoDB, checkPartitionValueExistsInDynamoDB } from '../helpers/dynamoDB.mjs';
import { handleMainMenu } from './mainMenu.mjs';

export async function handleStart(chatId) {
    const userTable = process.env.USER_TABLE_NAME;
    const userExists = await checkPartitionValueExistsInDynamoDB(userTable, `userId`, chatId );

    // if (userExists) {
    //     await handleMainMenu(chatId);
    //     return;
    // } else {
    //     const userItem = {
    //         userId: chatId,
    //         lastActiveAt: Date.now(),
    //         userState: "IDLE" // used to track flows that requires back-and-forth messaging with the user
    //     };
    
    //     await addItemToDynamoDB(userTable, userItem);
    // }
    
    const keyboard = {
        inline_keyboard: [[
            { text: "🆕 Create wallet", callback_data: "create_wallet" },
            { text: "⚡ Import wallet", callback_data: "import_wallet" }
        ]]
    };
    
    await bot.sendMessage(chatId, "Welcome to 1Bot, the ultimate bot for inscriptions. Create your wallet seamless with one click:", { reply_markup: keyboard });
}