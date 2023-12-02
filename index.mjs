import { handleStart } from './handlers/start.mjs';
import { handleCreateWallet } from './handlers/createWallet.mjs';
import { handleMainMenu } from './handlers/mainMenu.mjs';
import { handleViewWallet } from './handlers/viewWallet.mjs';

export async function handler(event, context) {
    console.info("Received event:", JSON.stringify(event, null, 2));
    const update = JSON.parse(event.body);
    
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;

        if (message.text) {
            const command = message.text.split()[0].replace('/', '').toLowerCase();

            if (command === 'start') {
                await handleStart(chatId);
            }
        }
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        if (data === 'create_wallet') {
            await handleCreateWallet(chatId);
        }

        else if (data === 'view_wallet') {
            await handleViewWallet(chatId);
        }

        else if (data === 'main_menu') {
            await handleMainMenu(chatId);
        }
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
};