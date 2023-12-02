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
        const gasPrice = await provider.getGasPrice();
        return ethers.formatUnits(gasPrice, 'gwei'); // Converts the gas price from Wei to Gwei
    } catch (error) {
        console.error('Error getting current gas price:', error);
        throw error;
    }
}