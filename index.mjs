import { handleStart } from './handlers/start.mjs';
import { handleCreateWallet } from './handlers/createWallet.mjs';
import { handleMainMenu } from './handlers/mainMenu.mjs';
import { handleViewWallet } from './handlers/viewWallet.mjs';
import { handleInscribe } from './handlers/inscribe.mjs';
import { handleTransfer } from './handlers/transfer.mjs';
import { deleteMessage } from './helpers/botActions.mjs';

export async function handler(event, context) {
    console.info("Received event:", JSON.stringify(event, null, 2));
    const update = JSON.parse(event.body);
    
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text.split()[0].replace('/', '').toLowerCase();

        switch (text) {
            case 'start':
                await handleStart(chatId);
                break;
            default:
                console.info('Unknown message received:', message);
                break;
        }
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        switch (data) {
            case 'create_wallet':
                await handleCreateWallet(chatId);
                break;
            case 'view_wallet':
                await handleViewWallet(chatId);
                break;
            case 'refresh_view_wallet':
                await handleViewWallet(chatId, messageId);
                await deleteMessage(chatId, messageId);
                break;
            case 'main_menu':
                await handleMainMenu(chatId);
                break;
            case 'refresh_main_menu':
                await handleMainMenu(chatId, messageId);
                await deleteMessage(chatId, messageId);
                break;
            case 'inscribe':
                await handleInscribe(chatId);
                break;
            case 'transfer':
                await handleTransfer(chatId);
                break;
            default:
                console.info('Unknown callback query received:', callbackQuery);
                break;
        }
    }

    else {console.info('Unknown update received:', update)}
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
};