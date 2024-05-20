import { bot, mainMenuKeyboard, cancelMainMenuKeyboard, divider } from '../../common/bot.mjs';
import { getItemFromDb, editItemInDb  } from '../../common/db/dbOperations.mjs';
import { editUserState, getCurrentChain } from '../../common/db/userDb.mjs';
import { assembleData, getInscriptionListPageMessage, getInscriptionTokenPageMessage, getNotEnoughBalanceMessage, getProtocols, getUnits, validateAmount, validateEnoughBalance } from '../../services/processServices.mjs';
import { getAssetBalance } from '../../services/processServices.mjs';
import { mintDescriptionMessage } from './constants.mjs';

const processTable = process.env.PROCESS_TABLE_NAME;

/**
 * Mint step 1: Handle initiation and prompts the user to choose the protocol to mint in
 * 
 * @param {number} chatId Telegram user ID
 */
export async function handleMintInitiate(chatId) {
    const chainName = await getCurrentChain(chatId);
    const supportedProtocols = await getProtocols(chainName);
    const [assetBalance, publicAddress] = await getAssetBalance(chatId, chainName, true);
    const [assetName, _gasUnitName] = await getUnits(chainName);

    if (assetBalance == 0) {
        const noAssetMessage = mintDescriptionMessage + 
            `⚠️ You don't have any ${assetName} in your wallet. Please transfer some ${assetName} to your wallet first.`;
        
        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'});
        return;
    }

    const mintProtocolInputMessage = mintDescriptionMessage + 
        "Please choose the protocol to use, or input the whole inscription data directly.";

    const mintProtocolInputKeyboard = {
        inline_keyboard:
        [
            supportedProtocols.map(protocol => [{text: protocol, callback_data: `mint_protocol_${protocol}`}]).flat(),
            [
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]    
        ]
    };

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
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.mintChain;

    let mintTokenInputMessage = 
        `✅ You have chosen \`${protocol}\` as the protocol. \n` +
        `\n` +
        `👇 Please input the token ticker.\n`
    
    mintTokenInputMessage += `\n` + await getInscriptionListPageMessage(chainName, protocol);

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
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.mintChain;
    const protocol = processItem.mintProtocol;

    let mintAmountInputMessage =
        `✅ You have chosen \`${ticker}\` as the token ticker.\n` +
        `\n` +
        `👇 Please input the amount to mint. Do not exceed the minting limit.\n` +
        `\n`
    
    mintAmountInputMessage += await getInscriptionTokenPageMessage(chainName, protocol, ticker);

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
        `\n`
    
    if (txCost && txCostUsd) {
        mintReviewMessage += `Estimated Cost: ${txCost} ${assetName} (\$${txCostUsd})`;
    }

    if (!hasEnoughBalance) {
        mintReviewMessage += await getNotEnoughBalanceMessage(chainName, assetName);
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