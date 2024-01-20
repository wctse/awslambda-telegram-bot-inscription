import { handleStart } from '../handlers/start.mjs';
import { handleMintStep3, handleMintStep4 } from '../handlers/mint.mjs';
import { handleImportWalletStep2 } from '../handlers/importWallet.mjs';
import { handleTransferTokenInput, handleTransferRecipientInput, handleTransferAmountInput } from '../handlers/transfer.mjs';

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
    } else if (!Number.isNaN(text) && userState === 'MINT_STEP3') {
        await handleMintStep4(chatId, text, null);

    // Wallet address input for import wallet
    } else if (userState === 'IMPORT_WALLET_STEP1') {
        await handleImportWalletStep2(chatId, text);

    // Ticker and protocol input for transfer
    // TODO: Consider protocol in input when multiple protocols are supported
    } else if (userState === 'TRANSFER_INITIATED') {
        await handleTransferTokenInput(chatId, text, 'ierc-20');

    // Recipient address input for transfer
    } else if (userState === 'TRANSFER_TOKEN_INPUTTED') {
        await handleTransferRecipientInput(chatId, text);

    } else if (userState === 'TRANSFER_RECIPIENT_INPUTTED') {
        await handleTransferAmountInput(chatId, text);

    } else {
        console.info('Unknown message received:', text);
    }
}