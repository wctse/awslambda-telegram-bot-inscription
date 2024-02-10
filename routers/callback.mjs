import { handleCreateWallet } from "../handlers/createWallet.mjs";
import { handleImportWalletInitiate } from "../handlers/importWallet.mjs";
import { handleStart } from "../handlers/start.mjs";
import { handleMainMenu } from "../handlers/mainMenu.mjs";
import { handleMintInitiate, handleMintProtocolInput, handleMintConfirm, handleMintRepeat } from "../handlers/mint.mjs";
import { handleTransferConfirm, handleTransferInitiate, handleTransferTickerInput } from "../handlers/transfer.mjs";
import { handleViewWallet } from "../handlers/viewWallet.mjs";
import { handleSettings, handleSettingsGas } from "../handlers/settings.mjs";
import { handleCustomDataConfirm, handleCustomDataInitiate, handleCustomDataRepeat } from "../handlers/customData.mjs";

import { editUserState } from "../helpers/dynamoDB.mjs";
import { handleMultiMintStop, handleMultiMintConfirm, handleMultiMintInitiate, handleMultiMintProtocolInput, handleMultiMintTimesInput } from "../handlers/multiMint.mjs";
import { handleSendEthConfirm, handleSendEthInitiate } from "../handlers/sendEth.mjs";
import { handleInvalidInput } from "../handlers/invalidInput.mjs";

export async function routeCallback(chatId, data, userState, messageId) {
    // -- INITIALIZATION -- //
    // Create wallet in start
    if (data === 'create_wallet' && userState === 'IDLE') {
        await handleCreateWallet(chatId);
    }

    // Import wallet in start
    else if (data === 'import_wallet' && userState === 'IDLE') {
        await handleImportWalletInitiate(chatId);
    }

    // Back to start in import wallet
    else if (data === 'start' && userState === 'IMPORT_WALLET_INITIATED') {
        await handleStart(chatId);
    }


    // -- GENERIC -- //
    // Main menu or back to main menu in multiple interfaces
    else if (data === 'main_menu') {
        await handleMainMenu(chatId);
    }

    // Cancel and main menu in multiple interfaces
    else if (data === 'cancel_main_menu') {
        await handleMainMenu(chatId);
    }

    // -- MAIN MENU -- //
    // Mint button
    else if (data === 'mint' && userState === 'IDLE') {
        await handleMintInitiate(chatId);
    }

    // Multi-mint button
    else if (data === 'multi_mint' && userState === 'IDLE') {
        await handleMultiMintInitiate(chatId);
    }

    // Transfer button
    else if (data === 'transfer' && userState === 'IDLE') {
        await handleTransferInitiate(chatId);
    }
    
    // Custom data button
    else if (data === 'custom_data' && userState === 'IDLE') {
        await handleCustomDataInitiate(chatId);
    }

    // Send ETH button
    else if (data === 'send_eth' && userState === 'IDLE') {
        await handleSendEthInitiate(chatId);
    }

    // View wallet button
    else if (data === 'view_wallet' && userState === 'IDLE') {
        await handleViewWallet(chatId);
    }

    // Settings button
    else if (data === 'settings' && userState === 'IDLE') {
        await handleSettings(chatId);
    }

    // Refresh button
    else if (data === 'refresh_main_menu' && userState === 'IDLE') {
        await handleMainMenu(chatId);
    }


    // -- MINT -- //
    // ierc20 in mint step 1
    else if (data === 'mint_protocol_ierc-20' && userState === 'MINT_INITIATED') {
        await handleMintProtocolInput(chatId, 'ierc-20');
    }

    // Confirm in mint step 4
    else if (data === 'mint_confirm' && userState === 'MINT_AMOUNT_INPUTTED') {
        await handleMintConfirm(chatId);
    }

    // Repeat in mint step 5
    else if (data === 'mint_repeat' && userState === 'IDLE') {
        await handleMintRepeat(chatId);
    }


    // -- MULTI-MINT -- //
    // Refresh in multi-mint step 1, multi-mint in progress condition
    else if (data === 'multi_mint_refresh' && userState === 'IDLE') {
        await handleMultiMintInitiate(chatId);
    }
    // ierc20 in multi-mint step 1
    else if (data === 'multi_mint_protocol_ierc-20' && userState === 'MULTI_MINT_INITIATED') {
        await handleMultiMintProtocolInput(chatId, 'ierc-20');
    }

    // 10 times in multi-mint step 4
    else if (data === 'multi_mint_times_10' && userState === 'MULTI_MINT_TICKER_INPUTTED') {
        await handleMultiMintTimesInput(chatId, 10);
    }

    // 50 times in multi-mint step 4
    else if (data === 'multi_mint_times_50' && userState === 'MULTI_MINT_TICKER_INPUTTED') {
        await handleMultiMintTimesInput(chatId, 50);
    }

    // 100 times in multi-mint step 4
    else if (data === 'multi_mint_times_100' && userState === 'MULTI_MINT_TICKER_INPUTTED') {
        await handleMultiMintTimesInput(chatId, 100);
    }

    // Confirm in multi-mint step 5
    else if (data === 'multi_mint_confirm' && userState === 'MULTI_MINT_TIMES_INPUTTED') {
        await handleMultiMintConfirm(chatId);
    }

    else if (data === 'multi_mint_stop' && userState === 'IDLE') {
        await handleMultiMintStop(chatId);
    }

    
    // -- TRANSFER -- //
    // Ticker in transfer step 1
    else if (data.startsWith('transfer_token_') && userState === 'TRANSFER_INITIATED') {
        const dataArray = data.split('_');
        await handleTransferTickerInput(chatId, dataArray[2], dataArray[3]);
    }

    else if (data === 'transfer_confirm' && userState === 'TRANSFER_AMOUNT_INPUTTED') {
        await handleTransferConfirm(chatId);
    }

    
    // -- CUSTOM DATA -- //
    else if (data === 'custom_data_confirm' && userState === 'CUSTOM_DATA_DATA_INPUTTED') {
        await handleCustomDataConfirm(chatId);
    }

    else if (data === 'custom_data_repeat' && userState === 'IDLE') {
        await handleCustomDataRepeat(chatId);
    }

    // -- SEND ETH -- //
    else if (data === 'send_eth_confirm' && userState === 'SEND_ETH_AMOUNT_INPUTTED') {
        await handleSendEthConfirm(chatId);
    }
    

    // -- VIEW WALLET -- //
    // Refresh view wallet in view wallet
    else if (data === 'refresh_view_wallet' && userState === 'IDLE') {
        await handleViewWallet(chatId);
    }


    // -- SETTINGS -- //
    else if (data === 'settings_gas_auto' && userState === 'SETTINGS') {
        await handleSettingsGas(chatId, messageId, 'auto');
    }

    else if (data === 'settings_gas_low' && userState === 'SETTINGS') {
        await handleSettingsGas(chatId, messageId, 'low');
    }

    else if (data === 'settings_gas_medium' && userState === 'SETTINGS') {
        await handleSettingsGas(chatId, messageId, 'medium');
    }

    else if (data === 'settings_gas_high' && userState === 'SETTINGS') {
        await handleSettingsGas(chatId, messageId, 'high');
    }

    // Unknown data
    else {
        console.info('Unknown callback query received:', data);
        await handleInvalidInput(chatId);
    }
}