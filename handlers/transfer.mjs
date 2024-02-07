import { isHexString } from 'ethers';
import { balanceCalculationMessage, bot, cancelMainMenuKeyboard, divider } from '../helpers/bot.mjs';
import { chunkArray, round, updateNonce } from '../helpers/commonUtils.mjs';
import { addItemToDynamoDB, editItemInDynamoDB, getItemsByPartitionKeyFromDynamoDB } from '../helpers/dynamoDB.mjs';
import { editUserState } from '../helpers/dynamoDB.mjs';
import { getIerc20Balance } from '../helpers/ierc20.mjs';
import { getCurrentGasPrice, getEthBalance, sendTransaction } from '../helpers/ethers.mjs';
import { decrypt } from '../helpers/kms.mjs';
import { getEthPrice } from '../helpers/coingecko.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

/**
 * Transfer step 1: Handle initiation and prompts the user to select a token to transfer.
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleTransferInitiate(chatId) {
    // Check user balances to provide a list of tokens to transfer
    const userItem = await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId); 
    const publicAddress = userItem[0].publicAddress;
    const [ethBalance, ierc20Balances] = await Promise.all([
        getEthBalance(publicAddress),
        getIerc20Balance(publicAddress)
    ]);

    const transferDescriptionMessage =
        "💸 *Transfer*\n" +
        "\n" +
        "This feature transfers ownership of inscription tokens from this wallet to another. \n" +
        divider +
        "\n"

    if (ethBalance == 0) {
        const noEthMessage = mintDescriptionMessage + 
            "⚠️ You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.";
        
        await bot.sendMessage(chatId, noEthMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'});
        return;
    }

    // Case if user has no balances, still allow them to mint as the database may be out of sync
    if (Object.keys(ierc20Balances).length === 0) {
        let transferNoBalanceMessage = transferDescriptionMessage +
            "⛔ You have no balances to transfer.\n" +
            "Do you want to mint some tokens?" +
            balanceCalculationMessage + "\n" +
            "\n" +
            "If you checked your balances and still wish to transfer, please input the token ticker below:";

        const transferNoBalanceKeyboard = {
            inline_keyboard: [[
                { text: "✍️ Mint", callback_data: "mint" },
                { text: "📃 Main menu", callback_data: "cancel_main_menu" }, // cancel_main_menu callback to clear the user state
            ]]
        };

        await bot.sendMessage(chatId, transferNoBalanceMessage, { reply_markup: transferNoBalanceKeyboard, parse_mode: 'Markdown' });
        return;
    }

    const ierc20Tickers = Object.keys(ierc20Balances);
    const ierc20TickersChunks = chunkArray(ierc20Tickers, 4);

    const transferTokenInputMessage = transferDescriptionMessage +
        `🔑 Please select the token you want to transfer.\n` +
        `\n` +

        // Ticker and amounts held in wallet
        `*ierc-20 Balances*\n` +
        Object.entries(ierc20Balances).map(([ticker, balance]) => {
            return `${ticker}: \`${balance}\``;
        }).join('\n') +

        balanceCalculationMessage + `\n` +
        `\n` +
        `If you checked your balances and wish to transfer tokens not listed here, please input the token ticker below:`;

    const transferTokenInputKeyboard = {
        inline_keyboard: [
            ...ierc20TickersChunks.map(chunk => {
                return chunk.map(ticker => {
                    return { text: ticker + " (ierc-20)", callback_data: 'transfer_token_' + ticker + '_ierc-20' };
                });
            }),
            [{ text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }]
        ]
    };

    await editUserState(chatId, "TRANSFER_INITIATED");
    await bot.sendMessage(chatId, transferTokenInputMessage, { reply_markup: transferTokenInputKeyboard, parse_mode: 'Markdown' });
}

/**
 * Transfer step 2: Handle input of token ticker and prompts the user to input the recipient address.
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} ticker Ticker of the token to transfer
 * @param {str} protocol Protocol of the token to transfer
 */
export async function handleTransferTickerInput(chatId, ticker, protocol) {
    const transferRecipientInputMessage = 
        `✅ You have selected to transfer \`${ticker}\` of \`${protocol}\`.\n` +
        `\n` +
        `👇 Please input the public address of the recipient of the transfer.`;

    const transferRecipientInputKeyboard = {
        inline_keyboard: [[
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    await editItemInDynamoDB(processTable, { userId: chatId }, { transferTicker: ticker, transferProtocol: protocol } );
    await editUserState(chatId, "TRANSFER_TOKEN_INPUTTED");
    await bot.sendMessage(chatId, transferRecipientInputMessage, { reply_markup: transferRecipientInputKeyboard, parse_mode: 'Markdown' });
}

/**
 * Transfer step 3: Handle input of recipient address and prompts the user to input the amount.
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} recipient Recipient address of the transfer. '0x' followed by a 20-byte hex string.
 */
export async function handleTransferRecipientInput(chatId, recipient) {
    if (!isHexString(recipient, 20)) {
        await bot.sendMessage(chatId, "⛔️ Invalid address. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        return;
    }
    
    const transferAmountInputMessage = 
        `✅ You will be sending to \`${recipient}\`.\n` +
        `\n` +
        `👇 Please input the amount you want to transfer.`;

    const transferAmountInputKeyboard = {
        inline_keyboard: [[
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    await editItemInDynamoDB(processTable, { userId: chatId }, { transferRecipient: recipient });
    await editUserState(chatId, "TRANSFER_RECIPIENT_INPUTTED");
    await bot.sendMessage(chatId, transferAmountInputMessage, { reply_markup: transferAmountInputKeyboard, parse_mode: 'Markdown' });
}

/**
 * Transfer step 4: Handle input of amount and prompts the user to confirm the transfer.
 * 
 * @param {number} chatId Telegram user ID
 * @param {number} amount Amount to transfer
 */
export async function handleTransferAmountInput(chatId, amount) {
    if (Number.isNaN(amount)) {
        await bot.sendMessage(chatId, "⛔️ Invalid amount. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        return;
    }

    const [processItems, walletItems, currentGasPrice, ethPrice] = await Promise.all([
        getItemsByPartitionKeyFromDynamoDB(processTable, 'userId', chatId),
        getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId),
        getCurrentGasPrice(),
        getEthPrice()
    ]);

    // Generate the full inscription data
    const processItem = processItems[0];
    const ticker = processItem.transferTicker;
    const protocol = processItem.transferProtocol;
    const recipient = processItem.transferRecipient;
    const currentTime = Date.now();

    const data = `data:application/json,{"p":"${protocol}","op":"transfer","tick":"${ticker}","nonce":"${currentTime * 1000000}","to":[{"amt":"${amount}","recv":"${recipient}"}]}`;

    // Get wallet and network information
    const walletItem = walletItems[0];
    const publicAddress = walletItem.publicAddress;
    const chainName = walletItem.chainName;
    const walletBalance = await getEthBalance(publicAddress);

    // TODO: Check whether the wallet has sufficient balance for the transfer when API is available
    
    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000 + data.length * 16), 8); // in ETH; + 1 to account for the priority fees
    const estimatedGasCostUsd = round(estimatedGasCost * ethPrice, 2);

    let transferReviewMessage =
        `⌛ Please review the transfer information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Recipient: \`${recipient}\`\n` +
        `Protocol: \`${protocol}\`\n` +
        `Ticker: \`${ticker}\`\n` +
        `Amount: \`${amount}\`\n` +
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Cost: ${estimatedGasCost} ETH (\$${estimatedGasCostUsd})`;

    if (walletBalance < estimatedGasCost) {
        transferReviewMessage += "\n\n" +    
            "⛔ WARNING: The ETH balance in the wallet is insufficient for the estimated gas cost. You can still proceed, but the transaction is likely to fail. " +
            "Please consider waiting for the gas price to drop, or transfer more ETH to the wallet.";
    }

    transferReviewMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const transferReviewKeyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "transfer_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { transferData: data, transferReviewPromptedAt: currentTime, transferGasPrice: currentGasPrice }),
        editUserState(chatId, "TRANSFER_AMOUNT_INPUTTED")
    ]);

    await bot.sendMessage(chatId, transferReviewMessage, { reply_markup: transferReviewKeyboard, parse_mode: 'Markdown' });
}

/**
 * Transfer step 5: Handle confirmation of transfer and processes the transfer.
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleTransferConfirm(chatId) {
    const [processItems, walletItems, currentGasPrice] = await Promise.all([
        getItemsByPartitionKeyFromDynamoDB(processTable, 'userId', chatId),
        getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId),
        getCurrentGasPrice()
    ])

    const processItem = processItems[0];
    const walletItem = walletItems[0];

    const promptedAt = processItem.transferReviewPromptedAt;

    // Check for time elapsed, if more than 1 minute, go back to step 4 and prompt the user again to confirm
    if (Date.now() - promptedAt > 60000) {
        await handleTransferReviewRetry(chatId, 'timeout');
        return;
    }

    const previousGasPrice = processItem.transferGasPrice;

    if (currentGasPrice > previousGasPrice * 1.1) {
        await handleTransferReviewRetry(chatId, 'expensive_gas');
        return;
    }

    // Get information of the user's wallet for transaction
    const publicAddress = walletItem.publicAddress;
    const encryptedPrivateKey = walletItem.encryptedPrivateKey;
    const gasSetting = walletItem.walletSettings.gas;

    // Get the inscription
    let [data, privateKey] = await Promise.all([
        updateNonce(processItem.transferData),
        decrypt(encryptedPrivateKey)
    ]);

    // Send the transaction
    const txResponse = await sendTransaction(privateKey, data, 'zero', gasSetting);
    const txHash = txResponse.hash;
    const txTimestamp = txResponse.timestamp;

    // Reconstruct the components of the transfer from the inscription data
    const inscriptionData = JSON.parse(data.substring(22));

    const protocol = inscriptionData.p;
    const ticker = inscriptionData.tick;
    const amount = inscriptionData.to[0].amt;
    const recipient = inscriptionData.to[0].recv;

    const addTransactionItemToDynamoDBPromise = addItemToDynamoDB(transactionTable, { 
        userId: chatId,
        publicAddress: publicAddress,
        transactionHash: txHash,
        txType: 'transfer',
        timestamp: txTimestamp,
        transferProtocol: protocol,
        transferTicker: ticker,
        transferAmount: amount,
        transferRecipient: recipient,
    });
    
    const editUserStatePromise = editUserState(chatId, "IDLE");

    await Promise.all([addTransactionItemToDynamoDBPromise, editUserStatePromise]);

    // Send confirmation message to the user
    const url = 
        config.TESTNET ? "https://sepolia.etherscan.io/tx/" + txHash :
        "https://etherscan.io/tx/" + txHash;

    const transferSentMessage = 
        `🚀 Your transfer transaction has been sent to the blockchain.\n` +
        `\n` +
        `Transaction hash: [${txHash}](${url})\n` +
        `\n` +
        `⏳ Please wait for the transaction to be confirmed. This may take a few minutes.`;

    const transferSentKeyboard = {
        inline_keyboard: [[
            { text: "🧘 Make another transfer", callback_data: "transfer" },
            { text: "📃 Main menu", callback_data: "main_menu" }
        ]]
    };

    bot.sendMessage(chatId, transferSentMessage, { reply_markup: transferSentKeyboard, parse_mode: 'Markdown' });
}

/**
 * Transfer step 4 (retry): Handle retry of confirmation of transfer and prompts the user to confirm the transfer again.
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} retryReason Reason for transfer confirmation retry. Expected values: 'timeout', 'expensive_gas'.
 */
export async function handleTransferReviewRetry(chatId, retryReason) {
    if (retryReason === 'timeout') {
        await bot.sendMessage(chatId, "⌛ The inscription process has timed out. Please reconfirm:");

    } else if (retryReason === 'expensive_gas') {
        await bot.sendMessage(chatId, "⌛ The gas price increased a lot. Please reconfirm:");

    } else {
        console.warn('Unknown reason for transfer confirmation retry: ', retryReason);
    }

    const processItem = (await getItemsByPartitionKeyFromDynamoDB(processTable, 'userId', chatId))[0];
    const data = processItem.transferData;

    // Reconstruct the components of the transfer from the inscription data
    const inscriptionData = JSON.parse(data.substring(22));

    const protocol = inscriptionData.p;
    const ticker = inscriptionData.tick;
    const amount = inscriptionData.to[0].amt;
    const recipient = inscriptionData.to[0].recv;

    // Get wallet and network information
    const walletItem = await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId);
    const publicAddress = walletItem[0].publicAddress;
    const chainName = walletItem[0].chainName;
    const ethBalance = await getEthBalance(publicAddress);
    
    const currentGasPrice = await getCurrentGasPrice();
    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000 + data.length * 16), 8); // in ETH; + 1 to account for the priority fees
    const estimatedGasCostUsd = round(estimatedGasCost * await getEthPrice(), 2);

    let transferSentMessage =
        `⌛ Please review the transfer information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Recipient: \`${recipient}\`\n` +
        `Protocol: \`${protocol}\`\n` +
        `Ticker: \`${ticker}\`\n` +
        `Amount: \`${amount}\`\n` +
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Cost: ${estimatedGasCost} ETH (\$${estimatedGasCostUsd})`;

    if (ethBalance < estimatedGasCost) {
        transferSentMessage += "\n\n" +    
            "⛔ WARNING: The ETH balance in the wallet is insufficient for the estimated gas cost. You can still proceed, but the transaction is likely to fail. " +
            "Please consider waiting for the gas price to drop, or transfer more ETH to the wallet.";
    }

    transferSentMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const transferSentKeyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "transfer_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    const currentTime = Date.now();

    await editItemInDynamoDB(processTable, { userId: chatId }, { transferReviewPromptedAt: currentTime, transferGasPrice: currentGasPrice });
    await editUserState(chatId, "TRANSFER_AMOUNT_INPUTTED");
    await bot.sendMessage(chatId, transferSentMessage, { reply_markup: transferSentKeyboard, parse_mode: 'Markdown' });
}