import { routeMessage } from './routers/message.mjs';
import { routeCallback } from './routers/callback.mjs';
import { deleteMessage } from './helpers/bot.mjs';
import { deleteAttributesExceptKeys, editItemInDynamoDB, editUserState, getUserState } from './helpers/dynamoDB.mjs';
import { routeInternalEvent } from './routers/internalEvent.mjs';

export async function handler(event, context) {
    console.info("Received event:", JSON.stringify(event, null, 2));
    const update = JSON.parse(event.body);

    const userTable = process.env.USER_TABLE_NAME;
    const processTable = process.env.PROCESS_TABLE_NAME;

    if (update.source) {
        await editItemInDynamoDB(userTable, { userId: update.customData.userId }, { lastActiveAt: Date.now() }, true);
        await routeInternalEvent(update.source, update.message, update.customData);

    } else if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text;
        const userState = await getUserState(chatId);

        await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() }, true);
        await routeMessage(text, userState, chatId);
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() });
        await routeCallback(data, chatId, messageId);

        if (data.includes('refresh')) {
            await deleteMessage(chatId, messageId);
        }

        if (data.includes('cancel')) {
            await editUserState(chatId, 'IDLE');
            await deleteAttributesExceptKeys(processTable, { userId: chatId });
        }
    }

    else {console.info('Unknown update received:', update)}
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
}