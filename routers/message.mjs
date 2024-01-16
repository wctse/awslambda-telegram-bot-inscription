import { handleStart } from '../handlers/start.mjs';
import { handleMintStep3, handleMintStep4 } from '../handlers/mint.mjs';
import { handleImportWalletStep2 } from '../handlers/importWallet.mjs';

import { isNumeric } from '../helpers/commonUtils.mjs';

export async function message_router(text, userState, chatId) {
    // Initialization of chat
    if (text === '/start') {
        await handleStart(chatId);

    // Full data input for mint
    } else if (text.startsWith('data:') && userState === 'MINT_STEP1') {
        await handleMintStep4(chatId, null, text);

    // Token standard input for mint
    } else if (userState === 'MINT_STEP2') {
        await handleMintStep3(chatId, text);

    // Amount input for mint
    } else if (isNumeric(text) && userState === 'MINT_STEP3') {
        await handleMintStep4(chatId, text, null);

    // Wallet address input for import wallet
    } else if (userState === 'IMPORT_WALLET_STEP1') {
        await handleImportWalletStep2(chatId, text);

    } else {
        console.info('Unknown message received:', text);
    }
}