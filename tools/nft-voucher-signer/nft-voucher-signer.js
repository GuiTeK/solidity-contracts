// npm install && node nft-voucher-signer.js
const fs = require('fs');
const readline = require('readline');

const ethSigUtil = require('@metamask/eth-sig-util');

const EIP712_DOMAIN_DATA_TYPES = {
    EIP712Domain: [
        {
            name: 'name',
            type: 'string'
        },
        {
            name: 'version',
            type: 'string',
        },
        {
            name: 'chainId',
            type: 'uint256'
        },
        {
            name: 'verifyingContract',
            type: 'address'
        }
    ]
};

async function signNFTVoucher(privateKeyHex, signingDomain, voucherDataTypes, voucher) {
    const dataTypes = {
        ...EIP712_DOMAIN_DATA_TYPES,
        ...voucherDataTypes
    };
    const privateKeyHexWithoutPrefix = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;

    return ethSigUtil.signTypedData({
        privateKey: Uint8Array.from(Buffer.from(privateKeyHexWithoutPrefix, 'hex')),
        data: {
            types: dataTypes,
            primaryType: Object.keys(voucherDataTypes)[0],
            domain: signingDomain,
            message: {
                ...voucher
            }
        },
        version: ethSigUtil.SignTypedDataVersion.V4
    });
}

async function signNFTVouchers(privateKeyHex) {
    const signingDomain = require('./data/signing-domain.json');
    const vouchersDataTypes = require('./data/vouchers-data-types.json');
    const vouchers = require('./data/vouchers.json');
    const vouchersSignatures = [];
    const vouchersSignaturesFilePath = './data/vouchers-signatures.json';

    console.log(`Signing ${vouchers.length} vouchers...`);
    for (let i = 0; i < vouchers.length; ++i) {
        vouchersSignatures.push(await signNFTVoucher(privateKeyHex, signingDomain, vouchersDataTypes, vouchers[i]));
    }

    const vouchersSignaturesJSON = JSON.stringify(vouchersSignatures, null, 4);
    fs.writeFileSync(vouchersSignaturesFilePath, vouchersSignaturesJSON, {encoding: 'utf8', flag: 'w'});

    console.log(`Successfully signed ${vouchers.length} vouchers and saved them in ${vouchersSignaturesFilePath}.`);
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });

    process.stdout.write('Private key to sign vouchers (hex format): ');
    rl.on('line', async function(line) {
        await signNFTVouchers(line);
        rl.close();
    });
}

main();
