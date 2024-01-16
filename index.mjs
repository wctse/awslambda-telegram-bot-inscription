import { message_router } from './routers/message.mjs';
import { callback_router } from './routers/callback.mjs';
import { deleteMessage } from './helpers/bot.mjs';
import { editItemInDynamoDB, editUserState, getUserState } from './helpers/dynamoDB.mjs';

export async function handler(event, context) {
    console.info("Received event:", JSON.stringify(event, null, 2));
    const update = JSON.parse(event.body);
    const userTable = process.env.USER_TABLE_NAME;
    
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text;
        const userState = await getUserState(chatId);

        await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() }, true);
        await message_router(text, userState, chatId);
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() });
        await callback_router(data, chatId, messageId);

        if (data.includes('refresh')) {
            await deleteMessage(chatId, messageId);
        }

        if (data.includes('cancel')) {
            await editUserState(chatId, 'IDLE');
        }
    }

    else {console.info('Unknown update received:', update)}
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
}