import { WalletContractV4 } from 'ton';
import { mnemonicNew, mnemonicToPrivateKey, keyPairFromSecretKey } from 'ton-crypto';

export async function createTonWallet() {
    const mnemonic = await mnemonicNew();
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey })

    const publicAddress = wallet.address.toString({bounceable: false});
    const privateKey = keyPair.secretKey.toString('hex');

    return {publicAddress, privateKey, mnemonic}
}

export async function getTonPrivateKeyFromMnemonic(mnemonic) {
    const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
    const hexSecretKey = keyPair.secretKey.toString('hex');

    return hexSecretKey;
}

export function getTonAddressFromPrivateKey(privateKey) {
    const keyPair = keyPairFromSecretKey(Buffer.from(privateKey, 'hex'));
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey })
    const nonBounceableAddress = wallet.address.toString({bounceable: false})

    return nonBounceableAddress;
}

export function validateTonPrivateKey(privateKey) {
    try {
        const keyPair = keyPairFromSecretKey(Buffer.from(privateKey, 'hex'));
        WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey })

    } catch (error) {
        return false;
    }
}