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
        await Promise.all([
            editItemInDynamoDB(userTable, { userId: update.customData.userId }, { lastActiveAt: Date.now() }, true),
            routeInternalEvent(update.source, update.message, update.customData)
        ]);

    } else if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text;
        const userState = await getUserState(chatId);

        await Promise.all([
            editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() }, true),
            routeMessage(text, userState, chatId)
        ]);
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        let callbackPromises = [
            editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() }),
            routeCallback(data, chatId, messageId)
        ];

        if (data.includes('refresh')) {
            callbackPromises.push(deleteMessage(chatId, messageId));
        }

        if (data.includes('cancel')) {
            callbackPromises.push(editUserState(chatId, 'IDLE'));
            callbackPromises.push(deleteAttributesExceptKeys(processTable, { userId: chatId }));
        }

        await Promise.all(callbackPromises);
    }

    else {console.info('Unknown update received:', update)}
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
}