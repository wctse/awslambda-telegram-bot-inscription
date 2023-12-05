import { bot } from './bot.mjs';
import { addItemToDynamoDB, checkPartitionValueExistsInDynamoDB } from '../helpers/dynamoDB.mjs';
import { handleMainMenu } from './mainMenu.mjs';

export async function handleStart(chatId) {
    const userTable = process.env.USER_TABLE_NAME;
    const userExists = await checkPartitionValueExistsInDynamoDB(userTable, `userId`, chatId );

    if (userExists) {
        await handleMainMenu(chatId);
        return;
    } else {
        const userItem = {
            userId: chatId,
            lastActiveAt: Date.now(),
            userState: "IDLE" // used to track flows that requires back-and-forth messaging with the user
        };
    
        await addItemToDynamoDB(userTable, userItem);
    }
    
    const keyboard = {
        inline_keyboard: [[
            { text: "🆕 Create wallet", callback_data: "create_wallet" }
        ]]
    };
    
    await bot.sendMessage(chatId, "Hello! This is the start command.", { reply_markup: keyboard });
}