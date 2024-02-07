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
import { handleMultiMintCancel, handleMultiMintConfirm, handleMultiMintInitiate, handleMultiMintProtocolInput, handleMultiMintTimesInput } from "../handlers/multiMint.mjs";

export async function routeCallback(data, chatId, messageId) {
    // -- INITIALIZATION -- //
    // Create wallet in start
    if (data === 'create_wallet') {
        await handleCreateWallet(chatId);
    }

    // Import wallet in start
    else if (data === 'import_wallet') {
        await handleImportWalletInitiate(chatId);
    }

    // Back to start in import wallet
    else if (data === 'start') {
        await handleStart(chatId);
    }


    // -- GENERIC -- //
    // Main menu or back to main menu in multiple interfaces
    else if (data === 'main_menu') {
        await handleMainMenu(chatId);
    }

    // Cancel and main menu in multiple interfaces
    else if (data === 'cancel_main_menu') {
        await editUserState(chatId, 'IDLE');
        await handleMainMenu(chatId);
    }

    // -- MAIN MENU -- //
    // Mint button
    else if (data === 'mint') {
        await handleMintInitiate(chatId);
    }

    // Multi-mint button
    else if (data === 'multi_mint') {
        await handleMultiMintInitiate(chatId);
    }

    // Transfer button
    else if (data === 'transfer') {
        await handleTransferInitiate(chatId);
    }
    
    // Custom data button
    else if (data === 'custom_data') {
        await handleCustomDataInitiate(chatId);
    }

    // View wallet button
    else if (data === 'view_wallet') {
        await handleViewWallet(chatId);
    }

    // Settings button
    else if (data === 'settings') {
        await handleSettings(chatId);
    }

    // Refresh button
    else if (data === 'refresh_main_menu') {
        await handleMainMenu(chatId);
    }


    // -- MINT -- //
    // ierc20 in mint step 1
    else if (data === 'mint_protocol_ierc-20') {
        await handleMintProtocolInput(chatId, 'ierc-20');
    }

    // Confirm in mint step 4
    else if (data === 'mint_confirm') {
        await handleMintConfirm(chatId);
    }

    // Repeat in mint step 5
    else if (data === 'mint_repeat') {
        await handleMintRepeat(chatId);
    }


    // -- MULTI-MINT -- //
    // Refresh in multi-mint step 1, multi-mint in progress condition
    else if (data === 'multi_mint_refresh') {
        await handleMultiMintInitiate(chatId);
    }
    // ierc20 in multi-mint step 1
    else if (data === 'multi_mint_protocol_ierc-20') {
        await handleMultiMintProtocolInput(chatId, 'ierc-20');
    }

    // 10 times in multi-mint step 4
    else if (data === 'multi_mint_times_10') {
        await handleMultiMintTimesInput(chatId, 10);
    }

    // 50 times in multi-mint step 4
    else if (data === 'multi_mint_times_50') {
        await handleMultiMintTimesInput(chatId, 50);
    }

    // 100 times in multi-mint step 4
    else if (data === 'multi_mint_times_100') {
        await handleMultiMintTimesInput(chatId, 100);
    }

    // Confirm in multi-mint step 5
    else if (data === 'multi_mint_confirm') {
        await handleMultiMintConfirm(chatId);
    }

    else if (data === 'multi_mint_cancel') {
        await handleMultiMintCancel(chatId);
    }

    
    // -- TRANSFER -- //
    // Ticker in transfer step 1
    else if (data.startsWith('transfer_token_')) {
        const dataArray = data.split('_');
        await handleTransferTickerInput(chatId, dataArray[2], dataArray[3]);
    }

    else if (data === 'transfer_confirm') {
        await handleTransferConfirm(chatId);
    }

    
    // -- CUSTOM DATA -- //
    else if (data === 'custom_data_confirm') {
        await handleCustomDataConfirm(chatId);
    }

    else if (data === 'custom_data_repeat') {
        await handleCustomDataRepeat(chatId);
    }
    

    // -- VIEW WALLET -- //
    // Refresh view wallet in view wallet
    else if (data === 'refresh_view_wallet') {
        await handleViewWallet(chatId);
    }


    // -- SETTINGS -- //
    else if (data === 'settings_gas_auto') {
        await handleSettingsGas(chatId, messageId, 'auto');
    }

    else if (data === 'settings_gas_low') {
        await handleSettingsGas(chatId, messageId, 'low');
    }

    else if (data === 'settings_gas_medium') {
        await handleSettingsGas(chatId, messageId, 'medium');
    }

    else if (data === 'settings_gas_high') {
        await handleSettingsGas(chatId, messageId, 'high');
    }

    // Unknown data
    else {
        console.info('Unknown callback query received:', data);
    }
}