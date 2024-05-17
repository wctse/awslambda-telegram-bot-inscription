import { bot, mainMenuKeyboard, cancelMainMenuKeyboard, divider } from '../../common/bot.mjs';
import { getItemFromDb, editItemInDb  } from '../../common/db/dbOperations.mjs';
import { editUserState, getCurrentChain } from '../../common/db/userDb.mjs';
import { assembleData, getProtocols, getUnits, validateAmount, validateEnoughBalance } from '../../services/processServices.mjs';
import { getAssetBalance } from '../../services/processServices.mjs';

const processTable = process.env.PROCESS_TABLE_NAME;

/**
 * Mint step 1: Handle initiation and prompts the user to choose the protocol to mint in
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMintInitiate(chatId) {
    const chainName = await getCurrentChain(chatId);
    const supportedProtocols = await getProtocols(chainName);
    const [ assetBalance, publicAddress ] = await getAssetBalance(chatId, chainName, true);

    const mintDescriptionMessage = 
        "✍️ *Mint*\n" +
        "\n" +
        "This feature mints new inscription tokens that was deployed. \n" +
        divider +
        "\n";

    if (assetBalance == 0) {
        const noAssetMessage = mintDescriptionMessage + 
            "⚠️ You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.";
        
        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'});
        return;
    }

    const mintProtocolInputMessage = mintDescriptionMessage + 
        "Please choose the protocol to use, or input the whole inscription data directly.";

    const mintProtocolInputKeyboard = {
        inline_keyboard: [
        supportedProtocols.map(supportedProtocol => [{ text: supportedProtocol, callback_data: `multi_mint_protocol_${supportedProtocol}` }]).flat(),
        [
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]    
    ]};

    await Promise.all([
        editUserState(chatId, 'MINT_INITIATED'),
        editItemInDb(processTable, { userId: chatId }, { mintChain: chainName, mintWallet: publicAddress }),
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
        editItemInDb(processTable, { userId: chatId }, { mintProtocol: protocol }),
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
        editItemInDb(processTable, { userId: chatId }, { mintTicker: ticker }),
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
    if (!(await validateAmount(amount))) {
        await bot.sendMessage(chatId, "⚠️ Please input a valid number.");
        return;
    }

    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const publicAddress = processItem.mintWallet;
    const chainName = processItem.mintChain;
    const protocol = processItem.mintProtocol;
    const ticker = processItem.mintTicker;

    const data = await assembleData(chainName, protocol, 'mint', { protocol, ticker, amount })

    const [hasEnoughBalance, [_assetBalance, currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, data, true, [null, 0, 4, 2]);
    const [assetName, _gasUnitName] = await getUnits(chainName);

    let mintReviewMessage = 
        `⌛ Please review the inscription information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Protocol: \`${protocol}\`\n` +
        `Ticker: \`${ticker}\`\n` +
        `Amount: \`${amount}\`\n` +
        `\n` +
        `Estimated Cost: ${txCost} ${assetName} (\$${txCostUsd})`;

    if (!hasEnoughBalance) {
        mintReviewMessage += "\n\n" +    
            `⛔ WARNING: The ${assetName} balance in the wallet is insufficient for the estimated transaction cost. You can still proceed, but the transaction is likely to fail. ` +
            `Please consider waiting for the transaction price to drop, or transfer more ${assetName} to the wallet.`;
    }

    mintReviewMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const mintReviewKeyboard = {
        inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "mint_confirm" },
            { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
        ]]
    };

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { mintAmount: amount, mintData: data, mintReviewPromptedAt: Date.now(), mintGasPrice: currentGasPrice }),
        editUserState(chatId, 'MINT_AMOUNT_INPUTTED'),
        bot.sendMessage(chatId, mintReviewMessage, { reply_markup: mintReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}