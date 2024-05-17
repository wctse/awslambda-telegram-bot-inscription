import { ethers } from 'ethers';

export async function createEvmWallet() {
    const wallet = ethers.Wallet.createRandom();
    const publicAddress = wallet.address;
    const privateKey = wallet.privateKey;

    return {publicAddress, privateKey};
}

export function getEvmPrivateKeyFromMnemonic(mnemonic) {
    return ethers.Wallet.fromPhrase(mnemonic).privateKey;
}

export function getEvmAddressFromPrivateKey(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
}

export function validateEvmPrivateKey(privateKey) {
    // Custom validation rather than isHexString() for private key to cater for the case of having no 0x prefix
    return (privateKey.length == 64 || privateKey.length == 66) && privateKey.match(/^[0-9a-fx]+$/);
}