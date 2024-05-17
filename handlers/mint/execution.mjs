import { bot } from '../../common/bot.mjs';
import { addItemToDynamoDB, getItemFromDb  } from '../../common/db/dbOperations.mjs';
import { editUserState } from '../../common/db/userDb.mjs';
import { getExplorerUrl, validateTransaction } from '../../services/processServices.mjs';
import { sendTransaction } from '../../services/transactionServices.mjs';
import { handleMintReviewRetry } from './exceptions.mjs';

const processTable = process.env.PROCESS_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

/**
 * Mint step 5: Handle confirmation of the mint and send the transaction to the blockchain
 * 
 * @param {number} chatId 
 */
export async function handleMintConfirm(chatId) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });

    const publicAddress = processItem.mintWallet;
    const chainName = processItem.mintChain;
    const prevGasPrice = processItem.mintGasPrice;
    const reviewPromptedAt = processItem.mintReviewPromptedAt;

    const protocol = processItem.mintProtocol;
    const ticker = processItem.mintTicker;
    const amount = processItem.mintAmount;
    const data = processItem.mintData;

    const errorType = await validateTransaction(chainName, prevGasPrice, 0.1, reviewPromptedAt, 60);
    if (errorType) {
        await handleMintReviewRetry(chatId, errorType);
        return;
    }

    const txResponse = await sendTransaction(chatId, chainName, data);

    const txHash = txResponse.hash;
    const txTimestamp = txResponse.timestamp;

    const addTransactionItemPromise = addItemToDynamoDB(transactionTable, { 
        userId: chatId,
        publicAddress: publicAddress,
        transactionHash: txHash,
        txType: 'mint',
        timestamp: txTimestamp,
        mintProtocol: protocol,
        mintTicker: ticker,
        mintAmount: amount });

    // Send confirmation message to the user
    const url = await getExplorerUrl(chainName, txHash);

    const transactionSentMessage = 
        `🚀 Your mint transaction has been sent to the blockchain.\n` +
        `\n` +
        `Transaction hash: [${txHash}](${url})\n` +
        `\n` +
        `⏳ Please wait for the transaction to be confirmed. This may take a few minutes.`;

    const transactionSentKeyboard = {
        inline_keyboard: [[
            { text: "🔁 Repeat", callback_data: "mint_repeat" },
            { text: "🧘 Start over", callback_data: "mint" },
            { text: "💰 View wallet", callback_data: "view_wallet" },
        ],
        [
            { text: "️↩️ Main menu", callback_data: "cancel_main_menu" }, // Use cancel to reset the user state
        ]]
    };

    const sendMessagePromise = bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: transactionSentKeyboard });
    const editUserStatePromise = editUserState(chatId, 'MINT_CONFIRMED');

    await Promise.all([addTransactionItemPromise, sendMessagePromise, editUserStatePromise]);
}