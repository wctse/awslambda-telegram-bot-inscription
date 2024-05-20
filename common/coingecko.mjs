export async function getAssetPrice(chainName) {
    const apiIds = {
        Ethereum: 'ethereum',
        TON: 'the-open-network'
    };

    const id = apiIds[chainName];

    if (!id) {
        throw new Error('Chain not supported');
    }

    const apiEndpoint = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    
    console.log(`getAssetPrice for ${chainName} at ${apiEndpoint}`);
    const response = await fetch(apiEndpoint);
    const data = await response.json();

    return data[id]['usd'];
}