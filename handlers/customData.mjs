import { bot, mainMenuKeyboard } from "../helpers/bot.mjs";
import { addItemToDynamoDB, editItemInDynamoDB, editUserState, getItemFromDynamoDB, getItemsByPartitionKeyFromDynamoDB, getWalletAddressByUserId } from "../helpers/dynamoDB.mjs";
import { getCurrentGasPrice, getEthBalance, sendTransaction } from "../helpers/ethers.mjs";
import { decrypt } from "../helpers/kms.mjs";
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work
import { round } from "../helpers/commonUtils.mjs";
import { getEthPrice } from "../helpers/coingecko.mjs";

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;
const userTable = process.env.USER_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

export async function handleCustomDataInitiate(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);
    const ethBalance = await getEthBalance(publicAddress);

    const customDataDescriptionMessage = 
        "📝 The custom data feature allows you to send transactions directly to the blockchain with any data. \n" +
        "\n";

    if (ethBalance == 0) {
        const noEthMessage = customDataDescriptionMessage + 
            "⚠️ You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.";
        
        await bot.sendMessage(chatId, noEthMessage, { reply_markup: mainMenuKeyboard });
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

    await editUserState(chatId, "CUSTOM_DATA_INITIATED");
    await bot.sendMessage(chatId, customDataInputMessage, { reply_markup: customDataInputKeyboard });
}

export async function handleCustomDataInput(chatId, customData) {
    const walletItem = (await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId))[0];
    const publicAddress = walletItem.publicAddress;
    const chainName = walletItem.chainName;

    const currentGasPrice = await getCurrentGasPrice();
    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000 + customData.length * 16), 8);
    const estimatedGasCostUsd = round(estimatedGasCost * await getEthPrice(), 2);

    let customDataConfirmMessage = 
        `⌛ Please review the inscription information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Data: \`${customData}\`\n` +
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Cost: ${estimatedGasCost} ETH (\$${estimatedGasCostUsd })`;
    
    const ethBalance = await getEthBalance(publicAddress);
    if (ethBalance < estimatedGasCost) {
        customDataConfirmMessage += "\n\n" +    
            "⛔ WARNING: The ETH balance in the wallet is insufficient for the estimated gas cost. You can still proceed, but the transaction is likely to fail. " +
            "Please consider waiting for the gas price to drop, or transfer more ETH to the wallet.";
    }

    const customDataConfirmKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "custom_data_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    const currentTime = Date.now();
    await editItemInDynamoDB(processTable, { userId: chatId }, { customDataData: customData, customDataReviewPromptedAt: currentTime, customDataGasPrice: currentGasPrice });

    await editUserState(chatId, 'CUSTOM_DATA_DATA_INPUTTED');
    await bot.sendMessage(chatId, customDataConfirmMessage, { reply_markup: customDataConfirmKeyboard, parse_mode: 'Markdown' });
}

export async function handleCustomDataConfirm(chatId) {
    const walletItem = (await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId))[0];
    const publicAddress = walletItem.publicAddress;
    
    const processItem = await getItemFromDynamoDB(processTable, { userId: chatId });
    const data = processItem.customDataData;

    // Check for time elapsed, if more than 1 minute, go back to step 4 and prompt the user again to confirm
    if (Date.now() - processItem.customDataReviewPromptedAt > 60000) {
        await handleCustomDataRetry(chatId, 'timeout');
        return;
    }

    // Check for current gas prices. If the gas price is at least 10% more expensive, go back to step 4 and prompt the user again to confirm
    const currentGasPrice = await getCurrentGasPrice();
    const previousGasPrice = processItem.customDataGasPrice;

    if (currentGasPrice > previousGasPrice * 1.1) {
        await handleCustomDataRetry(chatId, 'expensive_gas');
        return;
    }

    const encryptedPrivateKey = walletItem.encryptedPrivateKey;
    const privateKey = await decrypt(encryptedPrivateKey);
    const gasSetting = (await getItemFromDynamoDB(userTable, { userId: chatId })).userSettings.gas;

    const txResponse = await sendTransaction(privateKey, data, 'zero', gasSetting);

    const txHash = txResponse.hash;
    const txTimestamp = txResponse.timestamp;

    await addItemToDynamoDB(transactionTable, { 
        userId: chatId,
        publicAddress: publicAddress,
        transactionHash: txHash,
        txType: 'custom_data',
        timestamp: txTimestamp,
        customDataData: data
    });
    
    
    // Send confirmation message to the user
    const url = 
        config.TESTNET ? "https://sepolia.etherscan.io/tx/" + txHash :
        "https://etherscan.io/tx/" + txHash;

    const transactionSentMessage = 
        `🚀 Your custom data transaction has been sent to the blockchain.\n` +
        `\n` +
        `Transaction hash: [${txHash}](${url})\n` +
        `\n` +
        `⏳ Please wait for the transaction to be confirmed. This may take a few minutes.`;

    const transactionSentKeyboard = {
        inline_keyboard: [[
            { text: "🧘 Start over", callback_data: "custom_data" },
            { text: "💰 View wallet", callback_data: "view_wallet" },
        ],
        [
            { text: "️↩️ Main menu", callback_data: "main_menu" },
        ]]
    };

    await bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: transactionSentKeyboard });
    await editUserState(chatId, 'IDLE');
}

export async function handleCustomDataRetry(chatId, retryReason) {
    if (retryReason === 'timeout') {
        await bot.sendMessage(chatId, "⌛ The inscription process has timed out. Please reconfirm:");

    } else if (retryReason === 'expensive_gas') {
        await bot.sendMessage(chatId, "⌛ The gas price increased a lot. Please reconfirm:");

    } else {
        console.warn('Unknown reason for transfer confirmation retry: ', retryReason);
    }

    const data = (await getItemFromDynamoDB(processTable, { userId: chatId })).customDataData;
    await handleCustomDataInput(chatId, data);
}