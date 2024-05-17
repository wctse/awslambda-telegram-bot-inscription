import { sendEvmTransaction } from "../blockchains/evm/common/transactions.mjs";
import { getWalletItem, updateWalletLastActiveAt } from "../common/db/walletDb.mjs";
import { decrypt } from "../common/kms.mjs";
import { updateNonce } from "../common/utils.mjs";

export async function transactionRouter(chainName, privateKey, data = '', to = null, gasSetting = 'auto', amount = 0) {
    switch (chainName) {
        case 'Ethereum':
            return sendEvmTransaction(chainName, privateKey, data, to, gasSetting, amount);

        default:
            throw new Error('Chain not supported');
    }
}

export async function prepareTransaction(chatId, chainName, data) {
    const walletItem = await getWalletItem(chatId, chainName);
    const {encryptedPrivateKey, walletSettings: {gas}} = walletItem;

    if (!data | !data.includes("nonce")) {
        const privateKey = await decrypt(encryptedPrivateKey);
        return [privateKey, null, gas, walletItem];
    }

    const [privateKey, updatedData] = await Promise.all([
        decrypt(encryptedPrivateKey),
        updateNonce(data)
    ]);

    return [privateKey, updatedData, gas, walletItem];
}

export async function sendTransaction(chatId, chainName, data, to=null, amount=0) {
    const [privateKey, updatedData, gas, walletItem] = await prepareTransaction(chatId, chainName, data);

    const [txResponse, _] = await Promise.all([
        transactionRouter(chainName, privateKey, updatedData, to, gas, amount),
        updateWalletLastActiveAt(chatId, walletItem.publicAddress)
    ]);

    return txResponse;
}
