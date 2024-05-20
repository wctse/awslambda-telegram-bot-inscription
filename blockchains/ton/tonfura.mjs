import { Network, Tonfura } from 'tonfura-sdk';
import config from '../../config.json' assert { type: 'json' }; // Lambda IDE will show this is an error, but it would work
  
export function getTonfura(testnet = config.TESTNET) {
    const settings = {
        apiKey: process.env.TONFURA_API_KEY,
        network: testnet ? Network.Testnet : Network.Mainnet
      };

    return new Tonfura(settings);
}