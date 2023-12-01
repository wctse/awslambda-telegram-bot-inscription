import { handleStart } from './handlers/start.mjs';
import { handleCreateWallet } from './handlers/createWallet.mjs';

export async function handler(event, context) {
    console.log("Received event:", JSON.stringify(event, null, 2));
    
    const update = JSON.parse(event.body);
    
    // rm in prod
    console.log("Event body:", JSON.stringify(update, null, 2));
    
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;

        if (message.text) {
            const command = message.text.split()[0].replace('/', '').toLowerCase();

            if (command === 'start') {
                await handleStart(message, chatId);
            }
        }
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        if (data === 'create_wallet') {
            await handleCreateWallet(chatId, messageId);
        }
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
};