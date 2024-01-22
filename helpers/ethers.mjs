import { ethers, isHexString, JsonRpcProvider } from 'ethers';
import { ZERO_ADDRESS } from '../constants.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const testnet = config.TESTNET

// TODO: Add fallback providers
const provider = 
    testnet ? new JsonRpcProvider(`https://ethereum-sepolia.publicnode.com`) :
    new JsonRpcProvider(`https://ethereum.publicnode.com`);

// TODO: Improve auto gas strategy
export const gasMapping = {
    'high': '1',
    'medium': '0.1',
    'low': '0',
};

export async function getTransactionInscription(transactionHash) {
    if (!isHexString(transactionHash, 32)) {
        throw new Error("Invalid transaction hash");
    }

    const transaction = await provider.getTransaction(transactionHash);
    const data = transaction.data;
    const text = ethers.utils.toUtf8String(data);
    return text;
}

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

export async function sendTransaction(privateKey, data, to = null, gasSetting = 'auto') {
    const wallet = new ethers.Wallet(privateKey, provider);
    if (!to) {
        to = wallet.address;
    } else if (to === 'zero') {
        to = ZERO_ADDRESS;
    }

    // Explicitly get the fee data to avoid maxFeePerGas being set to 0 when maxPriorityFeePerGas is specified, when gasSetting is not 'auto'
    const feeData = await provider.getFeeData();
    console.debug(feeData)

    const transaction = gasSetting === 'auto' ? 
    {
        to: to,
        value: ethers.parseEther('0.0'),
        data: ethers.hexlify(ethers.toUtf8Bytes(data)),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    } :
    {   
        to: to,
        value: ethers.parseEther('0.0'),
        data: ethers.hexlify(ethers.toUtf8Bytes(data)),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: ethers.parseUnits(gasMapping[gasSetting], 'gwei'),
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