import { getAssetPrice } from "../../../common/coingecko.mjs";
import { getWalletAddress } from "../../../common/db/walletDb.mjs";
import { getEvmBalance, getEvmGasPrice } from "./utils.mjs";
import { round } from "../../../common/utils.mjs";
import { isHexString } from "ethers";

export async function validateEvmEnoughBalance(chatId, chainName, data, return_numbers, decimals) {
    let balance, gasPrice, assetPrice;
    
    const evmBalancePromise = getWalletAddress(chatId, chainName).then(walletAddress => getEvmBalance(walletAddress, chainName));
    const gasPricePromise = await getEvmGasPrice(chainName);

    let promises = [evmBalancePromise, gasPricePromise];

    if (return_numbers) {
        promises.push(getAssetPrice(chainName));
        [balance, gasPrice, assetPrice] = await Promise.all(promises);

    } else {
        [balance, gasPrice] = await Promise.all(promises);
    }
    
    const txCost = 1e-9 * (gasPrice + 1) * (21000 + data.length * 16); // in ETH; + 1 to account for the priority fees
    const hasEnoughBalance = balance >= txCost;

    if (return_numbers) {
        const assetPrice = await getAssetPrice(chainName);
        const txCostUsd = txCost * assetPrice;

        return [
            hasEnoughBalance,
            [
                round(balance, decimals[0]),
                round(gasPrice, decimals[1]),
                round(txCost, decimals[2]),
                round(txCostUsd, decimals[3])
            ]];
    }

    return hasEnoughBalance;
}

export async function validateEvmAddress(address) {
    return isHexString(address, 20)
}