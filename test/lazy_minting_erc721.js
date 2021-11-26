const LazyMintingERC721 = artifacts.require('LazyMintingERC721');

const {
    BN,
    constants,
    expectEvent,
    expectRevert,
} = require("@openzeppelin/test-helpers");
const ethSigUtil = require('@metamask/eth-sig-util');

const { expect } = require('chai');

const ganacheAccountKeys = require('./ganache_account_keys.json');

contract('LazyMintingERC721', async accounts => {
    beforeEach(async () => {
        this.adminAccount = accounts[9];
        this.adminAccountPrivateKey =
            ganacheAccountKeys['addresses'][this.adminAccount.toLowerCase()]['secretKey']['data'];
        this.redeemerAccount = accounts[0];
        this.redeemerAccountPrivateKey =
            ganacheAccountKeys['addresses'][this.redeemerAccount.toLowerCase()]['secretKey']['data'];
        this.contractName = 'Test Lazy Minting ERC721';
        this.contract = await LazyMintingERC721.new(this.contractName, 'TLMX', { from: this.adminAccount });
        this.nftVoucherStructName = 'NFTVoucher';
        this.typedDataTypes = {
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
            ],
            NFTVoucher: [
                {
                    name: 'tokenId',
                    type: 'uint256'
                },
                {
                    name: 'minPriceWei',
                    type: 'uint256'
                },
                {
                    name: 'metadataURI',
                    type: 'string'
                }
            ]
        };
        this.signingDomain = {
            name: this.contractName,
            version: '1',
            chainId: await this.contract.getChainID(),
            verifyingContract: this.contract.address
        };
        this.sampleNFTVoucher = {
            tokenId: 1337,
            minPriceWei: 1,
            metadataURI: 'ipfs://test',
        };
        this.sampleNFTVoucherHexStringSignature = ethSigUtil.signTypedData({
            privateKey: Uint8Array.from(this.adminAccountPrivateKey),
            data: {
                types: this.typedDataTypes,
                primaryType: this.nftVoucherStructName,
                domain: this.signingDomain,
                message: {
                    ...this.sampleNFTVoucher
                }
            },
            version: ethSigUtil.SignTypedDataVersion.V4
        });
        this.sampleNFTVoucherSignature = Buffer.from(this.sampleNFTVoucherHexStringSignature.slice(2), 'hex');
        this.sampleNFTVoucherHexStringForbiddenSignature = ethSigUtil.signTypedData({
            privateKey: Uint8Array.from(this.redeemerAccountPrivateKey),
            data: {
                types: this.typedDataTypes,
                primaryType: this.nftVoucherStructName,
                domain: this.signingDomain,
                message: {
                    ...this.sampleNFTVoucher
                }
            },
            version: ethSigUtil.SignTypedDataVersion.V4
        });
        this.sampleNFTVoucherForbiddenSignature = Buffer.from(
            this.sampleNFTVoucherHexStringForbiddenSignature.slice(2), 'hex'
        );
    });

    describe('redeem()', async () => {
        it('should revert when the NFTVoucher signature is invalid', async () => {
            await expectRevert(
                this.contract.redeem(
                    this.redeemerAccount,
                    {
                        ...this.sampleNFTVoucher,
                        signature: Buffer.from('dead', 'utf8')
                    },
                    { from: this.redeemerAccount, value: this.sampleNFTVoucher.minPriceWei }
                ),
                'ECDSA: invalid signature length -- Reason given: ECDSA: invalid signature length.',
            );
        });

        it('should revert when insufficient funds have been sent', async () => {
            await expectRevert(
                this.contract.redeem(
                    this.redeemerAccount,
                    {
                        ...this.sampleNFTVoucher,
                        signature: this.sampleNFTVoucherSignature
                    },
                    { from: this.redeemerAccount, value: 0 }
                ),
                'LazyMintingERC721: insufficient funds to redeem',
            );
        });

        it('should revert when the NFTVoucher has been signed by someone else than the owner of the contract',
            async () => {
                await expectRevert(
                    this.contract.redeem(
                        this.redeemerAccount,
                        {
                            ...this.sampleNFTVoucher,
                            signature: this.sampleNFTVoucherForbiddenSignature
                        },
                        { from: this.redeemerAccount, value: this.sampleNFTVoucher.minPriceWei }
                    ),
                    'LazyMintingERC721: signer is not allowed',
                );
            }
        );

        it('should revert when an NFTVoucher with the same tokenId has already been redeemed', async () => {
            // Mint the NFT a first time
            await this.contract.redeem(
                this.redeemerAccount,
                {
                    ...this.sampleNFTVoucher,
                    signature: this.sampleNFTVoucherSignature
                },
                { from: this.redeemerAccount, value: this.sampleNFTVoucher.minPriceWei }
            );

            // Try to mint the NFT a second time
            await expectRevert(
                this.contract.redeem(
                    this.redeemerAccount,
                    {
                        ...this.sampleNFTVoucher,
                        signature: this.sampleNFTVoucherSignature
                    },
                    { from: this.redeemerAccount, value: this.sampleNFTVoucher.minPriceWei }
                ),
                'ERC721: token already minted',
            );
        });

        it('should revert when an NFTVoucher with the same metadataURI has already been redeemed', async () => {
            // Mint the NFT a first time
            await this.contract.redeem(
                this.redeemerAccount,
                {
                    ...this.sampleNFTVoucher,
                    signature: this.sampleNFTVoucherSignature
                },
                { from: this.redeemerAccount, value: this.sampleNFTVoucher.minPriceWei }
            );

            // Create a voucher with a different tokenId but the same metadataURI
            const duplicateNFTVoucher = {
                tokenId: 1338,
                minPriceWei: 1,
                metadataURI: 'ipfs://test',
            };
            const duplicateNFTVoucherHexStringSignature = ethSigUtil.signTypedData({
                privateKey: Uint8Array.from(this.adminAccountPrivateKey),
                data: {
                    types: this.typedDataTypes,
                    primaryType: this.nftVoucherStructName,
                    domain: this.signingDomain,
                    message: {
                        ...duplicateNFTVoucher
                    }
                },
                version: ethSigUtil.SignTypedDataVersion.V4
            });
            const duplicateNFTVoucherSignature = Buffer.from(duplicateNFTVoucherHexStringSignature.slice(2), 'hex');

            // Try to mint the NFT with the duplicate metadata URI
            await expectRevert(
                this.contract.redeem(
                    this.redeemerAccount,
                    {
                        ...duplicateNFTVoucher,
                        signature: duplicateNFTVoucherSignature
                    },
                    { from: this.redeemerAccount, value: duplicateNFTVoucher.minPriceWei }
                ),
                'LazyMintingERC721: token already minted (metadata URI already used)',
            );
        });

        it('should mint the NFT to the redeemer address when the NFTVoucher signature is valid and verified',
            async () => {
                await expectEvent(await this.contract.redeem(
                        this.redeemerAccount,
                        {
                            ...this.sampleNFTVoucher,
                            signature: this.sampleNFTVoucherSignature
                        },
                        { from: this.redeemerAccount, value: this.sampleNFTVoucher.minPriceWei }
                    ),
                    'Transfer', {
                        from: constants.ZERO_ADDRESS,
                        to: this.redeemerAccount,
                        tokenId: new BN(this.sampleNFTVoucher.tokenId),
                    }
                );
            }
        );

        it('should return the ID of the minted NFT when the NFTVoucher signature is valid and verified', async () => {
            expect(await this.contract.redeem.call(
                    this.redeemerAccount,
                    {
                        ...this.sampleNFTVoucher,
                        signature: this.sampleNFTVoucherSignature
                    },
                    { from: this.redeemerAccount, value: this.sampleNFTVoucher.minPriceWei }
                )
            ).to.be.bignumber.equal(new BN(this.sampleNFTVoucher.tokenId));
        });
    });
});
