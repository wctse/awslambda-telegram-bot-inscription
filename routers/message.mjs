
import { handleMintTickerInput, handleMintAmountInput } from  '../handlers/mint/index.mjs'
import { handleStartImportWalletKeyInput } from '../handlers/start/importWallet.mjs';
import { handleTransferTickerInput, handleTransferRecipientInput, handleTransferAmountInput } from '../handlers/transfer.mjs';
import { handleCustomDataInput } from '../handlers/customData.mjs';
import { handleMultiMintAmountInput, handleMultiMintTickerInput, handleMultiMintTimesInput } from '../handlers/multiMint.mjs';
import { handleSendAssetAmountInput, handleSendAssetRecipientInput } from "../handlers/sendAsset/index.mjs";

export async function routeMessage(chatId, text, userState) {
    console.info('Message received: ', text, ' from chatId: ', chatId, ' with user state: ', userState);

    // IMPORT WALLET
    if (userState === 'START_IMPORT_WALLET_CHAIN_NAME_INPUT') {
        await handleStartImportWalletKeyInput(chatId, text);

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
    } else if (userState === 'SEND_ASSET_INITIATED') {
        await handleSendAssetRecipientInput(chatId, text);

    } else if (userState === 'SEND_ASSET_RECIPIENT_INPUTTED') {
        await handleSendAssetAmountInput(chatId, text);

    } else {
        console.info('Unknown message received:', text);
    }
}