import config from '../../../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work
import { JsonRpcProvider } from 'ethers';

export function getProvider(chainName, use_testnet = config.TESTNET) {
    if (use_testnet) {
        chainName += "-testnet";
    }

    // Add the provider URLs here
    const providers = {
        "Ethereum": "https://ethereum.publicnode.com",
        "Ethereum-testnet": "https://ethereum-sepolia.publicnode.com"
    }

    if (!(chainName in providers)) {
        throw new Error(`Function getProvider for EVMs does not support the ${chainName} chain.`);
    }

    const provider = new JsonRpcProvider(providers[chainName])
    return provider;
}