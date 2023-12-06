import { handleStart } from './handlers/start.mjs';
import { handleCreateWallet } from './handlers/createWallet.mjs';
import { handleMainMenu } from './handlers/mainMenu.mjs';
import { handleViewWallet } from './handlers/viewWallet.mjs';
import { handleInscribeStep1, handleInscribeStep2, handleInscribeStep3, handleInscribeStep4, handleInscribeStep5 } from './handlers/inscribe.mjs';
import { handleTransfer } from './handlers/transfer.mjs';

import { deleteMessage } from './helpers/bot.mjs';
import { editItemInDynamoDB, getUserState } from './helpers/dynamoDB.mjs';

export async function handler(event, context) {
    console.info("Received event:", JSON.stringify(event, null, 2));
    const update = JSON.parse(event.body);
    const userTable = process.env.USER_TABLE_NAME;
    
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text
        const userState = await getUserState(chatId);

        await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() });

        if (text === '/start') {
            await handleStart(chatId);

        } else if (text.startsWith('data:') && userState === 'INSCRIBE_STEP1') {
            await handleInscribeStep4(chatId, text);

        } else {
            console.info('Unknown message received:', message);

        }
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() });

        switch (data) {
            case 'create_wallet':
                await handleCreateWallet(chatId);
                break;
            case 'view_wallet':
                await handleViewWallet(chatId);
                break;
            case 'refresh_view_wallet':
                await handleViewWallet(chatId);
                break;
            case 'main_menu':
                await handleMainMenu(chatId);
                break;
            case 'refresh_main_menu':
                await handleMainMenu(chatId);
                break;
            case 'inscribe':
                await handleInscribeStep1(chatId);
                break;
            case 'inscribe_step1_erc20':
                await handleInscribeStep2(chatId, 'erc-20');
                break;
            case 'inscribe_step1_ierc20':
                await handleInscribeStep2(chatId, 'ierc-20');
                break;
            case 'transfer':
                await handleTransfer(chatId);
                break;
            default:
                console.info('Unknown callback query received:', callbackQuery);
                break;
        }

        if (data.includes('refresh')) {
            await deleteMessage(chatId, messageId);
        }
    }

    else {console.info('Unknown update received:', update)}
    
    return {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!')
    };
}