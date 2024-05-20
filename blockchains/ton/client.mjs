import { TonClient } from 'ton';
import config from '../../config.json' assert { type: "json" };

export function getTonClient(use_testnet = config.TESTNET) {
    const client = new TonClient({
        endpoint: use_testnet ? 'https://testnet.toncenter.com/api/v2/jsonRPC' : 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: config.TON_API_KEY
    });

    return client;
};