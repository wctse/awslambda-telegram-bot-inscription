import { ethers } from 'ethers';

export async function createEvmWallet() {
    const wallet = ethers.Wallet.createRandom();
    const publicAddress = wallet.address;
    const privateKey = wallet.privateKey;

    return {publicAddress, privateKey}
}