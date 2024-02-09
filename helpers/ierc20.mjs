import { getItemsByPartitionKeyFromDynamoDB } from "./dynamoDB.mjs";

export function calculateIerc20Balance(transactions) {
    const mintTx = transactions.filter(tx => tx.txType === 'mint' && tx.mintProtocol === 'ierc-20');
    const transferTx = transactions.filter(tx => tx.txType === 'transfer' && tx.transferProtocol === 'ierc-20');
    const multiMintTx = transactions.filter(tx => tx.txType === 'multiMint' && tx.multiMintProtocol === 'ierc-20');
    
    // Add all minted amounts for each ticker
    const sums = mintTx.reduce((acc, tx) => {
        const mintAmount = Number(tx.mintAmount);
        acc[tx.mintTicker] = (acc[tx.mintTicker] || 0) + mintAmount;
        return acc;
    }, {});

    // Add all multi-minted amounts for each ticker
    multiMintTx.forEach(tx => {
        const multiMintAmount = Number(tx.multiMintAmount);
        if (sums[tx.multiMintTicker]) {
            sums[tx.multiMintTicker] += multiMintAmount;
        } else {
            sums[tx.multiMintTicker] = multiMintAmount;
        }
    });

    // Subtract all transferred amounts for each ticker
    transferTx.forEach(tx => {
        const transferAmount = Number(tx.transferAmount);
        if (!sums[tx.transferTicker]) {
            // If the ticker does not exist in sums, it implies a negative balance which hints the user transacted out of the bot.
            // Treat it as a zero balance to avoid negative balances.
            sums[tx.transferTicker] = 0;
        }
        sums[tx.transferTicker] -= transferAmount;
    });

    return sums;
}

export async function getIerc20Balance(publicAddress) {
    const transactionTable = process.env.TRANSACTION_TABLE_NAME;
    const transactions = await getItemsByPartitionKeyFromDynamoDB(transactionTable, "publicAddress", publicAddress);
    const ierc20Balances = await calculateIerc20Balance(transactions);
    return ierc20Balances;
}