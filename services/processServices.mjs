import { assembleEvmData, getEvmBalance, getEvmExplorerUrl, getEvmGasPrice } from "../blockchains/evm/common/utils.mjs";
import { getWalletAddress } from "../common/db/walletDb.mjs";
import { validateEvmAddress, validateEvmEnoughBalance } from "../blockchains/evm/common/validations.mjs";
import { getIerc20Balance } from "../blockchains/evm/ethereum/protocols/ierc20.mjs";
import { getAssetPrice } from "../common/coingecko.mjs";
import { round } from "../common/utils.mjs";
import config from '../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

/**
 * Create the data field based on the blockchain inscription protocol and transaction type
 * 
 * @param {str} chainName 
 * @param {str} protocol
 * @param {str} txType 
 * @param {{any}} components Object of component name and values that will assemble the data field. Fields required are dependent on the other parameters
 * @returns 
 */
export async function assembleData(chainName, protocol, txType, components) {
    switch (chainName) {
        case 'Ethereum':
            return await assembleEvmData(chainName, protocol, txType, components);
            
        default:
            throw new Error('Chain not supported');
    }
}

/**
 * Get the balance of an asset in a particular chain's wallet of the user
 * 
 * @param {*} chatId 
 * @param {*} chainName 
 * @param {*} return_wallet If true, returns an array containing the balance and the wallet address. Otherwise, returns the balance only
 * @returns {Promise<number | [number, string]>} Promise that resolves to the balance of the asset in the wallet, or an array containing the balance and the wallet address
 */
export async function getAssetBalance(chatId, chainName, return_wallet=false) {
    let assetBalance;
    const publicAddress = await getWalletAddress(chatId, chainName);

    switch (chainName) {
        case 'Ethereum':
            assetBalance = await getEvmBalance(publicAddress, chainName);
            return return_wallet ? [assetBalance, publicAddress] : assetBalance;
            
        default:
            throw new Error('Chain not supported');
    }
}

/**
 * Get the balance of an asset in a particular chain's wallet of the user in the asset and in USD
 * 
 * @param {*} chatId 
 * @param {*} chainName 
 * @param {[int, int]} decimals An array of two numbers of decimal places to round the balance and the balance in USD to
 * @returns {Promise<[number, number]>} Promise that resolves to an array containing the balance of the asset in the wallet and the balance in USD
 */
export async function getAssetBalanceUsd(chatId, chainName, decimals, return_wallet=false) {
    let assetBalance, publicAddress, assetPrice;

    if (return_wallet) {
        [[assetBalance, publicAddress], assetPrice] = await Promise.all([
            getAssetBalance(chatId, chainName, return_wallet),
            getAssetPrice(chainName)
        ]);

        return [round(assetBalance, decimals[0]), round(assetBalance * assetPrice, decimals[1]), publicAddress];

    }
        
    [assetBalance, assetPrice] = await Promise.all([
        getAssetBalance(chatId, chainName, return_wallet),
        getAssetPrice(chainName)
    ]);

    return [round(assetBalance, decimals[0]), round(assetBalance * assetPrice, decimals[1])];
}

/**
 * Obtains the balance of all inscription assets in a particular chain's wallet of the user
 * 
 * @param {*} chatId 
 * @param {*} publicAddress Public address of the user's wallet. Obtained from the chatId and chainName if not provided
 * @param {*} chainName 
 * @returns {Promise<{str:{str:number}}>} Promise that resolves to an object of protocol names, and a nested object of token tickers and the respective balances
 */
export async function getInscriptionBalance(chatId=null, publicAddress=null, chainName) {
    if (!chatId && !publicAddress) {
        throw new Error('One of chatId and publicAddress must be provided');
    }

    if (chatId && !publicAddress) {
        publicAddress = await getWalletAddress(chatId, chainName);
    }

    switch (chainName) {
        case 'Ethereum':
            const ierc20Balance = await getIerc20Balance(publicAddress);
            const balances = {
                "ierc-20": ierc20Balance
            };
            
            return balances;

        default:
            throw new Error('Chain not supported');
    }
}

/**
 * Get the array of inscription protocols of a chain from the config
 * 
 * @param {str} chainName 
 * @returns {Promise<[str]>} Promise that resolves to an array of the inscription protocols of the chain
 */
export async function getProtocols(chainName) {
    return config.CHAINS.find(chain => chain.name === chainName).protocols;
}


/**
 * Get the current gas price for a particular chain
 * 
 * @param {str} chainName The specific EVM chain to get the gas price for
 * @param {int | [int, int]} decimals Integer of decimals to round the gas prices to. Array of two integers for the gas unit and USD respectively if return_usd is true
 * @param {boolean} return_usd If true, returns the gas price in USD along with the gas price in Gwei. Otherwise just the gas price in Gwei
 * @returns {Promise<number | [number, number]>} Promise that resolves to the current gas price in Gwei, or an array containing the gas price in Gwei and USD
 */
export async function getCurrentGasPrice(chainName, decimals=null, return_usd=false) {
    switch (chainName) {
        case 'Ethereum':
            return await getEvmGasPrice(chainName, decimals, return_usd);
            
        default:
            throw new Error('Chain not supported');
    }
}

/**
 * Provides the names of the native asset and the gas unit for a particular chain
 * 
 * @param {str} chainName 
 * @returns {Promise<[str, str]>} Promise that resolves to an array containing the native asset name and the gas unit name for the chain
 */
export async function getUnits(chainName) {
    const gasUnitMapping = {
        'Ethereum': ['ETH', 'gwei']
    };

    if (!gasUnitMapping[chainName]) {
        throw new Error('Chain not supported');
    }

    return gasUnitMapping[chainName];
}

/**
 * Get the explorer URL for a particular chain and transaction hash
 * 
 * @param {*} chainName 
 * @param {*} txHash 
 * @returns {Promise<str>} Promise that resolves to the URL of the transaction on the explorer for the chain
 */
export async function getExplorerUrl(chainName, txHash) {
    switch(chainName) {
        case 'Ethereum':
            return await getEvmExplorerUrl(chainName, txHash)
            
        default:
            throw new Error(`getExplorerUrl: Chain ${chainName} not supported`);
    
    }
}

/**
 * Validate an address on a particular chain
 * 
 * @param {str} address 
 * @param {str} chainName 
 * @returns {Promise<boolean>} Promise that resolves to true if the address is valid, false otherwise
 */
export async function validateAddress(address, chainName) {
    switch (chainName) {
        case 'Ethereum':
            return await validateEvmAddress(address);
            
        default:
            throw new Error('Chain not supported');
    }
}

/**
 * Validate an amount to ensure it is a number and greater than 0
 * 
 * @param {number} amount 
 * @returns {Promise<boolean>} Promise that resolves to true if the amount is valid, false otherwise
 */
export async function validateAmount(amount) {
    return !Number.isNaN(amount) && amount > 0;
}


/**
 * Validate whether the user has enough balance to send a transaction
 * 
 * @param {str} chatId
 * @param {str} chainName 
 * @param {str} data The data to send in the transaction
 * @param {bool} return_numbers If true, returns an array of a boolean indicating whether the user has enough balance to send the transaction, and a sub-array containing the wallet balance, gas price in Gwei, the transaction cost in ETH, and the transaction cost in USD. Otherwise, returns a boolean indicating whether the user has enough balance to send the transaction
 * @param {[int, int, int, int]} decimals The number of decimal places to round the wallet balance, gas price, transaction cost in ETH, and transaction cost in USD to
 * @returns {bool | [bool, [number, number, number, number]]} If return_numbers is false, returns a boolean indicating whether the user has enough balance to send the transaction. Otherwise, returns an array of the boolean, the gas price in Gwei, the transaction cost in ETH, and the transaction cost in USD
 */
export async function validateEnoughBalance(chatId, chainName, data, return_numbers=false, decimals=[]) {
    switch (chainName) {
        case 'Ethereum':
            return await validateEvmEnoughBalance(chatId, chainName, data, return_numbers, decimals);
            
        default:
            throw new Error('Chain not supported');
    }
}

/**
 * Validates whether a time limit has been reached
 * 
 * @param {number} startTimestamp 
 * @param {number} durationSeconds 
 * @returns {Promise<boolean>} Promise that resolves to true if the time limit has not been reached, false otherwise
 */
export async function validateTimeNotElapsed(startTimestamp, durationSeconds) {
    return Date.now() - startTimestamp < durationSeconds * 1000;
}

/**
 * Validates whether the gas price has spiked beyond a certain limit, making the transaction undesirable for the user
 * 
 * @param {str} chainName
 * @param {number} prevGasPrice 
 * @param {number} maxSpike 
 * @returns {Promise<boolean>} Promise that resolves to true if the gas price has not spiked beyond the limit, false otherwise
 */
export async function validateNoGasSpike(chainName, prevGasPrice, maxSpike) {
    return await getCurrentGasPrice(chainName).then(currentGasPrice => {
        return currentGasPrice < prevGasPrice * (1 + maxSpike);
    });
}

/**
 * Perform all the validations required before proceeding with a transaction
 * 
 * @param {str} chainName The name of the blockchain to validate on
 * @param {number} prevGasPrice The previous gas price to check against, in gwei or an equivalent smallest unit of other chains
 * @param {number} maxSpike The maximum spike in gas price allowed, as a decimal. e.g. 0.1 for 10%
 * @param {int} startTimestamp The start time to check in milliseconds
 * @param {int} durationSeconds The limitation of elapsed duration to check against the startTimestamp, in seconds
 * @returns {Promise<str | null>} Promise that resolves to null if all validations pass, or a string indicating the validation that failed
 */
export async function validateTransaction(chainName, prevGasPrice, maxSpike, startTimestamp, durationSeconds) {
    if (!(await validateTimeNotElapsed(startTimestamp, durationSeconds))) {
        return 'timeout';
    }

    if (!(await validateNoGasSpike(chainName, prevGasPrice, maxSpike))) {
        return 'expensive_gas';
    }

    return null;
}