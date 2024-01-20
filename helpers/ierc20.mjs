import { getItemsByPartitionKeyFromDynamoDB } from "./dynamoDB.mjs";

export function calculateIerc20Balance(transactions) {
    const mintTx = transactions.filter(tx => tx.txType === 'mint' && tx.mintProtocol === 'ierc-20');
    const transferTx = transactions.filter(tx => tx.txType === 'transfer' && tx.transferProtocol === 'ierc-20');
    
    // Add all minted amounts for each ticker
    const sums = mintTx.reduce((acc, tx) => {
        const amount = Number(tx.mintAmount);
        acc[tx.mintTicker] = (acc[tx.mintTicker] || 0) + amount;
        return acc;
    }, {});

    // Subtract all transferred amounts for each ticker
    transferTx.forEach(tx => {
        const transferAmount = Number(tx.transferAmount);
        if (!sums[tx.transferTicker]) {
            // If the ticker does not exist in sums, it implies a negative balance which is not valid
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