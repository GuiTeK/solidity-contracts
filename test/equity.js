const Equity = artifacts.require("Equity");

const {
    BN,
    constants,
    expectEvent,
    expectRevert
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

contract('Equity', async accounts => {
    beforeEach(async () => {
        this.payees = [
            [accounts[0], accounts[1], accounts[2]], // Payee 1
            [accounts[3], accounts[4], accounts[5]], // Payee 2
            [accounts[6], accounts[7], accounts[8]], // Payee 3
        ];
        this.adminAccount = accounts[9];
        this.payeeAddressesNb = 3;
        this.shares = [
            100,
            75,
            100,
        ];
        this.totalShares = new BN(275);
        this.contract = await Equity.new(this.payees, this.shares, { from: this.adminAccount });
    });

    describe('constructor()', async () => {
        it('should revert when number of payees is different from number of number of shares', async () => {
            const payees = [
                [accounts[0], accounts[1], accounts[2]], // Payee 1
                [accounts[3], accounts[4], accounts[5]], // Payee 2
                [accounts[6], accounts[7], accounts[8]], // Payee 3
            ];
            const shares = [
                100,
                75,
                //100, // Missing number of shares for Payee 3
            ];

            await expectRevert(Equity.new(payees, shares, { from: this.adminAccount }),
                'Equity: payees and shares length mismatch',
            );
        });

        it('should revert when there are no payees', async () => {
            const payees = [
            ];
            const shares = [
            ];

            await expectRevert(Equity.new(payees, shares, { from: this.adminAccount }),
                'Equity: no payees',
            );
        });

        it('should revert when a payee has a bad number of addresses', async () => {
            const payees = [
                [accounts[0], accounts[1], accounts[2]], // Payee 1
                [accounts[3], accounts[4], accounts[5]], // Payee 2
                [accounts[6], /*accounts[7],*/ accounts[8]], // Payee 3, missing one address
            ];
            const shares = [
                100,
                75,
                100,
            ];

            await expectRevert(Equity.new(payees, shares, { from: this.adminAccount }),
                'Equity: bad payee addresses number',
            );
        });

        it('should revert when a payee has a zero address', async () => {
            const payees = [
                [accounts[0], accounts[1], accounts[2]], // Payee 1
                [accounts[3], accounts[4], accounts[5]], // Payee 2
                [accounts[6], constants.ZERO_ADDRESS, accounts[8]], // Payee 3, has one zero address
            ];
            const shares = [
                100,
                75,
                100,
            ];

            await expectRevert(Equity.new(payees, shares, { from: this.adminAccount }),
                'Equity: address is the zero address',
            );
        });

        it('should assign constructor data to contract state', async () => {
            expect(await this.contract.payeesNb({ from: this.adminAccount })).to.be.bignumber.equal(
                new BN(this.payees.length));
            expect(await this.contract.totalShares({ from: this.adminAccount })).to.be.bignumber.equal(
                this.totalShares);
            expect(await this.contract.totalReleased({ from: this.adminAccount })).to.be.bignumber.equal(new BN(0));

            for (let i = 0; i < this.payees.length; ++i) {
                expect(await this.contract.payeeAddresses(i, { from: this.adminAccount })).to.deep.equal(
                    this.payees[i]);
                expect(await this.contract.shares(i, { from: this.adminAccount })).to.be.bignumber.equal(
                    new BN(this.shares[i]));
                expect(await this.contract.released(i, { from: this.adminAccount })).to.be.bignumber.equal(new BN(0));
            }
        });

        it('should enable first address for each payee', async () => {
            for (let i = 0; i < this.payees.length; ++i) {
                expect(await this.contract.payeeEnabledAddressIndex(i, { from: this.adminAccount })).to.be.bignumber
                    .equal(new BN(0));
                expect(await this.contract.payeeEnabledAddress(i, { from: this.adminAccount })).to.be.equal(
                    this.payees[i][0]);
            }
        });

        it('should emit PayeeAdded events', async() => {
            for (let i = 0; i < this.payees.length; ++i) {
                await expectEvent.inConstruction(this.contract, 'PayeeAdded', {
                    payeeIndex: new BN(i),
                    addresses: this.payees[i],
                    shares: new BN(this.shares[i]),
                });
            }
        });
    });

    describe('receive()', async () => {
        it('should emit PaymentReceived event when receiving Ether', async () => {
            const amount = 1000;
            expectEvent(await this.contract.sendTransaction({value: amount, from: this.adminAccount}),'PaymentReceived', {
                from: this.adminAccount,
                amount: new BN(amount)
            });
        });
    });

    describe('payeesNb()', async () => {
        it('should return the number of payees', async () => {
            expect(await this.contract.payeesNb({ from: this.adminAccount })).to.be.bignumber.equal(
                new BN(this.payees.length));
        });
    });

    describe('payeeAddresses()', async () => {
        it('should revert when the payee index is invalid', async () => {
            await expectRevert(this.contract.payeeAddresses(this.payees.length, { from: this.adminAccount }),
                'Equity: bad payee index',
            );
        });

        it('should return the addresses of the given payee index when the index is valid', async () => {
            for (let i = 0; i < this.payees.length; ++i) {
                expect(await this.contract.payeeAddresses(i, { from: this.adminAccount })).to.deep.equal(
                    this.payees[i]);
            }
        });
    });

    describe('totalShares()', async () => {
        it('should return the number of total shares', async () => {
            expect(await this.contract.totalShares({ from: this.adminAccount })).to.be.bignumber.equal(
                this.totalShares);
        });
    });

    describe('totalReleased()', async () => {
        it('should return the total amount of released Ether', async () => {
            // At contract creation, there should be nothing released yet
            expect(await this.contract.totalReleased({ from: this.adminAccount })).to.be.bignumber.equal(new BN(0));

            // Send some Ether (1000) to the contract so we can release it
            const amount = 1000;
            await this.contract.sendTransaction({value: amount, from: this.adminAccount});

            // Ask for a withdrawal (any caller can do it)
            await this.contract.release(0, {from: this.adminAccount});

            const expectedTotalReleased = Math.floor(amount * (this.shares[0] / this.totalShares));
            expect(await this.contract.totalReleased({ from: this.adminAccount })).to.be.bignumber.equal(
                new BN(expectedTotalReleased));
        });
    });

    describe('shares()', async () => {
        it('should revert when the payee index is invalid', async () => {
            await expectRevert(this.contract.shares(this.payees.length, { from: this.adminAccount }),
                'Equity: bad payee index',
            );
        });

        it('should return the number of shares owned by the given payee index when the index is valid', async () => {
            for (let i = 0; i < this.payees.length; ++i) {
                expect(await this.contract.shares(i, { from: this.adminAccount })).to.be.bignumber.equal(
                    new BN(this.shares[i]));
            }
        });
    });

    describe('released()', async () => {
        it('should revert when the payee index is invalid', async () => {
            await expectRevert(this.contract.released(this.payees.length, { from: this.adminAccount }),
                'Equity: bad payee index',
            );
        });

        it('should return the amount of Ether released to the given payee index when the index is valid', async () => {
            // Send some Ether (1000) to the contract so we can release it
            const amount = 1000;
            await this.contract.sendTransaction({value: amount, from: this.adminAccount});

            for (let i = 0; i < this.payees.length; ++i) {
                // At contract creation, there should be nothing released yet
                expect(await this.contract.released(i, { from: this.adminAccount })).to.be.bignumber.equal(new BN(0));

                // Ask for a withdrawal (any address can call `release()`, it's ok)
                await this.contract.release(i, {from: this.adminAccount});

                expect(await this.contract.released(i, { from: this.adminAccount })).to.be.bignumber.equal(
                    new BN(Math.floor(amount * (this.shares[i] / this.totalShares.toNumber()))));
            }
        });
    });

    describe('payeeEnabledAddressIndex()', async () => {
        it('should revert when the payee index is invalid', async () => {
            await expectRevert(this.contract.payeeEnabledAddressIndex(this.payees.length, { from: this.adminAccount }),
                'Equity: bad payee index',
            );
        });

        it('should return the enabled address index of the given payee when the index is valid', async () => {
            for (let i = 0; i < this.payees.length; ++i) {
                // At contract creation, enabled address index should be 0
                expect(await this.contract.payeeEnabledAddressIndex(i, { from: this.adminAccount })).to.be.bignumber
                    .equal(new BN(0));

                // Change enabled address index
                const otherPayeeAddressIndex =
                    (this.payees.length * (i + 1) + this.payeeAddressesNb - 1) %
                    (this.payees.length * this.payeeAddressesNb);
                const otherPayeeAddress = accounts[otherPayeeAddressIndex];
                await this.contract.useNextAddress(i, {from: otherPayeeAddress});

                // Once useNextAddress() has been used, enabled address index should have increased by one
                expect(await this.contract.payeeEnabledAddressIndex(i, { from: this.adminAccount })).to.be.bignumber
                    .equal(new BN(1));
            }
        });
    });

    describe('payeeEnabledAddress()', async () => {
        it('should revert when the payee index is invalid', async () => {
            await expectRevert(this.contract.payeeEnabledAddress(this.payees.length, { from: this.adminAccount }),
                'Equity: bad payee index',
            );
        });

        it('should return the enabled address of the given payee when the index is valid', async () => {
            for (let i = 0; i < this.payees.length; ++i) {
                // At contract creation, enabled address index should be 0
                expect(await this.contract.payeeEnabledAddress(i, { from: this.adminAccount })).to.be.equal(
                    accounts[this.payees.length * i]);

                // Change enabled address index
                const otherPayeeAddressIndex =
                    (this.payees.length * (i + 1) + this.payeeAddressesNb - 1) %
                    (this.payees.length * this.payeeAddressesNb);
                const otherPayeeAddress = accounts[otherPayeeAddressIndex];
                await this.contract.useNextAddress(i, {from: otherPayeeAddress});

                // Once useNextAddress() has been used, enabled address index should have increased by one
                expect(await this.contract.payeeEnabledAddress(i, { from: this.adminAccount })).to.be.equal(
                    accounts[this.payees.length * i + 1]);
            }
        });
    });

    describe('useNextAddress()', async () => {
        it('should revert when the payee index is invalid', async () => {
            await expectRevert(this.contract.useNextAddress(this.payees.length, { from: this.adminAccount }),
                'Equity: bad payee index',
            );
        });

        it('should revert when all the addresses have already been used', async () => {
            for (let i = 0; i < this.payees.length; ++i) {
                const otherPayeeAddressIndex =
                    (this.payees.length * (i + 1) + this.payeeAddressesNb - 1) %
                    (this.payees.length * this.payeeAddressesNb);
                const otherPayeeAddress = accounts[otherPayeeAddressIndex];

                await this.contract.useNextAddress(i, {from: otherPayeeAddress});
                await this.contract.useNextAddress(i, {from: otherPayeeAddress});

                await expectRevert(this.contract.useNextAddress(i, {from: otherPayeeAddress}),
                    'Equity: all addresses already used',
                );
            }
        });

        it('should revert when called from a disabled payee address', async () => {
            // First, disable the first address of each payee
            for (let i = 0; i < this.payees.length; ++i) {
                const otherPayeeAddressIndex =
                    (this.payees.length * (i + 1) + this.payeeAddressesNb - 1) %
                    (this.payees.length * this.payeeAddressesNb);
                const otherPayeeAddress = accounts[otherPayeeAddressIndex];

                await this.contract.useNextAddress(i, {from: otherPayeeAddress});
            }

            // Then try to use the first address of each payee to call `useNextAddress()`
            for (let i = 0; i < this.payees.length; ++i) {
                const otherPayeeAddressIndex =
                    (this.payees.length * (i + 1)) % (this.payees.length * this.payeeAddressesNb);
                const otherPayeeAddress = accounts[otherPayeeAddressIndex];

                await expectRevert(this.contract.useNextAddress(i, {from: otherPayeeAddress}),
                    'Equity: caller payee address is disabled',
                );
            }
        });

        it('should enable the next address in the list for the given payee and disable the previous one', async () => {
            // Send some Ether (1000) to the contract so we can release it
            const amount = 1000;
            await this.contract.sendTransaction({value: amount, from: this.adminAccount});

            for (let i = 0; i < this.payees.length; ++i) {
                // Change enabled address index
                const otherPayeeAddressIndex =
                    (this.payees.length * (i + 1) + this.payeeAddressesNb - 1) %
                    (this.payees.length * this.payeeAddressesNb);
                const otherPayeeAddress = accounts[otherPayeeAddressIndex];
                await this.contract.useNextAddress(i, {from: otherPayeeAddress});

                const oldAddressInitialBalance =
                    new BN(await web3.eth.getBalance(accounts[this.payees.length * i]));
                const newAddressInitialBalance =
                    new BN(await web3.eth.getBalance(accounts[this.payees.length * i + 1]));
                await this.contract.release(i, {from: this.adminAccount});

                // Once useNextAddress() has been used:
                // 1) Enabled address index should have increased by one
                expect(await this.contract.payeeEnabledAddress(i, { from: this.adminAccount })).to.be.equal(
                    accounts[this.payees.length * i + 1]);

                // 2) Released Ether should be sent to the new enabled address
                const newAddressFinalBalance = new BN(await web3.eth.getBalance(accounts[this.payees.length * i + 1]));
                const newAddressExpectedDiff =
                    new BN(Math.floor(amount * (this.shares[i] / this.totalShares.toNumber())));
                const newAddressDiff = newAddressFinalBalance.sub(newAddressInitialBalance);
                await expect(newAddressDiff).to.be.bignumber.equal(newAddressExpectedDiff);

                // 3) Old address should not have received Ether
                const oldAddressFinalBalance = new BN(await web3.eth.getBalance(accounts[this.payees.length * i]));
                const oldAddressExpectedDiff = new BN(0);
                const oldAddressDiff = oldAddressFinalBalance.sub(oldAddressInitialBalance);
                await expect(oldAddressDiff).to.be.bignumber.equal(oldAddressExpectedDiff);
            }
        });
    });

    describe('release()', async () => {
        it('should revert when the payee index is invalid', async () => {
            await expectRevert(this.contract.release(this.payees.length, { from: this.adminAccount }),
                'Equity: bad payee index',
            );
        });

        it('should revert when contract has no funds', async () => {
            await expectRevert(this.contract.release(0, { from: this.adminAccount }),
                'Equity: payee is not due payment',
            );
        });

        it('should emit PaymentReleased event', async () => {
            // Send some Ether (1000) to the contract so we can release it
            const amount = 1000;
            await this.contract.sendTransaction({value: amount, from: this.adminAccount});

            for (let i = 0; i < this.payees.length; ++i) {
                await expectEvent(await this.contract.release(i, { from: this.adminAccount }),
                    'PaymentReleased', {
                        payeeIndex: new BN(i),
                        to: this.payees[i][0],
                        amount: new BN(Math.floor(amount * (this.shares[i] / this.totalShares.toNumber()))),
                    }
                );
            }
        });

        it('should send the owed amount of Ether to the given payee only', async () => {
            // Send some Ether (1000) to the contract so we can release it
            const amount = 1000;
            await this.contract.sendTransaction({value: amount, from: this.adminAccount});

            for (let i = 0; i < this.payees.length; ++i) {
                const contractInitialBalance = new BN(await web3.eth.getBalance(this.contract.address));
                const payeeInitialBalance = new BN(await web3.eth.getBalance(accounts[this.payees.length * i]));
                const expectedDiff = new BN(Math.floor(amount * (this.shares[i] / this.totalShares.toNumber())));

                await this.contract.release(i, {from: this.adminAccount});

                const contractFinalBalance = new BN(await web3.eth.getBalance(this.contract.address));
                const payeeFinalBalance = new BN(await web3.eth.getBalance(accounts[this.payees.length * i]));

                const contractDiff = contractFinalBalance.sub(contractInitialBalance);
                const payeeDiff = payeeFinalBalance.sub(payeeInitialBalance);

                await expect(contractDiff).to.be.bignumber.equal(expectedDiff.neg());
                await expect(payeeDiff).to.be.bignumber.equal(expectedDiff);
            }
        });

        it('should increase `totalReleased()` by the sent amount of Ether', async () => {
            // Send some Ether (1000) to the contract so we can release it
            const amount = 1000;
            await this.contract.sendTransaction({value: amount, from: this.adminAccount});

            const initialTotalReleased = await this.contract.totalReleased({from: this.adminAccount});
            const payeeInitialBalance = new BN(await web3.eth.getBalance(accounts[0]));

            await this.contract.release(0, {from: this.adminAccount});

            const finalTotalReleased = await this.contract.totalReleased({from: this.adminAccount});
            const payeeFinalBalance = new BN(await web3.eth.getBalance(accounts[0]));
            const payeeDiff = payeeFinalBalance.sub(payeeInitialBalance);
            const totalReleasedDiff = finalTotalReleased.sub(initialTotalReleased);

            await expect(totalReleasedDiff).to.be.bignumber.equal(payeeDiff);
        });

        it('should increase `released()` by the sent amount of Ether', async () => {
            // Send some Ether (1000) to the contract so we can release it
            const amount = 1000;
            await this.contract.sendTransaction({value: amount, from: this.adminAccount});

            for (let i = 0; i < this.payees.length; ++i) {
                const initialReleased = await this.contract.released(i, {from: this.adminAccount});
                const payeeInitialBalance = new BN(await web3.eth.getBalance(accounts[i * this.payeeAddressesNb]));

                await this.contract.release(i, {from: this.adminAccount});

                const finalReleased = await this.contract.released(i, {from: this.adminAccount});
                const payeeFinalBalance = new BN(await web3.eth.getBalance(accounts[i * this.payeeAddressesNb]));
                const payeeDiff = payeeFinalBalance.sub(payeeInitialBalance);
                const releasedDiff = finalReleased.sub(initialReleased);

                await expect(releasedDiff).to.be.bignumber.equal(payeeDiff);
            }
        });
    });
});
