import { ethers, isHexString, JsonRpcProvider } from 'ethers';
import { ZERO_ADDRESS } from '../constants.mjs';
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

const testnet = config.TESTNET

// TODO: Add fallback providers
const provider = 
    testnet ? new JsonRpcProvider(`https://ethereum-goerli.publicnode.com`) :
    new JsonRpcProvider(`https://ethereum.publicnode.com`);

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

export async function sendTransaction(privateKey, data, to = null) {
    const wallet = new ethers.Wallet(privateKey, provider);
    if (!to) {
        to = wallet.address;
    } else if (to === 'zero') {
        to = ZERO_ADDRESS;
    }

    const transaction = {
        to: to,
        value: ethers.parseEther('0.0'),
        data: ethers.hexlify(ethers.toUtf8Bytes(data)),
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

export async function addNonce(data) {
    // Check if the data URI contains "application/json"
    let containsApplicationJson = data.includes("application/json");
    let jsonPart;

    // If it contains "application/json", remove it temporarily
    if (containsApplicationJson) {
        jsonPart = data.replace("data:application/json,", "");
    } else {
        jsonPart = data.replace("data:,", "");
    }

    // Parse the JSON part
    let jsonObj = JSON.parse(jsonPart);

    // Generate a nonce (simulated nanosecond timestamp)
    let nonce = Date.now() * 1000000;

    // Add the nonce to the JSON object
    jsonObj.nonce = nonce.toString();

    // Convert the object back to a JSON string
    let modifiedJsonString = JSON.stringify(jsonObj);

    // Reattach "application/json" if it was originally present
    if (containsApplicationJson) {
        return "data:application/json," + modifiedJsonString;
    } else {
        return "data:," + modifiedJsonString;
    }
}