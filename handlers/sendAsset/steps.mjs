import { bot, cancelMainMenuKeyboard, mainMenuKeyboard } from "../../common/bot.mjs";
import { editItemInDb, getItemFromDb } from "../../common/db/dbOperations.mjs";
import { editUserState, getCurrentChain } from "../../common/db/userDb.mjs";
import { getAssetBalance, getNotEnoughBalanceMessage, getUnits, validateAddress, validateAmount, validateEnoughBalance } from "../../services/processServices.mjs";

const processTable = process.env.PROCESS_TABLE_NAME;

/**
 * Send Asset step 1: Handle initiation and prompts the user to input the recipient's public address.
 * 
 * @param {number} chatId 
 */
export async function handleSendAssetInitiate(chatId) {
    const chainName = await getCurrentChain(chatId);
    const [[assetBalance, publicAddress], [assetName, _]] = await Promise.all([
        getAssetBalance(chatId, chainName, true),
        getUnits(chainName)
    ]);

    const sendAssetDescriptionMessage = 
        `💸 *Send Asset*\n` +
        `\n` +
        `This feature allows you to send assets from this wallet to another.\n` +
        `\n` +
        `Your current balance on ${chainName}: \`${assetBalance}\` ${assetName}\n` +
        `\n`;

    if (assetBalance === 0) {
        const noAssetMessage = sendAssetDescriptionMessage +
            `⚠️ You don't have any ${assetName} in your wallet.`;

        await bot.sendMessage(chatId, noAssetMessage, { reply_markup: mainMenuKeyboard, parse_mode: 'Markdown' });
        return;
    }

    const sendAssetRecipientInputMessage = sendAssetDescriptionMessage +
        `👇 Enter the recipient's public address:`;

    await Promise.all([
        editUserState(chatId, "SEND_ASSET_INITIATED"),
        editItemInDb(processTable, { userId: chatId }, { sendAssetChain: chainName, sendAssetWallet: publicAddress }),
        bot.sendMessage(chatId, sendAssetRecipientInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' })
    ]);
}

/**
 * Send Asset step 2: Handle the recipient's public address input and prompts the user to input the amount to send.
 * 
 * @param {number} chatId 
 * @param {str} recipient 
 */
export async function handleSendAssetRecipientInput(chatId, recipient) {
    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const chainName = processItem.sendAssetChain;
    const [assetName, _gasUnitName] = await getUnits(chainName);

    if (!(await validateAddress(recipient, chainName))) {
        await bot.sendMessage(chatId, "⛔️ Invalid address. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        return;
    }

    const sendAssetAmountInputMessage = 
        `👇 Enter the amount of ${assetName} to send to \`${recipient}\`:`;

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { sendAssetRecipient: recipient }),
        editUserState(chatId, "SEND_ASSET_RECIPIENT_INPUTTED"),
        bot.sendMessage(chatId, sendAssetAmountInputMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown'})
    ]);
}

/**
 * Send Asset step 3: Handle the amount input and prompts the user to review the transaction information.
 * 
 * @param {number} chatId 
 * @param {number} amount 
 */
export async function handleSendAssetAmountInput(chatId, amount) {
    if (!(await validateAmount(amount))) {
        await bot.sendMessage(chatId, "⛔️ Invalid amount. Please try again.", { reply_markup: cancelMainMenuKeyboard });
        return;
    }

    const processItem = await getItemFromDb(processTable, { userId: chatId });
    const publicAddress = processItem.sendAssetWallet;
    const chainName = processItem.sendAssetChain;
    const recipient = processItem.sendAssetRecipient;
    
    const [hasEnoughBalance, [assetBalance, currentGasPrice, txCost, txCostUsd]] = await validateEnoughBalance(chatId, chainName, '', true, [null, 0, 4, 2]);
    const [assetName, _] = await getUnits(chainName);

    if (!hasEnoughBalance) {
        const notEnoughAssetMessage = `⚠️ You only have \`${assetBalance}\` ${assetName} in your wallet. Please enter an amount less than your balance.`;
        await bot.sendMessage(chatId, notEnoughAssetMessage, { reply_markup: cancelMainMenuKeyboard, parse_mode: 'Markdown' });
        return;
    }


    let sendAssetReviewMessage = 
        `⌛ Please review the transaction information below. \n` +
        `\n` +
        `Wallet: \`${publicAddress}\`\n` +
        `Chain: \`${chainName}\`\n` +
        `Recipient: \`${recipient}\`\n` +
        `Amount: ${amount} ${assetName}\n` +
        `\n`
    
    if (txCost && txCostUsd) {
        sendAssetReviewMessage += `Estimated Cost: ${txCost} ${assetName} (\$${txCostUsd})`;
    }

    if (!(hasEnoughBalance)) {
        sendAssetReviewMessage += await getNotEnoughBalanceMessage(chainName, assetName);
    }

    sendAssetReviewMessage += "\n\n" +
        "☝️ Please confirm the information in 1 minute:";

    const sendAssetConfirmationKeyboard = {
        inline_keyboard: [
            [
                { text: "✅ Confirm", callback_data: "send_asset_confirm" },
                { text: "❌ Cancel and Main Menu", callback_data: "cancel_main_menu" }
            ]
        ]
    };

    await Promise.all([
        editItemInDb(processTable, { userId: chatId }, { sendAssetAmount: amount, sendAssetReviewPromptedAt: Date.now(), sendAssetGasPrice: currentGasPrice }),
        editUserState(chatId, "SEND_ASSET_AMOUNT_INPUTTED"),
        bot.sendMessage(chatId, sendAssetReviewMessage, { reply_markup: sendAssetConfirmationKeyboard, parse_mode: 'Markdown'})
    ]);
}