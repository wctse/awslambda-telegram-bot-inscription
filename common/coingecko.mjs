// Todo: Remove and replace with getAssestPrice
export async function getEthPrice() {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum.usd;
}

export async function getAssetPrice(chainName) {
    const apiEndpoints = {
        Ethereum: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    };

    if (!(chainName in apiEndpoints)) {
        throw new Error('Chain not supported');
    }

    const response = await fetch(apiEndpoints[chainName]);
    const data = await response.json();
    return data.ethereum.usd;
}