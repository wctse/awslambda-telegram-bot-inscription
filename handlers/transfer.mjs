import { balanceCalculationMessage, bot, cancelMainMenuKeyboard, divider } from '../common/bot.mjs';
import { chunkArray } from '../common/utils.mjs';
import { addItemToDynamoDB, editItemInDb, getItemFromDb } from '../common/db/dbOperations.mjs';
import { editUserState, getCurrentChain } from '../common/db/userDb.mjs';
import { assembleData, getAssetBalance, getExplorerUrl, getInscriptionBalance, getUnits, validateAddress, validateAmount, validateEnoughBalance, validateTransaction } from '../services/processServices.mjs';
import { sendTransaction } from "../services/transactionServices.mjs";
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work
import { getWalletAddress } from '../common/db/walletDb.mjs';

const processTable = process.env.PROCESS_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

/**
 * Transfer step 1: Handle initiation and prompts the user to select a token to transfer.
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleTransferInitiate(chatId) {
    const chainName = await getCurrentChain(chatId);

    const [assetBalance, publicAddress] = await getAssetBalance(chatId, chainName, true);
    const inscriptionBalances = await getInscriptionBalance(chatId, publicAddress, chainName);
    const [assetName, _gasUnitName] = await getUnits(chainName);

    const transferDescriptionMessage =
        "💸 *Transfer*\n" +
        "\n" +
        "This feature transfers ownership of inscription tokens from this wallet to another. \n" +
        divider +
        "\n"

    if (assetBalance == 0) {
        const noAssetMessage = transferDescriptionMessage + 
            `⚠️ You don't have any ${assetName} in your wallet. Please transfer some ETH to your wallet first.`;
        
        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'});
        return;
    }

    // Case if user has no balances, still allow them to mint as the database may be out of sync
    if (Object.values(inscriptionBalances).every(protocolObj => Object.keys(protocolObj).length === 0)) {
        let transferNoBalanceMessage = transferDescriptionMessage + "⛔ You have no balances to transfer.\n" +
          "Do you want to mint some tokens?" + balanceCalculationMessage + "\n" +
          "\n" +
          "If you checked your balances and still wish to transfer, please input the token ticker below:";
      
        const transferNoBalanceKeyboard = {
          inline_keyboard: [[
            { text: "✍️ Mint", callback_data: "mint" },
            { text: "📃 Main menu", callback_data: "cancel_main_menu" },
          ]]
        };
      
        await bot.sendMessage(chatId, transferNoBalanceMessage, { reply_markup: transferNoBalanceKeyboard, parse_mode: 'Markdown' });
        return;
      }

    let transferTickerInputMessage = transferDescriptionMessage + `🔑 Please select the token you want to transfer.\n` + `\n`;
    
    const protocolSections = Object.entries(inscriptionBalances).map(([protocol, protocolObj]) => {
        const tickerBalances = Object.entries(protocolObj)
          .map(([ticker, balance]) => `${ticker}: \`${balance}\``)
          .join('\n');
      
        return `*${protocol} Balances*\n${tickerBalances}`;
      }).join('\n\n');

    transferTickerInputMessage += protocolSections + balanceCalculationMessage + `\n` + `\n` +
        `If you checked your balances and wish to transfer tokens not listed here, please input the token ticker below:`;
    
    const tickerCallbackData = Object.entries(inscriptionBalances).flatMap(([protocol, protocolObj]) => {
        return Object.entries(protocolObj).map(([ticker]) => `transfer_token_${ticker}_${protocol}`);
        });

    const transferTokenInputKeyboard = {
        inline_keyboard: [
            ...chunkArray(tickerCallbackData, 3, true, 'null').map(chunk => {
                return chunk.map(callbackData => {
                    if (callbackData === 'null') {
                        return { text: '-', callback_data: 'null' };
                    }
                    const [_transferText, _tokenText, ticker, protocol] = callbackData.split('_');
                    return { text: `${ticker} (${protocol})`, callback_data: callbackData };
                    });
                }),
            [{ text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }]
        ]
    };

    await Promise.all([
        editUserState(chatId, "TRANSFER_INITIATED"),
        editItemInDb(processTable, { userId: chatId }, { transferChain: chainName, transferWallet: publicAddress}),
        bot.sendMessage(chatId, transferTickerInputMessage, { reply_markup: transferTokenInputKeyboard, parse_mode: 'Markdown' })
    ]);
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

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { transferTicker: ticker, transferProtocol: protocol }),
        editUserState(chatId, "TRANSFER_TOKEN_INPUTTED"),
        bot.sendMessage(chatId, transferRecipientInputMessage, { reply_markup: transferRecipientInputKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Transfer step 3: Handle input of recipient address and prompts the user to input the amount.
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} recipient Recipient address of the transfer. '0x' followed by a 20-byte hex string.
 */
export async function handleTransferRecipientInput(chatId, recipient) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.transferChain;

    if (!(await validateAddress(recipient, chainName))) {
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

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { transferRecipient: recipient }),
        editUserState(chatId, "TRANSFER_RECIPIENT_INPUTTED"),
        bot.sendMessage(chatId, transferAmountInputMessage, { reply_markup: transferAmountInputKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Transfer step 4: Handle input of amount and prompts the user to confirm the transfer.
 * 
 * @param {number} chatId Telegram user ID
 * @param {number} amount Amount to transfer
 */
export async function handleTransferAmountInput(chatId, amount) {
    if (!(validateAmount(amount))) {
        await bot.sendMessage(chatId, "⛔️ Invalid amount. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        return;
    }
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.transferChain;
    const publicAddress = processItem.transferWallet;

    // Generate the full inscription data
    const ticker = processItem.transferTicker;
    const protocol = processItem.transferProtocol;
    const recipient = processItem.transferRecipient;
    const currentTime = Date.now();

    const data = await assembleData(chainName, protocol, 'transfer', { protocol, ticker, amount, recipient })
    const [hasEnoughBalance, [_assetBalance, currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, data, true, [null, 0, 4, 2]);

    const [assetName, _gasUnitName] = await getUnits(chainName);

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
        `Estimated Cost: ${txCost} ${assetName} (\$${txCostUsd})`;

    if (!hasEnoughBalance) {
        transferReviewMessage += "\n\n" +    
            `⛔ WARNING: The ${assetName} balance in the wallet is insufficient for the estimated transaction cost. You can still proceed, but the transaction is likely to fail. ` +
            `Please consider waiting for the transaction price to drop, or transfer more ${assetName} to the wallet.`;
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
        editItemInDb(processTable, { userId: chatId }, { transferAmount: amount, transferData: data, transferReviewPromptedAt: currentTime, transferGasPrice: currentGasPrice }),
        editUserState(chatId, "TRANSFER_AMOUNT_INPUTTED"),
        bot.sendMessage(chatId, transferReviewMessage, { reply_markup: transferReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Transfer step 5: Handle confirmation of transfer and processes the transfer.
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleTransferConfirm(chatId) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });

    const publicAddress = processItem.transferWallet;
    const chainName = processItem.transferChain;
    const prevGasPrice = processItem.transferGasPrice;
    const reviewPromptedAt = processItem.transferReviewPromptedAt;

    const protocol = processItem.transferProtocol;
    const ticker = processItem.transferTicker;
    const amount = processItem.transferAmount;
    const recipient = processItem.transferRecipient;
    const data = processItem.transferData;

    const errorType = await validateTransaction(chainName, prevGasPrice, 0.1, reviewPromptedAt, 60);
    if (errorType) {
        await handleTransferReviewRetry(chatId, errorType);
        return;
    }

    const txResponse = await sendTransaction(chatId, chainName, data);

    const txHash = txResponse.hash;
    const txTimestamp = txResponse.timestamp;

    const addTransactionItemPromise = addItemToDynamoDB(transactionTable, { 
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

    // Send confirmation message to the user
    const url = await getExplorerUrl(chainName, txHash);

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

    const editUserStatePromise = editUserState(chatId, "IDLE");
    const sendMessagePromise = bot.sendMessage(chatId, transferSentMessage, { reply_markup: transferSentKeyboard, parse_mode: 'Markdown' });
    
    await Promise.all([addTransactionItemPromise, editUserStatePromise, sendMessagePromise]);
}

/**
 * Transfer step 4 (retry): Handle retry of confirmation of transfer and prompts the user to confirm the transfer again.
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} retryReason Reason for transfer confirmation retry. Expected values: 'timeout', 'expensive_gas'.
 */
export async function handleTransferReviewRetry(chatId, retryReason) {
    let message;

    if (retryReason === 'repeat_mint') {
        message = null; // Don't need to do anything here as there is nothing going wrong to let the user know

    } else if (retryReason === 'timeout') {
        message = "⌛ The transfer process has timed out. Please reconfirm:";

    } else if (retryReason === 'expensive_gas') {
        message = "⌛ The gas price increased a lot. Please reconfirm:";
        
    } else {
        console.warn('Unknown reason for transfer confirmation retry: ', retryReason);
        message = null; // No message to send for unknown reasons or 'repeat_mint'
    }

    // Parallelize the sendMessage operation (if there's a message to send) and the retrieval & processing of item from DynamoDB
    const sendMessagePromise = message ? bot.sendMessage(chatId, message) : Promise.resolve();
    const retryTransferAmountInputPromise = getItemFromDb(processTable, { userId: chatId })
        .then(processItem => {
            const amount = processItem.transferAmount;
            return handleTransferAmountInput(chatId, amount);
        });

    // Use Promise.all to wait for both operations
    await Promise.all([sendMessagePromise, retryTransferAmountInputPromise]);
}

export async function handleTransferCommand(chatId, text) {
    const [_command, protocol, ticker, amount, recipient] = text.split(' ');

    const chainName = await getCurrentChain(chatId);
    const publicAddress = await getWalletAddress(chatId, chainName);

    const supportedProtocols = config.CHAINS.find(chain => chain.name === chainName)?.protocols;

    if (!protocol || !ticker || !amount || !recipient) {
        await bot.sendMessage(chatId, "⛔️ Please input the protocol, token ticker, amount, and recipient address in the format `/transfer <protocol> <ticker> <amount> <recipient>`.", { parse_mode: 'Markdown' });
        return;
    }

    else if (!(supportedProtocols.includes(protocol))) {
        await bot.sendMessage(chatId, `⛔️ This protocol is not supported in ${chainName}.`, { parse_mode: 'Markdown' });
        return;
    }

    else if (!(await validateAmount(amount))) {
        await bot.sendMessage(chatId, "⛔️ Invalid amount. Please try again.", { parse_mode: 'Markdown' });
        return;
    }

    else if (!(await validateAddress(recipient, chainName))) {
        await bot.sendMessage(chatId, "⛔️ Invalid address. Please try again.", { parse_mode: 'Markdown' });
        return;
    }

    const data = await assembleData(chainName, protocol, 'transfer', { protocol, ticker, amount, recipient });
    const [hasEnoughBalance, [_assetBalance, currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, data, true, [null, 0, 4, 2]);

    const [assetName, _gasUnitName] = await getUnits(chainName);

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
        `Estimated Cost: ${txCost} ${assetName} (\$${txCostUsd})`;

    if (!hasEnoughBalance) {
        transferReviewMessage += "\n\n" +    
            `⛔ WARNING: The ${assetName} balance in the wallet is insufficient for the estimated transaction cost. You can still proceed, but the transaction is likely to fail. ` +
            `Please consider waiting for the transaction price to drop, or transfer more ${assetName} to the wallet.`;
    }

    transferReviewMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const transferReviewKeyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "transfer_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    const editUserProcessPromise = editItemInDb(processTable, { userId: chatId }, { 
        transferProtocol: protocol,
        transferTicker: ticker,
        transferAmount: amount,
        transferRecipient: recipient,
        transferChain: chainName,
        transferWallet: publicAddress,
        transferData: data,
        transferReviewPromptedAt: Date.now(),
        transferGasPrice: currentGasPrice }
    );

    await Promise.all([
        editUserProcessPromise,
        editUserState(chatId, "TRANSFER_AMOUNT_INPUTTED"),
        bot.sendMessage(chatId, transferReviewMessage, { reply_markup: transferReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}