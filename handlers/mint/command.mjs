import { bot } from '../../common/bot.mjs';
import { editItemInDb  } from '../../common/db/dbOperations.mjs';
import { editUserState, getCurrentChain } from '../../common/db/userDb.mjs';
import { assembleData, getAssetBalance, getUnits, validateAmount, validateEnoughBalance } from '../../services/processServices.mjs';

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

    if (assetBalance == 0) {
        const noAssetMessage = mintDescriptionMessage + 
            "⚠️ You don't have any ETH in your wallet. Please transfer some ETH to your wallet first.";
        
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