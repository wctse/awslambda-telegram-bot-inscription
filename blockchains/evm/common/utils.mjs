import { ethers, isHexString } from 'ethers';
import { round } from '../../../common/utils.mjs';
import { getProvider } from './providers.mjs';
import { getAssetPrice } from '../../../common/coingecko.mjs';
import { assembleIerc20Data, getIerc20Balance, getIerc20ListPageMessage, getIerc20TokenPageMessage } from '../ethereum/protocols/ierc20.mjs';
import config from '../../../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work

export async function assembleEvmData(chainName, protocol, txType, components) {
    const chainProtocolMap = {
        'Ethereum-ierc-20': assembleIerc20Data,
      };
      
      const key = `${chainName}-${protocol}`;
      
      if (key in chainProtocolMap) {
        return await chainProtocolMap[key](txType, components);
        
      } else {
        throw new Error('Protocol not supported');
      }
}

export async function getTransactionInscription(transactionHash, chainName = "Ethereum") {
    const provider = getProvider(chainName);

    if (!isHexString(transactionHash, 32)) {
        throw new Error("Invalid transaction hash");
    }

    const transaction = await provider.getTransaction(transactionHash);
    const data = transaction.data;
    const text = ethers.utils.toUtf8String(data);

    return text;
}

export async function getEvmBalance(publicAddress, chainName = "Ethereum") {
    const provider = getProvider(chainName);

    try {
        const balance = await provider.getBalance(publicAddress);
        return ethers.formatEther(balance); // Converts the balance from Wei to Ether
        
    } catch (error) {
        console.error('Error getting ETH balance:', error);
        throw error;
    }
}

export async function getEvmInscriptionBalance(publicAddress, chainName) {
    let balances;

    switch (chainName) {
        case 'Ethereum':
            const ierc20Balance = await getIerc20Balance(publicAddress);
            balances = {
                "ierc-20": ierc20Balance
            };

        return balances;
    }
}

export async function getEvmGasPrice(chainName, decimals=null, return_usd=false) {
    const provider = getProvider(chainName);

    try {
        if (return_usd) {
            const [feeData, assetPrice] = await Promise.all([
                provider.getFeeData(),
                getAssetPrice(chainName)
            ]);

            const gasPrice = decimals ? round(ethers.formatUnits(feeData.gasPrice, 'gwei'), decimals[0]) : ethers.formatUnits(feeData.gasPrice, 'gwei');
            const gasPriceInUsd = round(gasPrice * assetPrice / 1e9, decimals[1]);

            return [gasPrice, gasPriceInUsd];
            
        } else {
            const feeData = await provider.getFeeData();
            const gasPrice = decimals ? round(ethers.formatUnits(feeData.gasPrice, 'gwei'), decimals) : ethers.formatUnits(feeData.gasPrice, 'gwei');

            return [gasPrice];
        }

    } catch (error) {
        console.error('Error getting current gas price:', error);
        throw error;
    }
}

export async function getEvmExplorerUrl(chainName, txHash) {
    const testnet = config.TESTNET;

    switch (chainName) {
        case 'Ethereum':
          if (testnet) {
            return `https://sepolia.etherscan.io/tx/${txHash}`;

          } else {
            return `https://etherscan.io/tx/${txHash}`;

          }
          
        default:
          throw new Error(`getEvmExplorerUrl: Chain ${chainName} not supported`);
      }
}

export async function getEvmInscriptionListPageMessage(chainName, protocol) {
    const chainProtocolMap = {
        'Ethereum-ierc-20': getIerc20ListPageMessage,
      };
      
    const key = `${chainName}-${protocol}`;
    
    if (key in chainProtocolMap) {
        return await chainProtocolMap[key]();
    
    } else {
        throw new Error(`getEvmInscriptionListPageMessage: Chain ${chainName} and protocol ${protocol} not supported`);
    }
}

export async function getEvmInscriptionTokenPageMessage(chainName, protocol, ticker) {
    const chainProtocolMap = {
        'Ethereum-ierc-20': getIerc20TokenPageMessage,
      };
      
    const key = `${chainName}-${protocol}`;
    
    if (key in chainProtocolMap) {
        return await chainProtocolMap[key](ticker);
    
    } else {
        throw new Error(`getEvmInscriptionTokenPageMessage: Chain ${chainName} and protocol ${protocol} not supported`);
    }
}