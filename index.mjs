import { handleStart } from './handlers/start.mjs';
import { handleCreateWallet } from './handlers/createWallet.mjs';
import { handleImportWalletStep1, handleImportWalletStep2 } from './handlers/importWallet.mjs';
import { handleMainMenu } from './handlers/mainMenu.mjs';
import { handleViewWallet } from './handlers/viewWallet.mjs';
import { handleMintStep1, handleMintStep2, handleMintStep3, handleMintStep4, handleMintStep5 } from './handlers/mint.mjs';
import { handleTransfer } from './handlers/transfer.mjs';
import { handleSettings, handleSettingsGas } from './handlers/settings.mjs';

import { deleteMessage } from './helpers/bot.mjs';
import { editItemInDynamoDB, editUserState, getUserState } from './helpers/dynamoDB.mjs';
import { isNumeric } from './helpers/commonUtils.mjs';

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

        if (text === '/start') {
            await handleStart(chatId);

        } else if (text.startsWith('data:') && userState === 'MINT_STEP1') {
            await handleMintStep4(chatId, null, text);

        } else if (userState === 'MINT_STEP2') {
            await handleMintStep3(chatId, text);

        } else if (isNumeric(text) && userState === 'MINT_STEP3') {
            await handleMintStep4(chatId, text, null);

        } else if (userState === 'IMPORT_WALLET_STEP1') {
            await handleImportWalletStep2(chatId, text);
        }

        else {
            console.info('Unknown message received:', message);
        }
        
    } else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        await editItemInDynamoDB(userTable, { userId: chatId }, { lastActiveAt: Date.now() });

        switch (data) {
            case 'start':
                await handleStart(chatId);
                break;
            case 'create_wallet':
                await handleCreateWallet(chatId);
                break;
            case 'import_wallet':
                await handleImportWalletStep1(chatId);
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
            case 'cancel_main_menu':
                await handleMainMenu(chatId);
                break;
            case 'refresh_main_menu':
                await handleMainMenu(chatId);
                break;
            case 'mint':
                await handleMintStep1(chatId);
                break;
            case 'mint_step1_ierc20':
                await handleMintStep2(chatId, 'ierc-20');
                break;
            case 'mint_step4_confirm':
                await handleMintStep5(chatId);
                break;
            case 'transfer':
                await handleTransfer(chatId);
                break;
            case 'settings':
                await handleSettings(chatId);
                break;
            case 'settings_gas_auto':
                await handleSettingsGas(chatId, messageId, 'auto');
                break;
            case 'settings_gas_low':
                await handleSettingsGas(chatId, messageId, 'low');
                break;
            case 'settings_gas_medium':
                await handleSettingsGas(chatId, messageId, 'medium');
                break;
            case 'settings_gas_high':
                await handleSettingsGas(chatId, messageId, 'high');
                break;
            default:
                console.info('Unknown callback query received:', callbackQuery);
                break;
        }

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