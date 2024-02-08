import { isHexString } from "ethers";
import { bot, cancelMainMenuKeyboard, divider, mainMenuKeyboard } from "../helpers/bot.mjs";
import { addItemToDynamoDB, editItemInDynamoDB, editUserState, getItemFromDynamoDB, getItemsByPartitionKeyFromDynamoDB, getWalletAddressByUserId, updateWalletLastActiveAt } from "../helpers/dynamoDB.mjs";
import { getCurrentGasPrice, getEthBalance, sendTransaction } from "../helpers/ethers.mjs";
import { decrypt } from "../helpers/kms.mjs";
import { getEthPrice } from "../helpers/coingecko.mjs";
import { round } from "../helpers/commonUtils.mjs";
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const processTable = process.env.PROCESS_TABLE_NAME;
const walletTable = process.env.WALLET_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

/**
 * Send ETH step 1: Handle initiation and prompts the user to input the recipient's public address.
 * 
 * @param {number} chatId 
 */
export async function handleSendEthInitiate(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);
    const ethBalance = await getEthBalance(publicAddress);

    const sendEthDescriptionMessage = 
        `💸 *Send ETH*\n` +
        `\n` +
        `This feature allows you to send ETH from this wallet to another.\n` +
        `\n` +
        `Your current ETH balance: \`${ethBalance}\` ETH\n` +
        divider +
        `\n`;

    if (ethBalance === 0) {
        const noEthMessage = sendEthDescriptionMessage +
            `⚠️ You don't have any ETH in your wallet.`;

        await bot.sendMessage(chatId, noEthMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown' });
        return;
    }

    const sendEthRecipientInputMessage = sendEthDescriptionMessage +
        `👇 Enter the recipient's public address:`;

    await Promise.all([
        editUserState(chatId, "SEND_ETH_INITIATED"),
        bot.sendMessage(chatId, sendEthRecipientInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Send ETH step 2: Handle the recipient's public address input and prompts the user to input the amount to send.
 * 
 * @param {number} chatId 
 * @param {str} recipient 
 */
export async function handleSendEthRecipientInput(chatId, recipient) {
    if (!isHexString(recipient, 20)) {
        await bot.sendMessage(chatId, "⛔️ Invalid address. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        return;
    }

    const sendEthAmountInputMessage = 
        `👇 Enter the amount of ETH to send to \`${recipient}\`:`;

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { sendEthRecipient: recipient }),
        editUserState(chatId, "SEND_ETH_RECIPIENT_INPUTTED"),
        bot.sendMessage(chatId, sendEthAmountInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown'})
    ]);
}

/**
 * Send ETH step 3: Handle the amount input and prompts the user to review the transaction information.
 * 
 * @param {number} chatId 
 * @param {number} amount 
 */
export async function handleSendEthAmountInput(chatId, amount) {
    if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, "⛔️ Invalid amount. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        return;
    }

    const publicAddress = await getWalletAddressByUserId(chatId);
    const ethBalance = await getEthBalance(publicAddress);
    
    if (parseFloat(ethBalance) < amount) {
        const notEnoughEthMessage = `⚠️ You only have \`${ethBalance}\` ETH in your wallet. Please enter an amount less than your balance.`;
        await bot.sendMessage(chatId, notEnoughEthMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
        return;
    }

    const [processItem, walletItem, currentGasPrice, currentEthPrice] = await Promise.all([
        getItemFromDynamoDB(processTable, { userId: chatId }),
        getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: publicAddress}),
        getCurrentGasPrice(),
        getEthPrice()
    ]);

    const recipient = processItem.sendEthRecipient;
    const chainName = walletItem.chainName;

    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000), 8); // in ETH; + 1 to account for the priority fees
    const estimatedGasCostUsd = round(estimatedGasCost * currentEthPrice, 2);

    let sendEthConfirmationMessage = 
        `⌛ Please review the transaction information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Recipient: \`${recipient}\`\n` +
        `Amount: ${amount} ETH\n` +
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Cost: ${estimatedGasCost} ETH (\$${estimatedGasCostUsd })`;

    if (parseFloat(ethBalance) < estimatedGasCost + parseFloat(amount)) {
        sendEthConfirmationMessage += "\n\n" +    
            "⛔ WARNING: The ETH balance in the wallet is insufficient for the estimated gas cost. You can still proceed, but the transaction is likely to fail. " +
            "Please consider waiting for the gas price to drop, or transfer more ETH to the wallet.";
    }

    sendEthConfirmationMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const sendEthConfirmationKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "send_eth_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    const currentTime = Date.now();

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { sendEthAmount: amount, sendEthReviewPromptedAt: currentTime, sendEthGasPrice: currentGasPrice }),
        editUserState(chatId, "SEND_ETH_AMOUNT_INPUTTED"),
        bot.sendMessage(chatId, sendEthConfirmationMessage, { reply_markup: sendEthConfirmationKeyboard, parse_mode: 'Markdown'})
    ]);
}

export async function handleSendEthConfirm(chatId) {
    const [processItems, walletItems, currentGasPrice] = await Promise.all([
        getItemsByPartitionKeyFromDynamoDB(processTable, 'userId', chatId),
        getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId),
        getCurrentGasPrice()
    ]);

    const processItem = processItems[0];
    const walletItem = walletItems[0];

    const promptedAt = processItem.sendEthReviewPromptedAt;

    // Check for time elapsed, if more than 1 minute, go back to step 4 and prompt the user again to confirm
    if (Date.now() - promptedAt > 60000) {
        await handleSendEthReviewRetry(chatId, 'timeout');
        return;
    }

    const previousGasPrice = processItem.sendEthGasPrice;

    if (currentGasPrice > previousGasPrice * 1.1) {
        await handleSendEthReviewRetry(chatId, 'expensive_gas');
        return;
    }

    // Get information of the user's wallet for transaction
    const publicAddress = walletItem.publicAddress;
    const privateKey = await decrypt(walletItem.encryptedPrivateKey);
    const gasSetting = walletItem.walletSettings.gas;

    // Get information of the transaction
    const recipient = processItem.sendEthRecipient;
    const amount = processItem.sendEthAmount;

    // Send the transaction
    const [txResponse] = await Promise.all([
        sendTransaction(privateKey, '', recipient, gasSetting, amount),
        updateWalletLastActiveAt(chatId, publicAddress)
    ]);

    const txHash = txResponse.hash;
    const txTimestamp = txResponse.timestamp;

    const addTransactionItemToDynamoDBPromise = addItemToDynamoDB(transactionTable, { 
        userId: chatId,
        publicAddress: publicAddress,
        transactionHash: txHash,
        txType: 'sendEth',
        timestamp: txTimestamp,
        sendEthRecipient: recipient,
        sendEthAmount: amount
    });
    
    const editUserStatePromise = editUserState(chatId, "IDLE");

    // Send confirmation message to the user
    const url = 
        config.TESTNET ? "https://sepolia.etherscan.io/tx/" + txHash :
        "https://etherscan.io/tx/" + txHash;

    const sendEthSentMessage = 
        `🚀 Your transaction has been sent to the blockchain.\n` +
        `\n` +
        `Transaction hash: [${txHash}](${url})\n` +
        `\n` +
        `⏳ Please wait for the transaction to be confirmed. This may take a few minutes.`;

    const sendEthSentKeyboard = {
        inline_keyboard: [[
            { text: "🧘 Send another", callback_data: "send_eth" },
            { text: "📃 Main menu", callback_data: "main_menu" }
        ]]
    };
    
    const sendMessagePromise = bot.sendMessage(chatId, sendEthSentMessage, { reply_markup: sendEthSentKeyboard, parse_mode: 'Markdown' });

    await Promise.all([addTransactionItemToDynamoDBPromise, editUserStatePromise, sendMessagePromise]);
}

export async function handleSendEthReviewRetry(chatId, retryReason) {
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
    const retryAmountInputPromise = getItemFromDynamoDB(processTable, { userId: chatId })
        .then(processItem => {
            const recipient = processItem.sendEthRecipient;
            const amount = processItem.sendEthAmount;
            return handleSendEthAmountInput(chatId, recipient, amount);
        });

    // Use Promise.all to wait for both operations
    await Promise.all([sendMessagePromise, retryAmountInputPromise]);
}
