import { routeMessage } from './routers/message.mjs';
import { routeCallback } from './routers/callback.mjs';
import { routeCommand } from './routers/command.mjs';
import { routeInternalEvent } from './routers/internalEvent.mjs';
import { deleteMessage } from './common/bot.mjs';
import { deleteAttributesExceptKeys, editItemInDb } from './common/db/dbOperations.mjs';
import { editUserState, getUserState } from './common/db/userDb.mjs';

export async function handler(event, context) {
    console.info("Received event:", JSON.stringify(event, null, 2));
    const update = JSON.parse(event.body);

    const userTable = process.env.USER_TABLE_NAME;
    const processTable = process.env.PROCESS_TABLE_NAME;

    if (update.source) {
        await Promise.all([
            editItemInDb(userTable, { userId: update.customData.userId }, { lastActiveAt: Date.now() }, true),
            routeInternalEvent(update.source, update.message, update.customData)
        ]);

    } else if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text;
        
        // Decide whether to route as a command or a regular message based on the prefix
        const routingFunction = text.startsWith('/')
            ? routeCommand // If the message starts with "/", use routeCommand
            : routeMessage; // Otherwise, use routeMessage
        
        await Promise.all([
            editItemInDb(userTable, { userId: chatId }, { lastActiveAt: Date.now() }, true),
            routingFunction(chatId, text, await getUserState(chatId))
        ]);
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        let callbackPromises = [
            editItemInDb(userTable, { userId: chatId }, { lastActiveAt: Date.now() }),
        ];

        let routeCallbackPromise = routeCallback(chatId, data, await getUserState(chatId), messageId);

        if (data.includes('refresh')) {
            routeCallbackPromise = routeCallbackPromise.then(() => deleteMessage(chatId, messageId)); // Better UX if delete old message right after new message is sent
        }

        callbackPromises.push(routeCallbackPromise);

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