import { bot, cancelMainMenuKeyboard, divider, mainMenuKeyboard } from "../common/bot.mjs";
import { deleteItemFromDb, editItemInDb, getItemFromDb } from "../common/db/dbOperations.mjs";
import { getWalletAddress } from '../common/db/walletDb.mjs';
import { editUserState, getCurrentChain } from '../common/db/userDb.mjs';
import { assembleData, getAssetBalance, getInscriptionListPageMessage, getInscriptionTokenPageMessage, getNotEnoughBalanceMessage, getProtocols, getUnits, validateAmount, validateEnoughBalance } from "../services/processServices.mjs";
import { round } from "../common/utils.mjs";

const walletTable = process.env.WALLET_TABLE_NAME;
const processTable = process.env.PROCESS_TABLE_NAME;
const multiMintTable = process.env.MULTI_MINT_TABLE_NAME;

/**
 * Multi-mint step 1: Handle initiation and prompts the user to choose the protocol to mint in
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMultiMintInitiate(chatId) {
    const chainName = await getCurrentChain(chatId);

    if (!(chainName in ['Ethereum'])) {
        await bot.sendMessage(chatId, `⚠️ Multi-mint not yet supported on ${chainName}.`, { reply_markup: mainMenuKeyboard });
        return;
    }

    const [assetBalance, publicAddress] = await getAssetBalance(chatId, chainName, true)
    const supportedProtocols = await getProtocols(chainName);
    const [assetName, _gasUnitName] = await getUnits(chainName);

    const multiMintItem = await getItemFromDb(multiMintTable, { userId: chatId, publicAddress: publicAddress });

    const multiMintDescriptionMessage = 
        "📚 *Multi-mint*\n" +
        "\n" +
        "This feature mints new inscription tokens that was deployed for a set amount of times, saving precious time for you. \n" +
        divider +
        "\n";

    if (assetBalance == 0) {
        const noAssetMessage = multiMintDescriptionMessage + 
            `⚠️ You don't have any ${assetName} in your wallet. Please transfer some ${assetName} to your wallet first.`;
        
        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown' });
        return;
    }

    // Multiple multi-mint progresses are not supported as they may conflict and be invalid
    if (multiMintItem) {
        const data = JSON.parse(multiMintItem.inscriptionData.slice(22));

        const multiMintInProgressMessage = multiMintDescriptionMessage +
            `⚠️ You have a multi-mint in progress. Please wait for it to complete before starting a new one.\n` +
            `\n` +
            `Wallet: \`${publicAddress}\`\n` +
            `Chain: \`${chainName}\`\n` +
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
        supportedProtocols.map(supportedProtocol => [{ text: supportedProtocol, callback_data: `multi_mint_protocol_${supportedProtocol}` }]).flat(),
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]};

    await Promise.all([
        editUserState(chatId, 'MULTI_MINT_INITIATED'),
        editItemInDb(processTable, { userId: chatId }, { multiMintWallet: publicAddress, multiMintChain: chainName }),
        bot.sendMessage(chatId, multiMintProtocolInputMessage, { reply_markup: multiMintProtocolInputKeyboard, parse_mode: 'Markdown'})
    ]);
}


/**
 * Multi-mint step 2: Handle input of the protocol to mint in and prompts the user to input the token ticker
 * 
 * @param {number} chatId Telegram user ID 
 * @param {str} protocol Protocol of the token to mint
 */
export async function handleMultiMintProtocolInput(chatId, protocol) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.multiMintChain;

    let multiMintTokenInputMessage = 
        `✅ You have chosen \`${protocol}\` as the protocol. \n` +
        `\n` +
        `👇 Please input the token ticker.\n`
        
    multiMintTokenInputMessage += `\n` + await getInscriptionListPageMessage(chainName, protocol);

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { multiMintProtocol: protocol }),
        editUserState(chatId, 'MULTI_MINT_PROTOCOL_INPUTTED'),
        bot.sendMessage(chatId, multiMintTokenInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Multi-mint step 3: Handle input of the token ticker and prompts the user to input the amount to mint
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} ticker Ticker of the token to mint
 */
export async function handleMultiMintTickerInput(chatId, ticker) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.multiMintChain;
    const protocol = processItem.multiMintProtocol;

    let multiMintAmountInputMessage =
        `✅ You have chosen \`${ticker}\` as the token ticker.\n` +
        `\n` +
        `👇 Please input the amount to mint each time. Do not exceed the minting limit.\n`
    
    multiMintAmountInputMessage += `\n` + await getInscriptionTokenPageMessage(chainName, protocol, ticker);

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { multiMintTicker: ticker }),
        editUserState(chatId, 'MULTI_MINT_TICKER_INPUTTED'),
        bot.sendMessage(chatId, multiMintAmountInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Multi-mint step 4: Handle input of the mint amount each time and prompts the user to input the times to mint
 * 
 * @param {number} chatId Telegram user ID
 * @param {number} amount Amount to mint each time
 */
export async function handleMultiMintAmountInput(chatId, amount) {
    if (!(await validateAmount(amount))) {
        await bot.sendMessage(chatId, "⚠️ Please input a valid number.");
        return;
    }

    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.multiMintChain;
    const protocol = processItem.multiMintProtocol;
    const ticker = processItem.multiMintTicker;

    let multiMintTimesInputMessage =
        `✅ You have specified to mint \`${amount}\` tokens each time.\n` +
        `\n` +
        `👇 Please input or choose the amount of times to mint. Be careful that tokens minted beyond the limit per address would be invalid.\n`

    multiMintTimesInputMessage += `\n` + getInscriptionTokenPageMessage(chainName, protocol, ticker);

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

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { multiMintAmount: amount }),
        editUserState(chatId, 'MULTI_MINT_AMOUNT_INPUTTED'),
        bot.sendMessage(chatId, multiMintTimesInputMessage, { reply_markup: multiMintTimesInputKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Multi-mint step 5: Handle input of the times to mint and prompts the user to confirm the multi-mint.
 * 
 * @param {number} chatId Telegram user ID
 * @param {str} times Amount to mint each time
 */
export async function handleMultiMintTimesInput(chatId, times) {
    times = Number(times)

    if (!(await validateAmount(times)) || !(Number.isInteger(times))) {
        await bot.sendMessage(chatId, "⚠️ Please choose or input a valid integer.");
        return;
    }
    
    else if (times > 100) {
        await bot.sendMessage(chatId, "⚠️ The maximum multi-mint times is 100.");
        return;
    }

    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const publicAddress = processItem.multiMintWallet;
    const chainName = processItem.multiMintChain;

    const protocol = processItem.multiMintProtocol;
    const ticker = processItem.multiMintTicker;
    const amount = processItem.multiMintAmount;

    const data = await assembleData(chainName, protocol, 'mint', { protocol, ticker, amount });
    const [assetName, _gasUnitName] = await getUnits(chainName);
    
    let [hasEnoughBalance, [_assetBalance, _currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, data, true, [null, 0, 4, 2]);

    txCost = txCost * times;
    txCostUsd = txCostUsd * times;

    let multiMintReviewMessage =
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
        `Estimated Total Cost: ${txCost} ETH (\$${txCostUsd})`;

    if (!hasEnoughBalance) {
        multiMintReviewMessage += await getNotEnoughBalanceMessage(chainName, assetName);
    }

    const multiMintReviewKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "multi_mint_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { multiMintTimes: times, multiMintData: data }),
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
    const processItem = await getItemFromDb(processTable, { userId: chatId });

    const publicAddress = processItem.multiMintWallet;
    const multiMintData = processItem.multiMintData;
    const multiMintTimes = processItem.multiMintTimes;

    const multiMintItem = {
        inscriptionData: multiMintData,
        timesMinted: 0,
        timesToMint: multiMintTimes,
        lastMintedBlock: 0,
        initiatedAt: Date.now(),
    };

    const multiMintConfirmMessage = "✅ Your multi-mint has been submitted. You will be notified when it is completed.";

    await Promise.all([
        editItemInDb(multiMintTable, { userId: chatId, publicAddress: publicAddress }, multiMintItem),
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
    const chainName = await getCurrentChain(chatId);
    const publicAddress = await getWalletAddress(chatId, chainName);
    const multiMintItem = await getItemFromDb(multiMintTable, { userId: chatId, publicAddress: publicAddress });

    if (!multiMintItem) {
        await bot.sendMessage(chatId, "⚠️ You don't have a multi-mint in progress.", { reply_markup: mainMenuKeyboard });
        return;
    }

    const { inscriptionData, timesMinted, timesToMint } = multiMintItem;
    const { p, tick, amt } = JSON.parse(inscriptionData.substring(22));

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
        deleteItemFromDb(multiMintTable, { userId: chatId, publicAddress: publicAddress }),
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
    const walletItem = await getItemFromDb(walletTable, { userId: chatId, publicAddress: publicAddress });
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

    else if (!(await validateAmount(amount))) {
        await bot.sendMessage(chatId, "⛔️ Please input a valid amount.");
        return;
    }

    else if (!(await validateAmount(times)) || !(Number.isInteger(times))) {
        await bot.sendMessage(chatId, "⛔️ Please choose or input a valid multi-mint times.");
        return;
    }
    
    else if (times > 100) {
        await bot.sendMessage(chatId, "⛔️ The maximum multi-mint times is 100.");
        return;
    }

    const chainName = await getCurrentChain(chatId);
    const [assetBalance, publicAddress] = await getAssetBalance(chatId, chainName, true)
    const [assetName, _gasUnitName] = await getUnits(chainName);

    const multiMintItem = await getItemFromDb(multiMintTable, { userId: chatId, publicAddress: publicAddress });

    const multiMintDescriptionMessage = 
        "📚 *Multi-mint*\n" +
        "\n" +
        "This feature mints new inscription tokens that was deployed for a set amount of times, saving precious time for you. \n" +
        divider +
        "\n";

    if (assetBalance == 0) {
        const noAssetMessage = multiMintDescriptionMessage + 
            `⚠️ You don't have any ${assetName} in your wallet. Please transfer some ${assetName} to your wallet first.`;
        
        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown' });
        return;
    }

    // Multiple multi-mint progresses are not supported as they may conflict and be invalid
    if (multiMintItem) {
        const data = JSON.parse(multiMintItem.inscriptionData.slice(22));

        const multiMintInProgressMessage = multiMintDescriptionMessage +
            `⚠️ You have a multi-mint in progress. Please wait for it to complete before starting a new one.\n` +
            `\n` +
            `Wallet: \`${publicAddress}\`\n` +
            `Chain: \`${chainName}\`\n` +
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
    
    const data = await assembleData(chainName, protocol, 'mint', { protocol, ticker, amount });
    
    let [hasEnoughBalance, [_assetBalance, _currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, data, true, [null, 0, null, null]);

    txCost = round(txCost * times, 4);
    txCostUsd = round(txCostUsd * times, 2);

    let multiMintReviewMessage =
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
        `Estimated Total Cost: ${txCost} ETH (\$${txCostUsd})`;

    if (!hasEnoughBalance) {
        multiMintReviewMessage += await getNotEnoughBalanceMessage(chainName, assetName);
    }

    const multiMintReviewKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "multi_mint_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { multiMintTimes: times, multiMintData: data }),
        editUserState(chatId, 'MULTI_MINT_TIMES_INPUTTED'),
        bot.sendMessage(chatId, multiMintReviewMessage, { reply_markup: multiMintReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}