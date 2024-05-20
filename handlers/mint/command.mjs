import { bot, mainMenuKeyboard } from '../../common/bot.mjs';
import { editItemInDb  } from '../../common/db/dbOperations.mjs';
import { editUserState, getCurrentChain } from '../../common/db/userDb.mjs';
import { assembleData, getAssetBalance, getNotEnoughBalanceMessage, getUnits, validateAmount, validateEnoughBalance } from '../../services/processServices.mjs';
import { mintDescriptionMessage } from './constants.mjs';

const processTable = process.env.PROCESS_TABLE_NAME;

/**
 * Mint command: Handle the information provided in the mint command and prompts review
 * 
 * @param {*} chatId Telegram user ID
 * @param {*} text Command message
 */
export async function handleMintCommand(chatId, text) {
    const chainName = await getCurrentChain(chatId);
    const [ assetBalance, publicAddress ] = await getAssetBalance(chatId, chainName, true);
    const [assetName, _gasUnitName] = await getUnits(chainName);

    if (assetBalance == 0) {
        const noAssetMessage = mintDescriptionMessage + 
            `⚠️ You don't have any ${assetName} in your wallet. Please transfer some ${assetName} to your wallet first.`;
        
        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown'});
        return;
    }
    
    const [_command, protocol, ticker, amount] = text.split(' ');

    if (!(await validateAmount(amount))) {
        await bot.sendMessage(chatId, "⚠️ Please input a valid number.");
        return;
    }

    const data = await assembleData(chainName, protocol, 'mint', { protocol, ticker, amount })

    const [hasEnoughBalance, [_assetBalance, currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, data, true, [null, 0, 4, 2]);

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
        editItemInDb(processTable, { userId: chatId }, {
            mintChain: chainName,
            mintWallet: publicAddress,
            mintAmount: amount,
            mintData: data,
            mintReviewPromptedAt: Date.now(),
            mintGasPrice: currentGasPrice
        }),
        editUserState(chatId, 'MINT_AMOUNT_INPUTTED'),
        bot.sendMessage(chatId, mintReviewMessage, { reply_markup: mintReviewKeyboard, parse_mode: 'Markdown' })
    ]);
}