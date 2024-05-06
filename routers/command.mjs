import { handleStart } from '../handlers/start.mjs';
import { handleMainMenu } from '../handlers/mainMenu.mjs';
import { handleMintInitiate, handleMintCommand } from '../handlers/mint.mjs';
import { handleMultiMintInitiate, handleMultiMintCommand } from '../handlers/multiMint.mjs';
import { handleTransferInitiate, handleTransferCommand } from '../handlers/transfer.mjs';
import { handleCustomDataInitiate, handleCustomDataCommand } from '../handlers/customData.mjs';
import { handleViewWallet } from '../handlers/viewWallet.mjs';
import { handleSettings } from '../handlers/settings.mjs';

export async function routeCommand(chatId, text, userState) {

    // INITIALIZATION
    if (text === '/start') {
        await handleStart(chatId);
    }

    if (text === '/menu') {
        await handleMainMenu(chatId);
    }

    else if (text === '/mint') {
        await handleMintInitiate(chatId);
    }

    else if (text.startsWith('/mint')) {
        await handleMintCommand(chatId, text);
    }

    else if (text === '/multimint') {
        await handleMultiMintInitiate(chatId);  
    }

    else if (text.startsWith('/multimint')) {
        await handleMultiMintCommand(chatId, text);
    }

    else if (text === '/transfer') {
        await handleTransferInitiate(chatId);
    }

    else if (text.startsWith('/transfer')) {
        await handleTransferCommand(chatId, text);
    }

    else if (text === '/customdata') {
        await handleCustomDataInitiate(chatId);
    }

    else if (text.startsWith('/customdata')) {
        await handleCustomDataCommand(chatId, text);
    }

    else if (text.startsWith('/viewwallet')) {
        await handleViewWallet(chatId);
    }

    else if (text.startsWith('/settings')) {
        await handleSettings(chatId);
    }

    else {
        console.info('Unknown command received:', text);
    }
}