import { ethers } from 'ethers';
import { ZERO_ADDRESS } from '../../../common/constants.mjs';
import { gasMapping } from './constants.mjs';
import { getProvider } from './providers.mjs';

/**
 * Sends a transaction to the blockchain.
 * @param {str} privateKey Private key of the wallet sending the transaction
 * @param {str} data Inscription data in utf8 (normal text) format. Default is an empty string.
 * @param {str} to Public address of the recipient. If null, the transaction will be sent to the wallet itself. Default is null.
 * @param {str} gasSetting Gas setting for the transaction. Can be 'auto', 'high', 'medium', 'low', or a custom value in Gwei. Default is 'auto'.
 * @param {num} amount Amount of ETH to send. Default is 0.
 * @returns 
 */
export async function sendEvmTransaction(chainName, privateKey, data = '', to = null, gasSetting = 'auto', amount = 0) {
    const provider = getProvider(chainName);
    const wallet = new ethers.Wallet(privateKey, provider);
    data = data ? data : '';

    if (!to) {
        to = wallet.address;
    } else if (to === 'zero') {
        to = ZERO_ADDRESS;
    }

    const hexData = ethers.hexlify(ethers.toUtf8Bytes(data)); // Evaluates to '0x' if data is an empty string
    const feeData = await provider.getFeeData();
    let maxFeePerGas = feeData.maxFeePerGas; // Explicitly get the fee data to avoid maxFeePerGas being set to 0 when maxPriorityFeePerGas is specified

    let customPriorityFeePerGas;

    if (gasSetting != 'auto') {
        customPriorityFeePerGas = ethers.parseUnits(gasMapping[gasSetting], 'gwei');
        if (customPriorityFeePerGas > maxFeePerGas) {
            maxFeePerGas = customPriorityFeePerGas;
        }
    }

    const transaction = {
        to: to,
        value: ethers.parseEther(amount.toString()),
        data: hexData,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: gasSetting === 'auto' ? feeData.maxPriorityFeePerGas : customPriorityFeePerGas
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