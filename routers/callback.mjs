import { handleCreateWallet } from "../handlers/createWallet.mjs";
import { handleImportWalletStep1 } from "../handlers/importWallet.mjs";
import { handleStart } from "../handlers/start.mjs";
import { handleMainMenu } from "../handlers/mainMenu.mjs";
import { handleMintStep1, handleMintStep2, handleMintStep5, handleMintRepeat } from "../handlers/mint.mjs";
import { handleTransfer } from "../handlers/transfer.mjs";
import { handleViewWallet } from "../handlers/viewWallet.mjs";
import { handleSettings, handleSettingsGas } from "../handlers/settings.mjs";

import { editUserState } from "../helpers/dynamoDB.mjs";

export async function callback_router(data, chatId, messageId) {
    switch (data) {
        // -- INITIALIZATION -- //
        // Create wallet in start
        case 'create_wallet':
            await handleCreateWallet(chatId);
            break;

        // Import wallet in start
        case 'import_wallet':
            await handleImportWalletStep1(chatId);
            break;

        // Back to start in import wallet
        case 'start':
            await handleStart(chatId);
            break;

        // -- GENERIC -- //
        // Main menu or back to main menu in multiple interfaces
        case 'main_menu':
            await handleMainMenu(chatId);
            break;

        // Cancel and main menu in multiple interfaces
        case 'cancel_main_menu':
            await handleMainMenu(chatId);
            await editUserState(chatId, 'IDLE');
            break;


        // -- MAIN MENU -- //
        // Mint button
        case 'mint':
            await handleMintStep1(chatId);
            break;

        // Transfer button
        case 'transfer':
            await handleTransfer(chatId);
            break;

        // View wallet button
        case 'view_wallet':
            await handleViewWallet(chatId);
            break;

        // Settings button
        case 'settings':
            await handleSettings(chatId);
            break;

        // Refresh button
        case 'refresh_main_menu':
            await handleMainMenu(chatId);
            break;


        // -- MINT -- //
        // ierc20 in mint step 1
        case 'mint_step1_ierc20':
            await handleMintStep2(chatId, 'ierc-20');
            break;

        // Confirm in mint step 4
        case 'mint_step4_confirm':
            await handleMintStep5(chatId);
            break;

        // Repeat in mint step 5
        case 'mint_repeat':
            await handleMintRepeat(chatId);
            break;

        
        // -- VIEW WALLET -- //
        // Refresh view wallet in view wallet
        case 'refresh_view_wallet':
            await handleViewWallet(chatId);
            break;

        
        // -- SETTINGS -- //
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
            console.info('Unknown callback query received:', data);
            break;

    }
}