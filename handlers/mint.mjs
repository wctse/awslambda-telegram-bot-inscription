import { bot, mainMenuKeyboard, cancelMainMenuKeyboard, divider } from '../helpers/bot.mjs';
import { addItemToDynamoDB, getItemFromDynamoDB, getWalletAddressByUserId, getItemsByPartitionKeyFromDynamoDB, editUserState, editItemInDynamoDB, updateWalletLastActiveAt  } from '../helpers/dynamoDB.mjs';
import { getCurrentGasPrice, getEthBalance, sendTransaction } from '../helpers/ethers.mjs';
import { decrypt } from '../helpers/kms.mjs';
import { round, updateNonce } from '../helpers/commonUtils.mjs';
import { getEthPrice } from '../helpers/coingecko.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;
const transactionTable = process.env.TRANSACTION_TABLE_NAME;

/**
 * Mint step 1: Handle initiation and prompts the user to choose the protocol to mint in
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMintInitiate(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);
    const ethBalance = await getEthBalance(publicAddress);

    const mintDescriptionMessage = 
        "✍️ *Mint*\n" +
        "\n" +
        "This feature mints new inscription tokens that was deployed. \n" +
        divider +
        "\n"

    if (ethBalance == 0) {
        const noEthMessage = mintDescriptionMessage + 
            "⚠️ You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.";
        
        await bot.sendMessage(chatId, noEthMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'});
        return;
    }

    const mintProtocolInputMessage = mintDescriptionMessage + 
        "Please choose the protocol to use, or input the whole inscription data directly.";

    const mintProtocolInputKeyboard = {
        inline_keyboard: [[
            { text: "ierc-20", callback_data: "mint_protocol_ierc-20" }
        ],
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]
    };

    await Promise.all([
        editUserState(chatId, 'MINT_INITIATED'),
        bot.sendMessage(chatId, mintProtocolInputMessage, { reply_markup: mintProtocolInputKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Mint step 2: Handle input of the protocol to mint in and prompts the user to input the token ticker
 * 
 * @param {number} chatId Telegram user ID 
 * @param {str} protocol Protocol of the token to mint
 */
export async function handleMintProtocolInput(chatId, protocol) {
    // Write the user input token standard to DynamoDB

    const mintTokenInputMessage = 
        `✅ You have chosen \`${protocol}\` as the protocol. \n` +
        `\n` +
        `👇 Please input the token ticker.\n` +
        `\n` +
        `📖 [You can search for existing tokens on ierc20.com.](https://app.ierc20.com/)`;

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { mintProtocol: protocol }),
        editUserState(chatId, 'MINT_PROTOCOL_INPUTTED'),
        bot.sendMessage(chatId, mintTokenInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Mint step 3: Handle input of the token ticker and prompts the user to input the amount to mint
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} ticker Ticker of the token to mint
 */
export async function handleMintTickerInput(chatId, ticker) {
    const mintAmountInputMessage =
        `✅ You have chosen \`${ticker}\` as the token ticker.\n` +
        `\n` +
        `👇 Please input the amount to mint. Do not exceed the minting limit.\n` +
        `\n` +
        `📖 [Check the ${ticker} minting limit on ierc20.com.](https://app.ierc20.com/tick/${ticker})`;

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { mintTicker: ticker }),
        editUserState(chatId, 'MINT_TICKER_INPUTTED'),
        bot.sendMessage(chatId, mintAmountInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Mint step 4: Handle input of the amount to mint and prompts the user to confirm the mint.
 * 
 * @param {number} chatId Telegram user ID
 * @param {number} amount Amount to mint
 */
export async function handleMintAmountInput(chatId, amount) {
    if (Number.isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, "⚠️ Please input a valid number.");
        return;
    }

    const publicAddress = await getWalletAddressByUserId(chatId);

    const [walletItem, processItem, currentGasPrice, currentEthPrice, ethBalance] = await Promise.all([
        getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: publicAddress }),
        getItemFromDynamoDB(processTable, { userId: chatId }),
        getCurrentGasPrice(),
        getEthPrice(),
        getEthBalance(publicAddress)
    ]);

    const chainName = walletItem.chainName;

    const protocol = processItem.mintProtocol;
    const ticker = processItem.mintTicker;

    const data = `data:application/json,{"p":"${protocol}","op":"mint","tick":"${ticker}","amt":"${amount}","nonce":""}`;

    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000 + data.length * 16), 8); // in ETH; + 1 to account for the priority fees
    const estimatedGasCostUsd = round(estimatedGasCost * currentEthPrice, 2);

    let mintReviewMessage = 
        `⌛ Please review the inscription information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Protocol: \`${protocol}\`\n` +
        `Ticker: \`${ticker}\`\n` +
        `Amount: \`${amount}\`\n` +
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Cost: ${estimatedGasCost} ETH (\$${estimatedGasCostUsd})`;

    if (ethBalance < estimatedGasCost) {
        mintReviewMessage += "\n\n" +    
            "⛔ WARNING: The ETH balance in the wallet is insufficient for the estimated gas cost. You can still proceed, but the transaction is likely to fail. " +
            "Please consider waiting for the gas price to drop, or transfer more ETH to the wallet.";
    }

    mintReviewMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const mintReviewKeyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "mint_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    const currentTime = Date.now();

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { mintAmount: amount, mintData: data, mintReviewPromptedAt: currentTime, mintGasPrice: currentGasPrice }),
        editUserState(chatId, 'MINT_AMOUNT_INPUTTED'),
        bot.sendMessage(chatId, mintReviewMessage, { reply_markup: mintReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Mint step 5: Handle confirmation of the mint and send the transaction to the blockchain
 * 
 * @param {number} chatId 
 */
export async function handleMintConfirm(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);
    const [walletItem, processItem, currentGasPrice] = await Promise.all([
        getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: publicAddress }),
        getItemFromDynamoDB(processTable, { userId: chatId }),
        getCurrentGasPrice()
    ]);
    
    let data = processItem.mintData;

    // Check validity of data
    if (!data) {
        bot.sendMessage(chatId, "⚠️ An error has occurred. Please try again.", { reply_markup: backToMainMenuKeyboard });
        console.error("No inscription data provided in handleMintConfirm.");
        return;
    }
    
    // Check for time elapsed, if more than 1 minute, go back to step 4 and prompt the user again to confirm
    if (Date.now() - processItem.mintReviewPromptedAt > 60000) {
        await handleMintReviewRetry(chatId, 'timeout');
        return;
    }

    // Check for current gas prices. If the gas price is at least 10% more expensive, go back to step 4 and prompt the user again to confirm
    const previousGasPrice = processItem.mintGasPrice;

    if (currentGasPrice > previousGasPrice * 1.1) {
        await handleMintReviewRetry(chatId, 'expensive_gas');
        return;
    }

    const encryptedPrivateKey = walletItem.encryptedPrivateKey;
    const [privateKey, updatedData] = await Promise.all([
        decrypt(encryptedPrivateKey),
        updateNonce(data)
    ]);

    const gasSetting = walletItem.walletSettings.gas;

    // TODO: Implement logic to change the 'to' address to non-zero for other token standards
    const [txResponse] = await Promise.all([
        sendTransaction(privateKey, updatedData, 'zero', gasSetting),
        updateWalletLastActiveAt(chatId, publicAddress)
    ]);

    const txHash = txResponse.hash;
    const txTimestamp = txResponse.timestamp;

    // Add the transaction record to the database
    const jsonPart = updatedData.substring(updatedData.indexOf(',') + 1);
    const jsonData = JSON.parse(jsonPart);
    const protocol = jsonData.p;
    const ticker = jsonData.tick;
    const amount = jsonData.amt;

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
    const url = 
        config.TESTNET ? "https://sepolia.etherscan.io/tx/" + txHash :
        "https://etherscan.io/tx/" + txHash;

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
            { text: "️↩️ Main menu", callback_data: "main_menu" },
        ]]
    };

    const sendMessagePromise = bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: transactionSentKeyboard });
    const editUserStatePromise = editUserState(chatId, 'IDLE');

    await Promise.all([addTransactionItemPromise, sendMessagePromise, editUserStatePromise]);
}

/**
 * Mint step 4 retry: Handle retry of the mint confirmation and prompts the user to confirm the mint again
 * Takes the existing inscription data from the database and extract components to form the review message
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} retryReason Reason for mint confirmation retry. Expected values: 'repeat_mint', 'timeout', 'expensive_gas'.
 */
async function handleMintReviewRetry(chatId, retryReason) {
    let message;

    if (retryReason === 'repeat_mint') {
        message = null; // Don't need to do anything here as there is nothing going wrong to let the user know

    } else if (retryReason === 'timeout') {
        message = "⌛ The minting process has timed out. Please reconfirm:";

    } else if (retryReason === 'expensive_gas') {
        message = "⌛ The gas price increased a lot. Please reconfirm:";
        
    } else {
        console.warn('Unknown reason for mint confirmation retry: ', retryReason);
        message = null; // No message to send for unknown reasons or 'repeat_mint'
    }

    // Parallelize the sendMessage operation (if there's a message to send) and the retrieval & processing of item from DynamoDB
    const sendMessagePromise = message ? bot.sendMessage(chatId, message) : Promise.resolve();
    const retryMintInputPromise = getItemFromDynamoDB(processTable, { userId: chatId })
        .then(processItem => {
            const amount = processItem.mintAmount;
            return handleMintAmountInput(chatId, amount);
        });

    // Use Promise.all to wait for both operations
    await Promise.all([sendMessagePromise, retryMintInputPromise]);
}

/**
 * Mint step 6 (optional): Handle repeated minting and triggers step 4 again
 * As the logic is the very similar as retrying the mint confirmation, this function simply calls handleMintReviewRetry() and specifying the reason as 'repeat_mint'
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMintRepeat(chatId) {
    await handleMintReviewRetry(chatId, 'repeat_mint');
}