export async function calculateIerc20Balance(transactions) {
    const filteredTransactions = transactions.filter(tx => tx.txType === 'mint' && tx.mintProtocol === 'ierc-20');
    
    const sums = filteredTransactions.reduce((acc, tx) => {
        const amount = Number(tx.mintAmount);
        acc[tx.mintTicker] = (acc[tx.mintTicker] || 0) + amount;
        return acc;
    }, {});

    return sums;
}