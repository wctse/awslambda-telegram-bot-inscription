import { getWalletAddress } from "../common/db/walletDb.mjs";

export function validateWalletExists(userId, chainName) {
    const walletAddress = getWalletAddress(userId, chainName);
    return !!walletAddress;
}