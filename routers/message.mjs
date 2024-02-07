import { handleStart } from '../handlers/start.mjs';
import { handleMintTickerInput, handleMintAmountInput } from '../handlers/mint.mjs';
import { handleImportWalletKeyInput } from '../handlers/importWallet.mjs';
import { handleTransferTickerInput, handleTransferRecipientInput, handleTransferAmountInput } from '../handlers/transfer.mjs';
import { handleCustomDataInput } from '../handlers/customData.mjs';
import { handleMultiMintAmountInput, handleMultiMintTickerInput, handleMultiMintTimesInput } from '../handlers/multiMint.mjs';

export async function routeMessage(text, userState, chatId) {
    // Initialization of chat
    if (text === '/start') {
        await handleStart(chatId);

    // Token standard input for mint
    } else if (userState === 'MINT_PROTOCOL_INPUTTED') {
        await handleMintTickerInput(chatId, text);

    // Amount input for mint
    } else if (userState === 'MINT_TICKER_INPUTTED') {
        await handleMintAmountInput(chatId, text);

    } else if (userState === 'MULTI_MINT_PROTOCOL_INPUTTED') {
        await handleMultiMintTickerInput(chatId, text);

    } else if (userState === 'MULTI_MINT_TICKER_INPUTTED') {
        await handleMultiMintAmountInput(chatId, text);

    } else if (userState === 'MULTI_MINT_AMOUNT_INPUTTED') {
        await handleMultiMintTimesInput(chatId, text);

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

    } else if (userState === 'CUSTOM_DATA_INITIATED') {
        await handleCustomDataInput(chatId, text);

    } else {
        console.info('Unknown message received:', text);
    }
}