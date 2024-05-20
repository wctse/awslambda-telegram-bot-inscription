import { HttpClient, Api } from 'tonapi-sdk-js';

export async function assembleTon20Data(txType, components) {
    switch (txType) {
        case 'mint':
            if (
                !components.protocol ||
                !components.ticker ||
                !components.amount ||
                typeof components.protocol !== 'string' ||
                typeof components.ticker !== 'string' ||
                !isNaN(parseFloat(components.ticker)) ||
                Object.keys(components).length !== 3
            ) {
                throw new Error('Incorrect entries for ton-20 mint data assembling. Required: protocol (str), ticker (str), amount (str of number)');
            }

            return `data:application/json,{"p":"${components.protocol}","op":"mint","tick":"${components.ticker}","amt":"${components.amount * 1e9}"}`;
        
        case 'transfer':
            if (
                !components.protocol ||
                !components.ticker ||
                !components.amount ||
                !components.recipient ||
                typeof components.protocol !== 'string' ||
                typeof components.ticker !== 'string' ||
                isNaN(parseFloat(components.amount)) ||
                typeof components.recipient !== 'string' ||
                Object.keys(components).length !== 4
            ) {
                throw new Error('Incorrect entries for ton-20 transfer data assembling. Required: protocol (str), ticker (str), amount (str of number), recipient (str)');
            }

            return `data:application/json,{"p":"${components.protocol}","op":"transfer","tick":"${components.ticker}","to":"${components.recipient}","amt":"${components.amount * 1e9}","memo":""}`;

        default:
            throw new Error(`Transaction type ${txType} data assembling not supported for ierc-20`);
    }
}

export async function getTon20Balance(publicAddress) {
    const httpClient = new HttpClient({
        baseUrl: 'https://tonapi.io',
        baseApiParams: {
            headers: {
                Authorization: `Bearer ${process.env.TON_CONSOLE_API_KEY}`,
                'Content-type': 'application/json'
            }
        }
    });

    const client = new Api(httpClient);
    const response = await client.inscriptions.getAccountInscriptions(publicAddress);

    const balance = response.inscriptions.reduce((acc, item) => {
        acc[item.ticker] = parseInt(item.balance, 10) / Math.pow(10, item.decimals);
        return acc;
    }, {});

    return balance;
}

export async function getTon20ListPageMessage() {
    return `📖 [You can search for existing tokens on tonano.io.](https://tonano.io/ton20/)`;
}

export async function getTon20TokenPageMessage(ticker) {
    return `📖 [Check the ${ticker} information on tonano.io.](https://tonano.io/ton20/${ticker})`;
}