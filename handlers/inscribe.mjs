import { bot, cancelMainMenuKeyboard, backToMainMenuKeyboard } from '../helpers/bot.mjs';
import { addItemToDynamoDB, getItemFromDynamoDB, getWalletAddressByUserId, getItemsByPartitionKeyFromDynamoDB, editUserState, editItemInDynamoDB  } from '../helpers/dynamoDB.mjs';
import { getCurrentGasPrice, getEthBalance, sendTransaction } from '../helpers/ethers.mjs';
import { decrypt } from '../helpers/kms.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;

// Step 1: Ask the user to choose the token standard to use, or have the user directly input the whole inscription data
export async function handleInscribeStep1(chatId) {
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
            { text: "erc-20 (Ethscriptions)", callback_data: "inscribe_step1_erc20" }
        ],
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]
    };

    // If the user input the inscription data directly, the bot will jump to the review step
    const step1Message = "Please choose the token standard to use, or input the whole inscription data directly.";

    await addItemToDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress });
    await editUserState(chatId, 'INSCRIBE_STEP1');
    await bot.sendMessage(chatId, step1Message, { reply_markup: step1Keyboard });
}

// Step 2: Receive the token standard and ask the user to input the token ticker
export async function handleInscribeStep2(chatId, tokenStandard) {
    // Write the user input token standard to DynamoDB
    const publicAddress = await getWalletAddressByUserId(chatId);
    await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeTokenStandard: tokenStandard});
    
    // Prompt the user for a token ticker. Add more for future support of other token standards.
    const exampleTokens =
        tokenStandard === "erc-20" ? "eths, gwei" :
        "";

    const step2Message = 
        "✅ You have chosen " + tokenStandard + " as the token standard. \n" +
        "\n" +
        "👇 Please input the token ticker (e.g. " + exampleTokens + ")\n" +
        "\n" +
        "📖 [You can search for existing tokens for both standards on ierc20.com.](https://www.ierc20.com/)";

    await editUserState(chatId, 'INSCRIBE_STEP2');
    await bot.sendMessage(chatId, step2Message, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

// Step 3: Ask the user for the amount to mint
export async function handleInscribeStep3(chatId, tokenTicker) {
    // Write the user input token ticker to DynamoDB
    const publicAddress = await getWalletAddressByUserId(chatId);
    await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeTokenTicker: tokenTicker});

    const step3Message =
        "✅ You have chosen " + tokenTicker + " as the token ticker.\n" +
        "\n" +
        "👇 Please input the amount to mint. Do not exceed the minting limit.\n" +
        "\n" +
        "📖 [You can search for minting limits for both standards on ierc20.com.](https://www.ierc20.com/)";

    await editUserState(chatId, 'INSCRIBE_STEP3');
    await bot.sendMessage(chatId, step3Message, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

// Step 4: Review and confirm the inscription data.
export async function handleInscribeStep4(chatId, amount = null, data = null, recall = null) {
    const walletData = await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId);
    const publicAddress = walletData[0].publicAddress;
    const chainName = walletData[0].chainName;
    
    if (recall === 'timeout') {
        await bot.sendMessage(chatId, "⌛ The inscription process has timed out. Please reconfirm:");

    } else if (recall === 'expensive_gas') {
        await bot.sendMessage(chatId, "⌛ The gas price increased a lot. Please reconfirm:");

    }

    let protocol, ticker;
    if (amount) {
        // Case where the inscription data is generated from the user input in all previous steps
        const processData = await getItemFromDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress });
        protocol = processData.inscribeTokenStandard;
        ticker = processData.inscribeTokenTicker;

        data = `data:,{"p":"` + protocol + `","op":"mint","tick":"` + ticker + `","amt":"` + amount + `"}`;
        
        await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeFullData: data });

    } else if (data) {
        // Case where the inscription data is directly provided
        await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeFullData: data });

        try {
            const jsonPart = data.substring(data.indexOf(',') + 1);
            const jsonData = JSON.parse(jsonPart);
            protocol = jsonData.p; 
            ticker = jsonData.tick;
            amount = jsonData.amt;

        } catch (error) {
            console.error('Error parsing inscription data in handleInscribeStep4:', error);
        }
    } else {
        console.error("No amount or fullData provided in handleInscribeStep4.");
    }

    const currentGasPrice = await getCurrentGasPrice(); // in gwei
    const estimatedGasCost = (1e-9 * currentGasPrice * (21000 + data.length * 16)).toPrecision(4);

    await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeGasPrice: currentGasPrice });

    const step4Message = 
        "⌛ Please review the inscription information below. \n" +
        "\n" +
        "Wallet: `" + publicAddress + "`\n" +
        "Chain: " + chainName + "\n" +
        "Protocol: " + protocol + "\n" +
        "Ticker: " + ticker + "\n" +
        "Amount: " + amount + "\n" +
        "\n" +
        "Current Gas Price: " + currentGasPrice + "\n" +
        "Estimated Cost: " + estimatedGasCost + " ETH\n" +
        "\n" +
        "☝️ Please confirm the information in 1 minute:";

    const step4Keyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "inscribe_step4_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    await editUserState(chatId, 'INSCRIBE_STEP4');
    await editItemInDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress }, { inscribeConfirmPromptTime: Date.now() });
    await bot.sendMessage(chatId, step4Message, { reply_markup: step4Keyboard, parse_mode: 'Markdown' });
}

// Step 5: Send the transaction to the blockchain
// TODO: Prevent the user from sending the same transaction twice
export async function handleInscribeStep5(chatId) {
    const walletData = await getItemsByPartitionKeyFromDynamoDB(walletTable, 'userId', chatId);
    const publicAddress = walletData[0].publicAddress;
    const processData = await getItemFromDynamoDB(processTable, { userId: chatId, publicAddress: publicAddress });
    const data = processData.inscribeFullData;

    // Check validity of data
    if (!data) {
        bot.sendMessage(chatId, "⚠️ An error has occurred. Please try again.", { reply_markup: backToMainMenuKeyboard });
        console.error("No inscription data provided in handleInscribeStep5.");
        return;
    }
    
    // Check for time elapsed, if more than 1 minute, go back to step 4 and prompt the user again to confirm
    if (Date.now() - processData.inscribeConfirmPromptTime > 60000) {
        await handleInscribeStep4(chatId, null, data, 'timeout');
        return;
    }

    // Check for current gas prices. If the gas price is at least 10% more expensive, go back to step 4 and prompt the user again to confirm
    const currentGasPrice = await getCurrentGasPrice();
    const previousGasPrice = processData.inscribeGasPrice;

    if (currentGasPrice > previousGasPrice * 1.1) {
        await handleInscribeStep4(chatId, null, data, 'expensive_gas');
        return;
    }

    const encryptedPrivateKey = walletData[0].encryptedPrivateKey;
    const privateKey = await decrypt(encryptedPrivateKey);

    // Send the transaction to the blockchain
    const txResponse = await sendTransaction(privateKey, data);
    const txHash = txResponse.hash;

    // Add the transaction record to the database
    const transactionTable = process.env.TRANSACTION_TABLE_NAME;
    const jsonPart = data.substring(data.indexOf(',') + 1);
    const jsonData = JSON.parse(jsonPart);
    const protocol = jsonData.p;
    const ticker = jsonData.tick;
    const amount = jsonData.amt;
    await addItemToDynamoDB(transactionTable, { userId: chatId, publicAddress: publicAddress, transactionHash: txHash, txType: 'INSCRIBE', inscribeProtocol: protocol, inscribeTicker: ticker, inscribeAmount: amount });

    const url = 
        config.TESTNET ? "https://sepolia.etherscan.io/tx/" + txHash :
        "https://etherscan.io/tx/" + txHash;

    const transactionSentMessage = 
        "🚀 Your inscription transaction has been sent to the blockchain.\n" +
        "\n" +
        "Transaction hash: [" + txHash + "](" + url + ")\n" +
        "\n" +
        "⏳ Please wait for the transaction to be confirmed. This may take a few minutes.";

    await bot.sendMessage(chatId, transactionSentMessage, { parse_mode: 'Markdown', reply_markup: backToMainMenuKeyboard });
    await editUserState(chatId, 'IDLE');
}