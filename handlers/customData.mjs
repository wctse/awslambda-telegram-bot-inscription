import { bot, divider, mainMenuKeyboard } from "../common/bot.mjs";
import { addItemToDynamoDB, editItemInDb, getItemFromDb } from "../common/db/dbOperations.mjs";
import { editUserState, getCurrentChain } from '../common/db/userDb.mjs';
import { getAssetBalance, getExplorerUrl, getNotEnoughBalanceMessage, getUnits, validateEnoughBalance, validateTransaction } from "../services/processServices.mjs";
import { assembleTransactionSentMessage, sendTransaction } from "../services/transactionServices.mjs";

const processTable = process.env.PROCESS_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

export async function handleCustomDataInitiate(chatId) {
    const chainName = await getCurrentChain(chatId);
    const [assetBalance, publicAddress] = await getAssetBalance(chatId, chainName, true);
    const [assetName, _gasUnitName] = await getUnits(chainName);

    const customDataDescriptionMessage = 
        "📝 *Custom data*\n" +
        "\n" +
        "This feature allows you to send transactions directly to the blockchain with any data. \n" +
        divider +
        "\n";

    if (assetBalance == 0) {
        const noAssetMessage = customDataDescriptionMessage + 
            `⚠️ You don't have any ${assetName} in your wallet. Please transfer some ${assetName} to your wallet first.`;
        
        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'});
        return;
    }
    
    const customDataInputMessage = customDataDescriptionMessage +
        "Please enter the custom data you want to send:";

    const customDataInputKeyboard = {
        inline_keyboard: [
            [
                { text: `🔙 Back`, callback_data: `cancel_main_menu` }
            ]
        ]
    };

    await Promise.all([
        editUserState(chatId, "CUSTOM_DATA_INITIATED"),
        editItemInDb(processTable, { userId: chatId }, { customDataChain: chainName, customDataWallet: publicAddress}),
        bot.sendMessage(chatId, customDataInputMessage, { reply_markup: customDataInputKeyboard, parse_mode: 'Markdown'})
    ]);
}

export async function handleCustomDataInput(chatId, customData) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const publicAddress = processItem.customDataWallet;
    const chainName = processItem.customDataChain;

    const [hasEnoughBalance, [_assetBalance, currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, customData, true, [null, 0, 4, 2]);
    const [assetName, _gasUnitName] = await getUnits(chainName);

    let customDataReviewMessage = 
        `⌛ Please review the inscription information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Data: \`${customData}\`\n` +
        `\n`

    if (txCost && txCostUsd) {
        customDataReviewMessage += `Estimated Cost: ${txCost} ${assetName} (\$${txCostUsd})`;
    }
    
    if (!hasEnoughBalance) {
        customDataReviewMessage += await getNotEnoughBalanceMessage(chainName, assetName);
    }

    customDataReviewMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const customDataConfirmKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "custom_data_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    const currentTime = Date.now();
    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { customDataData: customData, customDataReviewPromptedAt: currentTime, customDataGasPrice: currentGasPrice }),
        editUserState(chatId, 'CUSTOM_DATA_DATA_INPUTTED'),
        bot.sendMessage(chatId, customDataReviewMessage, { reply_markup: customDataConfirmKeyboard, parse_mode: 'Markdown' })
    ]);
}

export async function handleCustomDataConfirm(chatId) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });

    const publicAddress = processItem.customDataWallet;
    const chainName = processItem.customDataChain;
    const prevGasPrice = processItem.customDataGasPrice;
    const reviewPromptedAt = processItem.customDataReviewPromptedAt;

    const data = processItem.customDataData;

    const errorType = await validateTransaction(chainName, publicAddress, prevGasPrice, 0.1, reviewPromptedAt, 60);

    if (errorType) {
        await handleCustomDataRetry(chatId, errorType);
        return;
    }

    const {txHash, txTimestamp} = await sendTransaction(chatId, chainName, data);
    const transactionSentMessage = await assembleTransactionSentMessage(chainName, 'customData', publicAddress, txHash);

    const transactionSentKeyboard = {
        inline_keyboard: [
        [
            { text: "🔁 Repeat", callback_data: "custom_data_repeat" },
            { text: "🧘 Start over", callback_data: "custom_data" },
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
        txType: 'custom_data',
        timestamp: txTimestamp ? txTimestamp : 'null',
        customDataData: data
    });

    const sendMessagePromise = bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: transactionSentKeyboard });
    const editUserStatePromise = editUserState(chatId, 'CUSTOM_DATA_CONFIRMED');

    await Promise.all([addTransactionItemPromise, sendMessagePromise, editUserStatePromise]);
}

export async function handleCustomDataRetry(chatId, retryReason) {
    if (retryReason === 'timeout') {
        await bot.sendMessage(chatId, "⌛ The inscription process has timed out. Please reconfirm:");

    } else if (retryReason === 'expensive_gas') {
        await bot.sendMessage(chatId, "⌛ The gas price increased a lot. Please reconfirm:");

    } else if (retryReason === 'address_not_initialized') {
        await bot.sendMessage(chatId, "The TON account is not initialized. Please import it to other wallets and send a transaction first.")

    } else {
        console.warn('Unknown reason for transfer confirmation retry: ', retryReason);
    }

    const data = (await getItemFromDb(processTable, { userId: chatId })).customDataData;
    await handleCustomDataInput(chatId, data);
}

export async function handleCustomDataRepeat(chatId) {
    const data = (await getItemFromDb(processTable, { userId: chatId })).customDataData;
    await handleCustomDataInput(chatId, data);
}

export async function handleCustomDataCommand(chatId, text) {
    const customData = text.replace('/customdata', '').trim();
    await handleCustomDataInput(chatId, customData);
}