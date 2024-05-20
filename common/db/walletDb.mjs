import { getItemsFromDb, editItemInDb } from './dbOperations.mjs';

const walletTable = process.env.WALLET_TABLE_NAME;

export async function getWalletItem(chatId, chainName) {
    const walletTable = process.env.WALLET_TABLE_NAME;
    const walletItems = await getItemsFromDb(walletTable, `userId`, chatId);

    if (!walletItems) {
        return null;
    }

    const walletItem = walletItems.find(item => item.chainName === chainName);
    return walletItem;
}

export async function getWalletAddress(chatId, chainName) {
    const walletItem = await getWalletItem(chatId, chainName);
    return walletItem ? walletItem.publicAddress : null;
}

export async function updateWalletLastActiveAt(userId, publicAddress) {
    const walletTable = process.env.WALLET_TABLE_NAME;
    const key = {
        userId: userId,
        publicAddress: publicAddress
    };

    const updates = {
        lastActiveAt: Date.now()
    };

    await editItemInDb(walletTable, key, updates);
}
