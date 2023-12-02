import { ethers, JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider(`https://ethereum.publicnode.com`); // TODO: Add fallback providers

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