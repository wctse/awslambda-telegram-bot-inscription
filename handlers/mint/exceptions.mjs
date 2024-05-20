import { bot } from '../../common/bot.mjs';
import { getItemFromDb } from '../../common/db/dbOperations.mjs';
import { handleMintAmountInput } from './steps.mjs';

const processTable = process.env.PROCESS_TABLE_NAME;

/**
 * Mint step 4 retry: Handle retry of the mint confirmation and prompts the user to confirm the mint again
 * Takes the existing inscription data from the database and extract components to form the review message
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} retryReason Reason for mint confirmation retry. Expected values: 'repeat_mint', 'timeout', 'expensive_gas'.
 */
export async function handleMintReviewRetry(chatId, retryReason) {
    let message;

    if (retryReason === 'repeat_mint') {
        message = null; // Don't need to do anything here as there is nothing going wrong to let the user know

    } else if (retryReason === 'timeout') {
        message = "⌛ The minting process has timed out. Please reconfirm:";

    } else if (retryReason === 'expensive_gas') {
        message = "⌛ The gas price increased a lot. Please reconfirm:";
        
    } else if (retryReason === 'address_not_initialized') {
        await bot.sendMessage(chatId, "The TON account is not initialized. Please import it to other wallets and send a transaction first.")

    } else {
        console.warn('Unknown reason for mint confirmation retry: ', retryReason);
        message = null; // No message to send for unknown reasons or 'repeat_mint'
    }

    const sendMessagePromise = message ? bot.sendMessage(chatId, message) : Promise.resolve();
    const retryMintAmountInputPromise = getItemFromDb(processTable, { userId: chatId })
        .then(processItem => {
            const amount = processItem.mintAmount;
            return handleMintAmountInput(chatId, amount);
        });

    await Promise.all([sendMessagePromise, retryMintAmountInputPromise]);
}

/**
 * Mint step 6 (optional): Handle repeated minting and triggers step 4 again
 * As the logic is the very similar as retrying the mint confirmation, this function simply calls handleMintReviewRetry() and specifying the reason as 'repeat_mint'
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMintRepeat(chatId) {
    await handleMintReviewRetry(chatId, 'repeat_mint');
}