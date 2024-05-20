import { getWalletAddress } from "../../common/db/walletDb.mjs";
import { getTonBalance } from "./utils.mjs";
import { getTonfura } from "./tonfura.mjs";

// TODO Add logic with estimateFee()
export async function validateTonEnoughBalance(chatId, chainName, data, return_numbers, decimals) {
    const publicAddress = await getWalletAddress(chatId, chainName)
    const balance = await getTonBalance(publicAddress, chainName);
    
    if (balance < 1e9) {
        return false;
    }

    return true;
}

/**
 * Use the getTransactions method from the TonClient to validate a TON address.
 * 
 * @param {str} address
 * @returns {bool} true if the address is valid, false otherwise 
 */
export async function validateTonAddress(address) {
    const tonfura = getTonfura();
    try {
        const response = await tonfura.core.getAddressState(address);
        const state = response['data']['result'];

        console.log(`validateTonAddress ${address} ${state}`);

        if (state == 'active') {
            return true;
        }

        return false;

    } catch (error) {
        console.log(`validateTonAddress error: ${address} on ${error}`);
        return false;
    }
}

export async function validateAddressInitialized(address) {
    const tonfura = getTonfura();

    const response = await tonfura.core.getAddressState(address);
    const state = response['data']['result'];

    return state == 'active';
}