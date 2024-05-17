import { bot, divider, mainMenuKeyboard } from "../common/bot.mjs";
import { addItemToDynamoDB, editItemInDb, getItemFromDb } from "../common/db/dbOperations.mjs";
import { editUserState, getCurrentChain } from '../common/db/userDb.mjs';
import { getAssetBalance, getExplorerUrl, getUnits, validateEnoughBalance, validateTransaction } from "../services/processServices.mjs";
import { sendTransaction } from "../services/transactionServices.mjs";

const processTable = process.env.PROCESS_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

export async function handleCustomDataInitiate(chatId) {
    const chainName = await getCurrentChain(chatId);
    const [assetBalance, publicAddress] = await getAssetBalance(chatId, chainName, true);

    const customDataDescriptionMessage = 
        "📝 *Custom data*\n" +
        "\n" +
        "This feature allows you to send transactions directly to the blockchain with any data. \n" +
        divider +
        "\n";

    if (assetBalance == 0) {
        const noAssetMessage = customDataDescriptionMessage + 
            "⚠️ You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.";
        
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
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Cost: ${txCost} ${assetName} (\$${txCostUsd})`;
    
    if (!hasEnoughBalance) {
        customDataReviewMessage += "\n\n" +    
            `⛔ WARNING: The ${assetName} balance in the wallet is insufficient for the estimated transaction cost. You can still proceed, but the transaction is likely to fail. ` +
            `Please consider waiting for the transaction price to drop, or transfer more ${assetName} to the wallet.`;
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

    const errorType = await validateTransaction(chainName, prevGasPrice, 0.1, reviewPromptedAt, 60);
    if (errorType) {
        await handleCustomDataRetry(chatId, errorType);
        return;
    }

    const txResponse = await sendTransaction(chatId, chainName, data)

    const txHash = txResponse.hash;
    const txTimestamp = txResponse.timestamp;

    const addTransactionItemPromise = addItemToDynamoDB(transactionTable, { 
        userId: chatId,
        publicAddress: publicAddress,
        transactionHash: txHash,
        txType: 'custom_data',
        timestamp: txTimestamp,
        customDataData: data
    });
    
    
    // Send confirmation message to the user
    const url = await getExplorerUrl(chainName, txHash);

    const transactionSentMessage = 
        `🚀 Your custom data transaction has been sent to the blockchain.\n` +
        `\n` +
        `Transaction hash: [${txHash}](${url})\n` +
        `\n` +
        `⏳ Please wait for the transaction to be confirmed. This may take a few minutes.`;

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

    const sendMessagePromise = bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: transactionSentKeyboard });
    const editUserStatePromise = editUserState(chatId, 'CUSTOM_DATA_CONFIRMED');

    await Promise.all([addTransactionItemPromise, sendMessagePromise, editUserStatePromise]);
}

export async function handleCustomDataRetry(chatId, retryReason) {
    if (retryReason === 'timeout') {
        await bot.sendMessage(chatId, "⌛ The inscription process has timed out. Please reconfirm:");

    } else if (retryReason === 'expensive_gas') {
        await bot.sendMessage(chatId, "⌛ The gas price increased a lot. Please reconfirm:");

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