import { handleStart } from '../handlers/start.mjs';
import { handleMintTickerInput, handleMintAmountInput } from '../handlers/mint.mjs';
import { handleImportWalletKeyInput } from '../handlers/importWallet.mjs';
import { handleTransferTickerInput, handleTransferRecipientInput, handleTransferAmountInput } from '../handlers/transfer.mjs';
import { handleCustomDataInput } from '../handlers/customData.mjs';
import { handleMultiMintAmountInput, handleMultiMintTickerInput, handleMultiMintTimesInput } from '../handlers/multiMint.mjs';
import { handleSendEthAmountInput, handleSendEthRecipientInput } from '../handlers/sendEth.mjs';

export async function routeMessage(chatId, text, userState) {
    // INITIALIZATION
    if (text === '/start') {
        await handleStart(chatId);

    // IMPORT WALLET
    } else if (userState === 'IMPORT_WALLET_INITIATED') {
        await handleImportWalletKeyInput(chatId, text);

    // MINT
    } else if (userState === 'MINT_PROTOCOL_INPUTTED') {
        await handleMintTickerInput(chatId, text);

    } else if (userState === 'MINT_TICKER_INPUTTED') {
        await handleMintAmountInput(chatId, text);

    // MULTI-MINT
    } else if (userState === 'MULTI_MINT_PROTOCOL_INPUTTED') {
        await handleMultiMintTickerInput(chatId, text);

    } else if (userState === 'MULTI_MINT_TICKER_INPUTTED') {
        await handleMultiMintAmountInput(chatId, text);

    } else if (userState === 'MULTI_MINT_AMOUNT_INPUTTED') {
        await handleMultiMintTimesInput(chatId, text);

    // TRANSFER
    } else if (userState === 'TRANSFER_INITIATED') {
        await handleTransferTickerInput(chatId, text, 'ierc-20');

    } else if (userState === 'TRANSFER_TOKEN_INPUTTED') {
        await handleTransferRecipientInput(chatId, text);

    } else if (userState === 'TRANSFER_RECIPIENT_INPUTTED') {
        await handleTransferAmountInput(chatId, text);

    // CUSTOM DATA
    } else if (userState === 'CUSTOM_DATA_INITIATED') {
        await handleCustomDataInput(chatId, text);

    // SEND ETH
    } else if (userState === 'SEND_ETH_INITIATED') {
        await handleSendEthRecipientInput(chatId, text);

    } else if (userState === 'SEND_ETH_RECIPIENT_INPUTTED') {
        await handleSendEthAmountInput(chatId, text);

    } else {
        console.info('Unknown message received:', text);
    }
}