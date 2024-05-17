import { bot } from "../../common/bot.mjs";
import { getItemFromDb } from "../../common/db/dbOperations.mjs";
import { handleSendAssetAmountInput } from "./steps.mjs";

const processTable = process.env.PROCESS_TABLE_NAME;

export async function handleSendAssetReviewRetry(chatId, retryReason) {
    let message;
    
    if (retryReason === 'timeout') {
        message = "⌛ The inscription process has timed out. Please reconfirm:";

    } else if (retryReason === 'expensive_gas') {
        message = "⌛ The gas price increased a lot. Please reconfirm:";

    } else {
        console.warn('Unknown reason for transfer confirmation retry: ', retryReason);
        message = null; // No message to send for unknown reasons

    }

    // Parallelize the sendMessage operation (if there's a message to send) and the retrieval & processing of item from DynamoDB
    const sendMessagePromise = message ? bot.sendMessage(chatId, message) : Promise.resolve();
    const retryAmountInputPromise = getItemFromDb(processTable, { userId: chatId })
        .then(processItem => {
            return handleSendAssetAmountInput(chatId, processItem.sendAssetAmount);
        });

    // Use Promise.all to wait for both operations
    await Promise.all([sendMessagePromise, retryAmountInputPromise]);
}
