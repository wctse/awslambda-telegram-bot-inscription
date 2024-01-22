import { handleStart } from '../handlers/start.mjs';
import { handleMintTickerInput, handleMintAmountInput } from '../handlers/mint.mjs';
import { handleImportWalletKeyInput } from '../handlers/importWallet.mjs';
import { handleTransferTickerInput, handleTransferRecipientInput, handleTransferAmountInput } from '../handlers/transfer.mjs';

export async function routeMessage(text, userState, chatId) {
    // Initialization of chat
    if (text === '/start') {
        await handleStart(chatId);

    // Full data input for mint
    } else if (text.startsWith('data:') && userState === 'MINT_INITIATED') {
        await handleMintAmountInput(chatId, null, text);

    // Token standard input for mint
    } else if (userState === 'MINT_PROTOCOL_INPUTTED') {
        await handleMintTickerInput(chatId, text);

    // Amount input for mint
    } else if (!Number.isNaN(text) && userState === 'MINT_TICKER_INPUTTED') {
        await handleMintAmountInput(chatId, text, null);

    // Wallet address input for import wallet
    } else if (userState === 'IMPORT_WALLET_INITIATED') {
        await handleImportWalletKeyInput(chatId, text);

    // Ticker and protocol input for transfer
    // TODO: Consider protocol in input when multiple protocols are supported
    } else if (userState === 'TRANSFER_INITIATED') {
        await handleTransferTickerInput(chatId, text, 'ierc-20');

    // Recipient address input for transfer
    } else if (userState === 'TRANSFER_TOKEN_INPUTTED') {
        await handleTransferRecipientInput(chatId, text);

    } else if (userState === 'TRANSFER_RECIPIENT_INPUTTED') {
        await handleTransferAmountInput(chatId, text);

    } else {
        console.info('Unknown message received:', text);
    }
}