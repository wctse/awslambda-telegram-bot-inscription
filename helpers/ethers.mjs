import { ethers, JsonRpcProvider } from 'ethers';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

// TODO: Add fallback providers
const provider = 
    config.TESTNET ? new JsonRpcProvider(`https://ethereum-sepolia.publicnode.com`) :
    new JsonRpcProvider(`https://ethereum.publicnode.com`);

export async function getEthBalance(publicAddress) {
    try {
        const balance = await provider.getBalance(publicAddress);
        return ethers.formatEther(balance); // Converts the balance from Wei to Ether
    } catch (error) {
        console.error('Error getting ETH balance:', error);
        throw error;
    }
}

export async function getCurrentGasPrice() {
    try {
        const feeData = await provider.getFeeData();
        return ethers.formatUnits(feeData.gasPrice, 'gwei'); 
    } catch (error) {
        console.error('Error getting current gas price:', error);
        throw error;
    }
}

export async function sendTransaction(privateKey, data) {
    const wallet = new ethers.Wallet(privateKey, provider);

    const transaction = {
        to: wallet.address,
        value: ethers.parseEther('0.0'),
        data: ethers.hexlify(ethers.toUtf8Bytes(data))
    };

    try {
        const txResponse = await wallet.sendTransaction(transaction);
        console.info('Transaction sent:', txResponse);
        return txResponse;

    } catch (error) {
        console.error('Error sending transaction:', error);
        throw error;
    }
}