import { mnemonicWordList } from 'ton-crypto';
import { getEvmAddressFromPrivateKey, getEvmPrivateKeyFromMnemonic, validateEvmPrivateKey } from '../../blockchains/evm/common/wallets.mjs';


export function getPrivateKeyFromMnemonic(chainName, mnemonic) {
    switch (chainName) {
        case "Ethereum":
            return getEvmPrivateKeyFromMnemonic(mnemonic);

        default:
            throw new Error(`getPrivateKeyFromMnemonic: Chain ${chainName} not supported`);
    }
}
export function getAddressFromPrivateKey(chainName, privateKey) {
    switch (chainName) {
        case "Ethereum":
            return getEvmAddressFromPrivateKey(privateKey);

        default:
            throw new Error(`getAddressFromPrivateKey: Chain ${chainName} not supported`);
    }
}
export function validateMnemonic(mnemonic) {
    // Check if there are 12 or 24 words
    const mnemonicWords = mnemonic.split(' ');

    if (mnemonicWords.length !== 12 && mnemonicWords.length !== 24) {
        return false;
    }

    // Check if the words are in the word list
    const wordInList = mnemonicWords.every(word => mnemonicWordList.includes(word));
    if (!wordInList) {
        return false;
    }

    return true;
}


export function validatePrivateKey(chainName, privateKey) {
    switch (chainName) {
        case "Ethereum":
            return validateEvmPrivateKey(privateKey);

        default:
            throw new Error(`validatePrivateKey: Chain ${chainName} not supported`);
    }
}
