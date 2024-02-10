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

/**
 * Sends a transaction to the blockchain.
 * @param {str} privateKey Private key of the wallet sending the transaction
 * @param {str} data Inscription data in utf8 (normal text) format. Default is an empty string.
 * @param {str} to Public address of the recipient. If null, the transaction will be sent to the wallet itself. Default is null.
 * @param {str} gasSetting Gas setting for the transaction. Can be 'auto', 'high', 'medium', 'low', or a custom value in Gwei. Default is 'auto'.
 * @param {num} amount Amount of ETH to send. Default is 0.
 * @returns 
 */
export async function sendTransaction(privateKey, data = '', to = null, gasSetting = 'auto', amount = 0) {
    const wallet = new ethers.Wallet(privateKey, provider);
    if (!to) {
        to = wallet.address;
    } else if (to === 'zero') {
        to = ZERO_ADDRESS;
    }

    const hexData = ethers.hexlify(ethers.toUtf8Bytes(data)); // Evaluates to '0x' if data is an empty string
    let maxFeePerGas = (await provider.getFeeData()).maxFeePerGas; // Explicitly get the fee data to avoid maxFeePerGas being set to 0 when maxPriorityFeePerGas is specified

    let customPriorityFeePerGas;

    if (gasSetting != 'auto') {
        customPriorityFeePerGas = ethers.parseUnits(gasMapping[gasSetting], 'gwei');
        if (customPriorityFeePerGas > maxFeePerGas) {
            maxFeePerGas = customPriorityFeePerGas;
        }
    }

    console.debug(customPriorityFeePerGas, maxFeePerGas, gasSetting, gasMapping[gasSetting])

    const transaction = {
        to: to,
        value: ethers.parseEther(amount.toString()),
        data: hexData,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: gasSetting === 'auto' ? feeData.maxPriorityFeePerGas : customPriorityFeePerGas
    }
    
    try {
        const txResponse = await wallet.sendTransaction(transaction);
        console.info('Transaction sent:', txResponse);
        return txResponse;

    } catch (error) {
        console.error('Error sending transaction:', error);
        throw error;
    }
}