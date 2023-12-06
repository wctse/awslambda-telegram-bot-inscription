import { bot } from '../helpers/bot.mjs';
import { getWalletAddressByUserId, editUserState } from '../helpers/dynamoDB.mjs';
import { getEthBalance } from '../helpers/ethers.mjs';

// Step 1: Ask the user to choose the token standard to use, or have the user directly input the whole inscription data
export async function handleInscribeStep1(chatId) {
    const publicAddress =  getWalletAddressByUserId(chatId);
    const ethBalance = await getEthBalance(publicAddress);

    // TODO: Uncomment this when inscribe function is implemented
    // if (ethBalance == 0) {
    //     const mainMenuKeyboard = {
    //         inline_keyboard: [[
    //             { text: "️↩️ Main menu", callback_data: "main_menu" }
    //         ]]
    //     };
        
    //     await bot.sendMessage(chatId, "You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.", { reply_markup: mainMenuKeyboard });
    //     return;
    // }

    const step1Keyboard = {
        inline_keyboard: [[
            { text: "erc-20 (Ethscriptions)", callback_data: "inscribe_step1_erc20" },
            { text: "ierc-20", callback_data: "inscribe_step1_ierc20" }
        ]]
    };

    // If the user input the inscription data directly, the bot will jump to the review step
    const step1Message = "Please choose the token standard to use, or input the whole inscription data directly.";

    await bot.sendMessage(chatId, step1Message, { reply_markup: step1Keyboard });
    await editUserState(chatId, 'INSCRIBE_STEP1');
}

// Step 2: Receive the token standard and ask the user to input the token ticker
export async function handleInscribeStep2(chatId, tokenStandard) {
    await bot.sendMessage(chatId, "This is step 2 of the inscribe process. You chose " + tokenStandard + ".");
}

// Step 3: Ask the user for the amount to mint
export async function handleInscribeStep3(chatId) {
    await bot.sendMessage(chatId, "This is step 3 of the inscribe process.");
}

// Step 4: Review and confirm the inscription data
export async function handleInscribeStep4(chatId) {
    await bot.sendMessage(chatId, "This is step 4 of the inscribe process.");
}

// Step 5: Send the transaction to the blockchain
export async function handleInscribeStep5(chatId) {
    await bot.sendMessage(chatId, "This is step 5 of the inscribe process.");
}