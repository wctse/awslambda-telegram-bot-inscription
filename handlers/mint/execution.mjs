import { bot } from '../../common/bot.mjs';
import { addItemToDynamoDB, getItemFromDb  } from '../../common/db/dbOperations.mjs';
import { editUserState } from '../../common/db/userDb.mjs';
import { getExplorerUrl, validateTransaction } from '../../services/processServices.mjs';
import { assembleTransactionSentMessage, sendTransaction } from '../../services/transactionServices.mjs';
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

    const errorType = await validateTransaction(chainName, publicAddress, prevGasPrice, 0.1, reviewPromptedAt, 60);
    if (errorType) {
        await handleMintReviewRetry(chatId, errorType);
        return;
    }

    const {txHash, txTimestamp} = await sendTransaction(chatId, chainName, data);
    const transactionSentMessage = await assembleTransactionSentMessage(chainName, 'mint', publicAddress, txHash);
    
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

    const addTransactionItemPromise = addItemToDynamoDB(transactionTable, { 
        userId: chatId,
        publicAddress: publicAddress,
        transactionHash: txHash ? txHash: 'null',
        txType: 'mint',
        timestamp: txTimestamp ? txTimestamp : 'null',
        mintProtocol: protocol,
        mintTicker: ticker,
        mintAmount: amount });

    const sendMessagePromise = bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: transactionSentKeyboard });
    const editUserStatePromise = editUserState(chatId, 'MINT_CONFIRMED');

    await Promise.all([addTransactionItemPromise, sendMessagePromise, editUserStatePromise]);
}