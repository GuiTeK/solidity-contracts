const TestOpenSeaERC721 = artifacts.require('TestOpenSeaERC721');

const { expect } = require('chai');

contract('TestOpenSeaERC721', async accounts => {
    beforeEach(async () => {
        this.adminAccount = accounts[9];
        this.contract = await TestOpenSeaERC721.new('Test OpenSea Tradable ERC721', 'TOSX', 'ipfs://',
            'ipfs://contractcid');
    });

    describe('baseTokenURI()', async () => {
        it('should return the base token URI set in the constructor', async () => {
            expect(await this.contract.baseTokenURI({ from: this.adminAccount })).to.be.equal('ipfs://');
        });
    });

    describe('contractURI()', async () => {
        it('should return the contract URI set in the constructor', async () => {
            expect(await this.contract.contractURI({ from: this.adminAccount })).to.be.equal('ipfs://contractcid');
        });
    });
});
