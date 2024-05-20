import { getTonfura } from './tonfura.mjs';
import { assembleTon20Data, getTon20Balance, getTon20ListPageMessage, getTon20TokenPageMessage } from './protocols/ton-20.mjs';
import config from '../../config.json' assert { type: "json" };

export async function assembleTonData(protocol, txType, components) {
    switch (protocol) {
        case 'ton-20':
            return await assembleTon20Data(txType, components);
            
        default:
            throw new Error('Protocol not supported');
    }
}

export async function getTonBalance(publicAddress) {
    const tonfura = getTonfura();
    const response = await tonfura.core.getAddressBalance(publicAddress);
    const balance = response['data']['result'] * 1e-9; // convert to TON

    return balance
}

export async function getTonInscriptionBalance(publicAddress) {
    const ton20Balance = await getTon20Balance(publicAddress);

    const balances = {
        "ton-20": ton20Balance
    };

    return balances;
}

export async function getTonExplorerUrl(publicAddress) {
    const testnet = config.TESTNET;
    
    if (!testnet) {
        return `https://tonviewer.com/${publicAddress}`;

    } else {
        return `https://tesetnet.tonviewer.com/${publicAddress}`;
    }
}

export async function getTonInscriptionListPageMessage(protocol) {
    const ProtocolMap = {
        'ton-20': getTon20ListPageMessage,
      };
    
    if (protocol in ProtocolMap) {
        return await ProtocolMap[protocol]();
    
    } else {
        throw new Error(`getTonInscriptionListPageMessage: Protocol ${protocol} not supported`);
    }
}

export async function getTonInscriptionTokenPageMessage(protocol, ticker) {
    const ProtocolMap = {
        'ton-20': getTon20TokenPageMessage,
      };
    
    if (protocol in ProtocolMap) {
        return await ProtocolMap[protocol](ticker);
    
    } else {
        throw new Error(`getTonInscriptionTokenPageMessage: Protocol ${protocol} not supported`);
    }
}