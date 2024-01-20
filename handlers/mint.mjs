import { bot, cancelMainMenuKeyboard } from '../helpers/bot.mjs';
import { addItemToDynamoDB, getItemFromDynamoDB, getWalletAddressByUserId, getItemsByPartitionKeyFromDynamoDB, editUserState, editItemInDynamoDB  } from '../helpers/dynamoDB.mjs';
import { getCurrentGasPrice, getEthBalance, sendTransaction, addNonce } from '../helpers/ethers.mjs';
import { decrypt } from '../helpers/kms.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work
import { round } from '../helpers/commonUtils.mjs';
import { getEthPrice } from '../helpers/coingecko.mjs';

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;
const userTable = process.env.USER_TABLE_NAME;

// Step 1: Ask the user to choose the token standard to use, or have the user directly input the whole inscription data
// TODO: Check why sometimes the bot would send the same message twice
export async function handleMintStep1(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);
    const ethBalance = await getEthBalance(publicAddress);

    if (ethBalance == 0) {
        const mainMenuKeyboard = {
            inline_keyboard: [[
                { text: "️↩️ Main menu", callback_data: "main_menu" }
            ]]
        };
        
        await bot.sendMessage(chatId, "You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.", { reply_markup: mainMenuKeyboard });
        return;
    }

    const step1Keyboard = {
        inline_keyboard: [[
            { text: "ierc-20", callback_data: "mint_step1_ierc20" }
        ],
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]
    };

    // If the user input the inscription data directly, the bot will jump to the review step
    const step1Message = "Please choose the token standard to use, or input the whole inscription data directly.";

    await editUserState(chatId, 'MINT_STEP1');
    await bot.sendMessage(chatId, step1Message, { reply_markup: step1Keyboard });
}

// Step 2: Receive the token standard and ask the user to input the token ticker
export async function handleMintStep2(chatId, tokenStandard) {
    // Write the user input token standard to DynamoDB
    await editItemInDynamoDB(processTable, { userId: chatId }, { mintTokenStandard: tokenStandard});

    const step2Message = 
        `✅ You have chosen \`${tokenStandard}\` as the token standard. \n` +
        `\n` +
        `👇 Please input the token ticker.\n` +
        `\n` +
        `📖 [You can search for existing tokens on ierc20.com.](https://www.ierc20.com/)`;

    await editUserState(chatId, 'MINT_STEP2');
    await bot.sendMessage(chatId, step2Message, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

// Step 3: Ask the user for the amount to mint
export async function handleMintStep3(chatId, tokenTicker) {
    // Write the user input token ticker to DynamoDB
    await editItemInDynamoDB(processTable, { userId: chatId }, { mintTokenTicker: tokenTicker});

    const step3Message =
        `✅ You have chosen \`${tokenTicker}\` as the token ticker.\n` +
        `\n` +
        `👇 Please input the amount to mint. Do not exceed the minting limit.\n` +
        `\n` +
        `📖 [Check the ${tokenTicker} minting limit on ierc20.com.](https://www.ierc20.com/tick/${tokenTicker})`;

    await editUserState(chatId, 'MINT_STEP3');
    await bot.sendMessage(chatId, step3Message, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

// Step 4: Review and confirm the inscription data.
// TODO: Check why confirmation messages, if not responded to, would repeat itself every minute
export async function handleMintStep4(chatId, amount = null, data = null, retry = null) {
    const walletData = await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId);
    const publicAddress = walletData[0].publicAddress;
    const chainName = walletData[0].chainName;
    
    if (retry === 'timeout') {
        await bot.sendMessage(chatId, "⌛ The inscription process has timed out. Please reconfirm:");

    } else if (retry === 'expensive_gas') {
        await bot.sendMessage(chatId, "⌛ The gas price increased a lot. Please reconfirm:");

    }

    let protocol, ticker;
    if (amount) {
        // Case where the inscription data is generated from the user input in all previous steps
        const processData = await getItemFromDynamoDB(processTable, { userId: chatId });
        protocol = processData.mintTokenStandard;
        ticker = processData.mintTokenTicker;

        data = `data:application/json,{"p":"` + protocol + `","op":"mint","tick":"` + ticker + `","amt":"` + amount + `"}`;
        
        await editItemInDynamoDB(processTable, { userId: chatId }, { mintFullData: data });

    } else if (data) {
        // Case where the inscription data is directly provided
        await editItemInDynamoDB(processTable, { userId: chatId }, { mintFullData: data });

        try {
            const jsonPart = data.substring(data.indexOf(',') + 1);
            const jsonData = JSON.parse(jsonPart);
            protocol = jsonData.p; 
            ticker = jsonData.tick;
            amount = jsonData.amt;

        } catch (error) {
            console.error('Error parsing inscription data in handleMintStep4:', error);
        }
    } else {
        console.error("No amount or fullData provided in handleMintStep4.");
    }

    if (!protocol || !ticker || !amount) {
        bot.sendMessage(chatId, "⚠️ The information provided is incorrect. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        console.warn("No protocol, ticker or amount provided in handleMintStep4.");
        return;
    }

    const currentGasPrice = await getCurrentGasPrice()
    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000 + data.length * 16), 8); // in ETH; + 1 to account for the priority fees
    const estimatedGasCostUsd = round(estimatedGasCost * await getEthPrice(), 2);

    await editItemInDynamoDB(processTable, { userId: chatId }, { mintGasPrice: currentGasPrice });

    let step4Message = 
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

    const ethBalance = await getEthBalance(publicAddress);
    if (ethBalance < estimatedGasCost) {
        step4Message += "\n\n" +    
            "⛔ WARNING: The ETH balance in the wallet is insufficient for the estimated gas cost. You can still proceed, but the transaction is likely to fail. " +
            "Please consider waiting for the gas price to drop, or transfer more ETH to the wallet.";
    }

    step4Message += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const step4Keyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "mint_step4_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    await editUserState(chatId, 'MINT_STEP4');
    await editItemInDynamoDB(processTable, { userId: chatId }, { mintConfirmPromptTime: Date.now() });
    await bot.sendMessage(chatId, step4Message, { reply_markup: step4Keyboard, parse_mode: 'Markdown' });
}

// Step 5: Send the transaction to the blockchain
// TODO: Prevent the user from sending the same transaction twice
export async function handleMintStep5(chatId) {
    const walletData = await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId);
    const publicAddress = walletData[0].publicAddress;
    const processData = await getItemFromDynamoDB(processTable, { userId: chatId });
    let data = processData.mintFullData;

    // Check validity of data
    if (!data) {
        bot.sendMessage(chatId, "⚠️ An error has occurred. Please try again.", { reply_markup: backToMainMenuKeyboard });
        console.error("No inscription data provided in handleMintStep5.");
        return;
    }
    
    // Check for time elapsed, if more than 1 minute, go back to step 4 and prompt the user again to confirm
    if (Date.now() - processData.mintConfirmPromptTime > 60000) {
        await handleMintStep4(chatId, null, data, 'timeout');
        return;
    }

    // Check for current gas prices. If the gas price is at least 10% more expensive, go back to step 4 and prompt the user again to confirm
    const currentGasPrice = await getCurrentGasPrice();
    const previousGasPrice = processData.mintGasPrice;

    if (currentGasPrice > previousGasPrice * 1.1) {
        await handleMintStep4(chatId, null, data, 'expensive_gas');
        return;
    }

    const encryptedPrivateKey = walletData[0].encryptedPrivateKey;
    const privateKey = await decrypt(encryptedPrivateKey);
    const gasSetting = (await getItemFromDynamoDB(userTable, { userId: chatId })).userSettings.gas;

    // Send the transaction to the blockchain
    data = await addNonce(data);

    // TODO: Implement logic to change the 'to' address to non-zero for other token standards
    const txResponse = await sendTransaction(privateKey, data, 'zero', gasSetting);

    const txTimestamp = Date.now();
    const txHash = txResponse.hash;

    // Add the transaction record to the database
    const transactionTable = process.env.TRANSACTION_TABLE_NAME;
    const jsonPart = data.substring(data.indexOf(',') + 1);
    const jsonData = JSON.parse(jsonPart);
    const protocol = jsonData.p;
    const ticker = jsonData.tick;
    const amount = jsonData.amt;

    await addItemToDynamoDB(transactionTable, { 
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

    await bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: transactionSentKeyboard });
    await editUserState(chatId, 'IDLE');
}

export async function handleMintRepeat(chatId) {
    const processData = await getItemFromDynamoDB(processTable, { userId: chatId });
    const data = processData.mintFullData;

    await handleMintStep4(chatId, null, data);
}