import { bot } from "../../common/bot.mjs";
import { addItemToDynamoDB, getItemFromDb } from "../../common/db/dbOperations.mjs";
import { editUserState } from "../../common/db/userDb.mjs";
import { getExplorerUrl, validateTransaction } from "../../services/processServices.mjs";
import { assembleTransactionSentMessage, sendTransaction } from "../../services/transactionServices.mjs";
import config from "../../config.json" assert { type: "json" }; // Lambda IDE will show this is an error, but it would work
import { handleSendAssetReviewRetry } from "./exceptions.mjs";

const processTable = process.env.PROCESS_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

export async function handleSendAssetConfirm(chatId) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    
    const publicAddress = processItem.sendAssetWallet;
    const chainName = processItem.sendAssetChain;
    const prevGasPrice = processItem.sendAssetGasPrice;
    const reviewPromptedAt = processItem.sendAssetReviewPromptedAt;
    const recipient = processItem.sendAssetRecipient;
    const amount = processItem.sendAssetAmount;

    const errorType = await validateTransaction(chainName, publicAddress, prevGasPrice, 0.1, reviewPromptedAt, 60);
    if (errorType) {
        await handleSendAssetReviewRetry(chatId, errorType);
        return;
    }

    const {txHash, txTimestamp} = await sendTransaction(chatId, chainName, null, recipient, amount);
    const transactionSentMessage = await assembleTransactionSentMessage(chainName, 'sendAsset', publicAddress, txHash);

    const addTransactionItemPromise = addItemToDynamoDB(transactionTable, { 
        userId: chatId,
        publicAddress: publicAddress,
        transactionHash: txHash ? txHash: 'null',
        txType: 'sendAsset',
        timestamp: txTimestamp ? txTimestamp : 'null',
        sendAssetRecipient: recipient,
        sendAssetAmount: amount
    });
    
    const editUserStatePromise = editUserState(chatId, "IDLE");

    const transactionSentKeyboard = {
        inline_keyboard: [[
            { text: "🧘 Send another", callback_data: "send_asset" },
            { text: "📃 Main menu", callback_data: "main_menu" }
        ]]
    };
    
    const sendMessagePromise = bot.sendMessage(chatId, transactionSentMessage, { reply_markup: transactionSentKeyboard, parse_mode: 'Markdown' });

    await Promise.all([addTransactionItemPromise, editUserStatePromise, sendMessagePromise]);
}