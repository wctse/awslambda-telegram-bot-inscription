import { bot, cancelMainMenuKeyboard, divider, mainMenuKeyboard } from "../helpers/bot.mjs";
import { getEthPrice } from "../helpers/coingecko.mjs";
import { round } from "../helpers/commonUtils.mjs";
import { deleteItemFromDynamoDB, editItemInDynamoDB, editUserState, getItemFromDynamoDB, getWalletAddressByUserId } from "../helpers/dynamoDB.mjs";
import { getCurrentGasPrice, getEthBalance } from "../helpers/ethers.mjs";

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;
const multiMintTable = process.env.MULTI_MINT_TABLE_NAME;

/**
 * Multi-mint step 1: Handle initiation and prompts the user to choose the protocol to mint in
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMultiMintInitiate(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);

    const [ethBalance, multiMintItem] = await Promise.all([
        getEthBalance(publicAddress),
        getItemFromDynamoDB(multiMintTable, { userId: chatId, publicAddress: publicAddress })
    ]);

    const multiMintDescriptionMessage = 
        "📚 *Multi-mint*\n" +
        "\n" +
        "This feature mints new inscription tokens that was deployed for a set amount of times, saving precious time for you. \n" +
        divider +
        "\n";

    if (ethBalance == 0) {
        const noEthMessage = multiMintDescriptionMessage + 
            "⚠️ You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.";
        
        await bot.sendMessage(chatId, noEthMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown' });
        return;
    }

    // Multiple multi-mint progresses are not supported as they may conflict and be invalid
    if (multiMintItem) {
        const data = JSON.parse(multiMintItem.inscriptionData.slice(22));

        const multiMintInProgressMessage = multiMintDescriptionMessage +
            `⚠️ You have a multi-mint in progress. Please wait for it to complete before starting a new one.\n` +
            `\n` +
            `Wallet: \`${publicAddress}\`\n` +
            `Protocol: \`${data.p}\`\n` +
            `Ticker: \`${data.tick}\`\n` +
            `Amount: \`${data.amt}\`\n` +
            `\n` +
            `Mint progress: \`${multiMintItem.timesMinted}/${multiMintItem.timesToMint}\``;

        const multiMintInProgressKeyboard = {
            inline_keyboard: [
                [
                    { text: "❌ Stop current multi-mint", callback_data: "multi_mint_stop" },
                ],
                [
                    { text: "🔄 Refresh", callback_data: "multi_mint_refresh" },
                    { text: "📃 Main menu", callback_data: "main_menu" }
                ]]
            };

        await bot.sendMessage(chatId, multiMintInProgressMessage, { reply_markup: multiMintInProgressKeyboard, parse_mode: 'Markdown' });
        return;
    }

    const multiMintProtocolInputMessage = multiMintDescriptionMessage + 
        "Please choose the protocol to use, or input the whole inscription data directly.";

    const multiMintProtocolInputKeyboard = {
        inline_keyboard: [
        [
            { text: "ierc-20", callback_data: "multi_mint_protocol_ierc-20" }
        ],
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]
    };

    await editUserState(chatId, 'MULTI_MINT_INITIATED');
    await bot.sendMessage(chatId, multiMintProtocolInputMessage, { reply_markup: multiMintProtocolInputKeyboard, parse_mode: 'Markdown'});
}


/**
 * Multi-mint step 2: Handle input of the protocol to mint in and prompts the user to input the token ticker
 * 
 * @param {number} chatId Telegram user ID 
 * @param {str} protocol Protocol of the token to mint
 */
export async function handleMultiMintProtocolInput(chatId, protocol) {
    // Write the user input token standard to DynamoDB
    await editItemInDynamoDB(processTable, { userId: chatId }, { multiMintProtocol: protocol });

    const multiMintTokenInputMessage = 
        `✅ You have chosen \`${protocol}\` as the protocol. \n` +
        `\n` +
        `👇 Please input the token ticker.\n` +
        `\n` +
        `📖 [You can search for existing tokens on ierc20.com.](https://app.ierc20.com/)`;

    await editUserState(chatId, 'MULTI_MINT_PROTOCOL_INPUTTED');
    await bot.sendMessage(chatId, multiMintTokenInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

/**
 * Multi-mint step 3: Handle input of the token ticker and prompts the user to input the amount to mint
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} ticker Ticker of the token to mint
 */
export async function handleMultiMintTickerInput(chatId, ticker) {
    // Write the user input token ticker to DynamoDB
    await editItemInDynamoDB(processTable, { userId: chatId }, { multiMintTicker: ticker });

    const multiMintAmountInputMessage =
        `✅ You have chosen \`${ticker}\` as the token ticker.\n` +
        `\n` +
        `👇 Please input the amount to mint each time. Do not exceed the minting limit.\n` +
        `\n` +
        `📖 [Check the ${ticker} minting limit on ierc20.com.](https://app.ierc20.com/tick/${ticker})`;

    await editUserState(chatId, 'MULTI_MINT_TICKER_INPUTTED');
    await bot.sendMessage(chatId, multiMintAmountInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
}

/**
 * Multi-mint step 4: Handle input of the mint amount each time and prompts the user to input the times to mint
 * 
 * @param {number} chatId Telegram user ID
 * @param {number} amount Amount to mint each time
 */
export async function handleMultiMintAmountInput(chatId, amount) {
    if (Number.isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, "⚠️ Please input a valid number.");
        return;
    }

    // Write the user input mint amount to DynamoDB
    await editItemInDynamoDB(processTable, { userId: chatId }, { multiMintAmount: amount });
    const ticker = (await getItemFromDynamoDB(processTable, { userId: chatId })).multiMintTicker;

    const multiMintTimesInputMessage =
        `✅ You have specified to mint \`${amount}\` tokens each time.\n` +
        `\n` +
        `👇 Please input or choose the amount of times to mint. Be careful that tokens minted beyond the limit per address would be invalid.\n` +
        `\n` +
        `📖 [Check the ${ticker} minting limit on ierc20.com.](https://app.ierc20.com/tick/${ticker})`;

    const multiMintTimesInputKeyboard = {
        inline_keyboard: 
        [[
            { text: "10 times", callback_data: "multi_mint_times_10" },
            { text: "50 times", callback_data: "multi_mint_times_50" },
            { text: "100 times", callback_data: "multi_mint_times_100" }
        ],
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]};

    await editUserState(chatId, 'MULTI_MINT_AMOUNT_INPUTTED');
    await bot.sendMessage(chatId, multiMintTimesInputMessage, { reply_markup: multiMintTimesInputKeyboard, parse_mode: 'Markdown' });
}

/**
 * Multi-mint step 5: Handle input of the times to mint and prompts the user to confirm the multi-mint.
 * 
 * @param {number} chatId Telegram user ID
 * @param {number} times Amount to mint each time
 */
export async function handleMultiMintTimesInput(chatId, times) {
    if (Number.isNaN(times) || times <= 0) {
        await bot.sendMessage(chatId, "⚠️ Please choose or input a valid number.");
        return;
    }
    
    else if (times > 100) {
        await bot.sendMessage(chatId, "⚠️ The maximum multi-mint times is 100.");
        return;
    }

    const [publicAddress, processItem, currentGasPrice, ethPrice] = await Promise.all([
        getWalletAddressByUserId(chatId),
        getItemFromDynamoDB(processTable, { userId: chatId }),
        getCurrentGasPrice(),
        getEthPrice()
    ]);

    const walletItem = await getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: publicAddress });
    const chainName = walletItem.chainName;

    // Get previous user input from DynamoDB
    const protocol = processItem.multiMintProtocol;
    const ticker = processItem.multiMintTicker;
    const amount = processItem.multiMintAmount;

    const data = `data:application/json,{"p":"${protocol}","op":"mint","tick":"${ticker}","amt":"${amount}","nonce":""}`;

    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000 + data.length * 16) * times, 8); // in ETH; + 1 to account for the priority fees
    const estimatedGasCostUsd = round(estimatedGasCost * ethPrice, 2);

    const multiMintReviewMessage =
        `⌛ Please review the multi-mint information below.` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Protocol: \`${protocol}\`\n` +
        `Ticker: \`${ticker}\`\n` +
        `Amount: \`${amount}\`\n` +
        `\n` +
        `The mint will be executed for \`${times}\` times.\n` +
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Total Cost: ${estimatedGasCost} ETH (\$${estimatedGasCostUsd})`;

    const multiMintReviewKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "multi_mint_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { multiMintTimes: times, multiMintData: data }),
        editUserState(chatId, 'MULTI_MINT_TIMES_INPUTTED'),
        bot.sendMessage(chatId, multiMintReviewMessage, { reply_markup: multiMintReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Multi-mint step 6: Handle confirmation of the mint and add the multi-mint to the DynamoDB table
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMultiMintConfirm(chatId) {
    const [processItem, publicAddress] = await Promise.all([
        getItemFromDynamoDB(processTable, { userId: chatId }),
        getWalletAddressByUserId(chatId)
    ]);

    const multiMintData = processItem.multiMintData;
    const multiMintTimes = parseInt(processItem.multiMintTimes);

    const multiMintItem = {
        inscriptionData: multiMintData,
        timesMinted: 0,
        timesToMint: multiMintTimes,
        lastMintedBlock: 0,
        initiatedAt: Date.now(),
    };

    const multiMintConfirmMessage = "✅ Your multi-mint has been submitted. You will be notified when it is completed.";

    await Promise.all([
        editItemInDynamoDB(multiMintTable, { userId: chatId, publicAddress: publicAddress }, multiMintItem),
        editUserState(chatId, 'IDLE'),
        bot.sendMessage(chatId, multiMintConfirmMessage, { reply_markup: mainMenuKeyboard })
    ]);
}

/**
 * Handle stopping of the multi-mint
 * 
 * @param {number} chatId 
 */
export async function handleMultiMintStop(chatId) {
    const publicAddress = await getWalletAddressByUserId(chatId);
    const [walletItem, multiMintItem] = await Promise.all([
        getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: publicAddress }),
        getItemFromDynamoDB(multiMintTable, { userId: chatId, publicAddress: publicAddress })
    ]);

    if (!multiMintItem) {
        await bot.sendMessage(chatId, "⚠️ You don't have a multi-mint in progress.", { reply_markup: mainMenuKeyboard });
        return;
    }

    const { inscriptionData, timesMinted, timesToMint } = multiMintItem;
    const { p, tick, amt } = JSON.parse(inscriptionData.substring(22));
    const chainName = walletItem.chainName;

    const multiMintCancelMessage =
        `✅ Your multi-mint has been cancelled.\n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Protocol: \`${p}\`\n` +
        `Ticker: \`${tick}\`\n` +
        `Times minted: \`${timesMinted}/${timesToMint}\`\n` +
        `Total amount: \`${amt * timesMinted}\``;

    await Promise.all([
        deleteItemFromDynamoDB(multiMintTable, { userId: chatId, publicAddress: publicAddress }),
        bot.sendMessage(chatId, multiMintCancelMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'})
    ]);
}

/**
 * Handle completion of multi-mint, triggered by the multi-mint lambda
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} publicAddress Public address of the wallet used for multi-mint
 * @param {str} inscriptionData Inscription data used for multi-mint
 * @param {number} timesMinted
 */
export async function handleMultiMintComplete(chatId, publicAddress, inscriptionData, timesMinted) {
    const walletItem = await getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: publicAddress });
    const chainName = walletItem.chainName;
    const { p, tick, amt } = JSON.parse(inscriptionData.substring(22));
    
    const multiMintCompleteMessage = 
        `✅ Your multi-mint has been completed. You can start a new multi-mint.\n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Protocol: \`${p}\`\n` +
        `Ticker: \`${tick}\`\n` +
        `Times minted: \`${timesMinted}\`\n` +
        `Total amount: \`${amt * timesMinted}\``;

    await bot.sendMessage(chatId, multiMintCompleteMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown' });
}

/**
 * Multi-mint command: Handle the information provided in the multi-mint command and prompts review 
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} text Text of the command
 */
export async function handleMultiMintCommand(chatId, text) {
    const [_, protocol, ticker, amount, times] = text.split(' ');

    if (!protocol || !ticker || !amount || !times) {
        await bot.sendMessage(chatId, "⛔️ Please input the protocol, token ticker, amount, and times to mint in the format `/multimint <protocol> <ticker> <amount> <times>`.", { parse_mode: 'Markdown' });
        return;
    }

    else if (protocol !== 'ierc-20') {
        await bot.sendMessage(chatId, "⛔️ Only ierc-20 protocol is supported for the moment.");
        return;
    }

    else if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, "⛔️ Please input a valid amount.");
        return;
    }

    else if (Number.isNaN(times) || times <= 0) {
        await bot.sendMessage(chatId, "⛔️ Please choose or input a valid number.");
        return;
    }
    
    else if (times > 100) {
        await bot.sendMessage(chatId, "⛔️ The maximum multi-mint times is 100.");
        return;
    }

    const [publicAddress, currentGasPrice, ethPrice, multiMintItem] = await Promise.all([
        getWalletAddressByUserId(chatId),
        getCurrentGasPrice(),
        getEthPrice(),
        getItemFromDynamoDB(multiMintTable, { userId: chatId, publicAddress: publicAddress })
    ]);

    if (multiMintItem) {
        const data = JSON.parse(multiMintItem.inscriptionData.slice(22));

        const multiMintInProgressMessage = multiMintDescriptionMessage +
            `⚠️ You have a multi-mint in progress. Please wait for it to complete before starting a new one.\n` +
            `\n` +
            `Wallet: \`${publicAddress}\`\n` +
            `Protocol: \`${data.p}\`\n` +
            `Ticker: \`${data.tick}\`\n` +
            `Amount: \`${data.amt}\`\n` +
            `\n` +
            `Mint progress: \`${multiMintItem.timesMinted}/${multiMintItem.timesToMint}\``;

        const multiMintInProgressKeyboard = {
            inline_keyboard: [
                [
                    { text: "❌ Stop current multi-mint", callback_data: "multi_mint_stop" },
                ],
                [
                    { text: "🔄 Refresh", callback_data: "multi_mint_refresh" },
                    { text: "📃 Main menu", callback_data: "main_menu" }
                ]]
            };

        await bot.sendMessage(chatId, multiMintInProgressMessage, { reply_markup: multiMintInProgressKeyboard, parse_mode: 'Markdown' });
        return;
    }


    const walletItem = await getItemFromDynamoDB(walletTable, { userId: chatId, publicAddress: publicAddress });
    const chainName = walletItem.chainName;
    
    const data = `data:application/json,{"p":"${protocol}","op":"mint","tick":"${ticker}","amt":"${amount}","nonce":""}`;

    const estimatedGasCost = round(1e-9 * (currentGasPrice + 1) * (21000 + data.length * 16) * times, 8); // in ETH; + 1 to account for the priority fees
    const estimatedGasCostUsd = round(estimatedGasCost * ethPrice, 2);

    const multiMintReviewMessage =
        `⌛ Please review the multi-mint information below.` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Protocol: \`${protocol}\`\n` +
        `Ticker: \`${ticker}\`\n` +
        `Amount: \`${amount}\`\n` +
        `\n` +
        `The mint will be executed for \`${times}\` times.\n` +
        `\n` +
        `Current Gas Price: ${currentGasPrice} Gwei\n` +
        `Estimated Total Cost: ${estimatedGasCost} ETH (\$${estimatedGasCostUsd})`;

    const multiMintReviewKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "multi_mint_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    await Promise.all([
        editItemInDynamoDB(processTable, { userId: chatId }, { multiMintTimes: times, multiMintData: data }),
        editUserState(chatId, 'MULTI_MINT_TIMES_INPUTTED'),
        bot.sendMessage(chatId, multiMintReviewMessage, { reply_markup: multiMintReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}