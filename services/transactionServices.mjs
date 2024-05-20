import { getWalletItem, updateWalletLastActiveAt } from "../common/db/walletDb.mjs";
import { decrypt } from "../common/kms.mjs";
import { camelCaseToWords, updateNonce } from "../common/utils.mjs";
import { sendEvmTransaction } from "../blockchains/evm/common/index.mjs";
import { sendTonTransaction } from "../blockchains/ton/index.mjs";
import { getExplorerUrl } from "./processServices.mjs";

export async function sendTransaction(chatId, chainName, data, to=null, amount=0) {
    // // For these chains, the transaction details are not immediately available after the transaction is sent; thus we need to update the transaction history
    // if (chainName in ['TON']) {
    //     await updateTxHistoryRouter(chatId, chainName);
    // }

    const [privateKey, updatedData, gas, walletItem] = await prepareTransaction(chatId, chainName, data);

    const [{txHash, txTimestamp}, _] = await Promise.all([
        transactionRouter(chainName, privateKey, updatedData, to, gas, amount),
        updateWalletLastActiveAt(chatId, walletItem.publicAddress)
    ]);

    return {txHash, txTimestamp};
}


async function transactionRouter(chainName, privateKey, data = '', to = null, gasSetting = 'auto', amount = 0) {
    switch (chainName) {
        case 'Ethereum':
            return await sendEvmTransaction(chainName, privateKey, data, to, gasSetting, amount);

        case 'TON':
            return await sendTonTransaction(privateKey, data, to, amount)

        default:
            throw new Error('Chain not supported');
    }
}

// async function updateTxHistoryRouter(chatId, chainName) {
//     switch (chainName) {
//         case 'TON':
//             return await updateTonTxHistory(chatId);

//         default:
//             throw new Error('Chain not supported');
//     }
// }

async function prepareTransaction(chatId, chainName, data) {
    const walletItem = await getWalletItem(chatId, chainName);
    const {encryptedPrivateKey, walletSettings: {gas}} = walletItem;

    if (!data || !data.includes("nonce")) {
        const privateKey = await decrypt(encryptedPrivateKey);
        return [privateKey, data, gas, walletItem];
    }

    const [privateKey, updatedData] = await Promise.all([
        decrypt(encryptedPrivateKey),
        updateNonce(data)
    ]);

    return [privateKey, updatedData, gas, walletItem];
}

export async function assembleTransactionSentMessage(chainName, txType, publicAddress=null, txHash=null) {
    if (!publicAddress && !txHash) {
        throw new Error('One of publicAddress or txType is required');
    }

    const txTypeWords = camelCaseToWords(txType);

    let message = 
        `🚀 Your ${txTypeWords} transaction has been sent to the blockchain.\n` +
        `\n`

    if (txHash) {
        const url = await getExplorerUrl(chainName, txHash);
        message += 
            `Transaction: [${txHash}](${url})\n` +
            `\n`
    } else {
        const url = await getExplorerUrl(chainName, publicAddress);
        message += 
            `Check your transactions: [${publicAddress}](${url})\n` +
            `\n`
    }

    message += `⏳ Please wait for the transaction to be confirmed. This may take a few minutes.`;

    return message;
}