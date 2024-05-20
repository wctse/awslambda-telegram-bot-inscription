import { WalletContractV4, internal, external, beginCell, storeMessage, SendMode } from 'ton';
import { createWalletTransferV4 } from 'ton/dist/wallets/signing/createWalletTransfer.js';
import { getTonfura } from './tonfura.mjs';
import { keyPairFromSecretKey } from 'ton-crypto';

export async function sendTonTransaction(privateKey, data = '', to = null, amount = null) {
    console.log(`sendTonTransaction: data: ${data}, to: ${to}, amount: ${amount}`)

    const tonfura = getTonfura();
    const keyPair = keyPairFromSecretKey(Buffer.from(privateKey, 'hex')); // Secret key input is in Buffer format
    const workchain = 0;

    const wallet = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey });

    const seqno = (await tonfura.core.getWalletInformation(wallet.address.toString()))
        .data.result.seqno;
        
    if (!seqno) {
        throw Error ('Failed to get seqno');
    }

    const internalMessage = createWalletTransferV4({
        seqno,
        secretKey: keyPair.secretKey,
        walletId: wallet.walletId,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [internal({
            value: amount ? amount * 1e9 : 1,
            bounce: false,
            to: to ? to : wallet.address,
            body: data,
        })]
    });

    const externalMessage = external({
        to: wallet.address,
        init: null,
        body: internalMessage,
    });

    const boc = beginCell()
        .store(storeMessage(externalMessage))
        .endCell()
        .toBoc();

    const txResponse = await tonfura.transact.sendBocReturnHash(boc.toString("base64"));
    console.log(`Ton transaction sent: ${txResponse}`);

    return {};
}

// export async function updateTonTxHistory(chatId) {
//     const client = getTonClient('TON');
//     return;
// }