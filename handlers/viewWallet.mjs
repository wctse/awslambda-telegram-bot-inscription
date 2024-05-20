import { balanceCalculationMessage, bot } from '../common/bot.mjs';
import { getAssetBalanceUsd, getInscriptionBalance, getUnits } from '../services/processServices.mjs';
import { getCurrentChain } from '../common/db/userDb.mjs';

export async function handleViewWallet(chatId) {
    const chainName = await getCurrentChain(chatId);
    const [[assetBalance, assetBalanceUsd, publicAddress], [assetName, _gasUnitName]] = await Promise.all([
        getAssetBalanceUsd(chatId, chainName, [4, 2], true),
        getUnits(chainName),
    ]);

    let viewWalletMessage = 
        `Wallet information:\n` +
        `\n` +
        `Chain: \`${chainName}\`\n` +
        `Address: \`${publicAddress}\`\n` +
        `Asset Balance: ${assetBalance} ${assetName} (\$${assetBalanceUsd})\n` +
        `\n`;

    const inscriptionBalances = await getInscriptionBalance(chatId, publicAddress, chainName);

    const protocolSections = Object.entries(inscriptionBalances).map(([protocol, protocolObj]) => {
        const tickerBalances = Object.entries(protocolObj)
            .map(([ticker, balance]) => `${ticker}: \`${balance}\``)
            .join('\n');
  
        return tickerBalances.length > 0
            ? `*${protocol} Balances*\n${tickerBalances}`
            : `*${protocol} Balances*\nYou have no ${protocol} tokens in the wallet.`;
    }).join('\n\n');

    viewWalletMessage += protocolSections;
    
    if (chainName in ['Ethereum']) {
        viewWalletMessage += balanceCalculationMessage;
    }

    const viewWalletKeyboard = {
        inline_keyboard: [[
            { text: "📃 Main menu", callback_data: "main_menu" },
            { text: "🔄 Refresh", callback_data: "refresh_view_wallet" }
        ]]
    };

    await bot.sendMessage(chatId, viewWalletMessage, { parse_mode: 'Markdown', reply_markup: viewWalletKeyboard });
}