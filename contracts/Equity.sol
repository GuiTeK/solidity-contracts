// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title Equity
 * @dev This contract, based on OpenZeppelin's PaymentSplitter contract (see
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/finance/PaymentSplitter.sol) allows to
 * receive Ether (minting/selling fees) from another contract (or any Ethereum address really) and store it for the
 * registered _payees_. The payees can then withdraw Ether from the contract proportionally to the _shares_ they own.
 *
 * The split, like the payees, is set at contract creation and _cannot_ be changed afterwards. The split can be in equal
 * parts or in any other arbitrary proportion. The way this is specified is by assigning each payee to a number of
 * shares. Of all the Ether that this contract receives, each payee will then be able to claim an amount proportional to
 * the percentage of total shares they were assigned.
 *
 * This contract was added the feature of _backup addresses_ (which are not part of the original OpenZeppelin's
 * PaymentSplitter contract) in case the first(s) address(es) of a payee are compromised. In such case, any other payee
 * can call {useNextAddress} to disable the current and previous addresses and use the next available one. The last
 * address cannot be disabled.
 *
 * `Equity` follows a _pull payment_ model. This means that payments are not automatically forwarded to the payees but
 * kept in this contract, and the actual transfer is triggered as a separate step by calling the {release} function.
 */
contract Equity is Context {
    using SafeMath for uint256;

    event PayeeAdded(uint256 payeeIndex, address[] addresses, uint256 shares);
    event PayeeNextAddressUsed(uint256 payeeIndex, uint256 newAddressIndex);
    event PaymentReleased(uint256 payeeIndex, address to, uint256 amount);
    event PaymentReceived(address from, uint256 amount);

    uint256 private _totalShares;
    uint256 private _totalReleased;

    mapping(uint256 => uint256) private _shares; // payee index => payee owned shares
    mapping(uint256 => uint256) private _released; // payee index => payee released sum

    // Needs to be kept as an array because we need to iterate over it.
    address[][] private _payees;

    mapping(uint256 => uint256) private _payeesEnabledAddressIndex; // payee index => enabled address index

    uint8 private constant PAYEE_ADDRESSES_NB = 3;


    /**
     * @dev Creates an instance of `Equity` with a list of `payees` where each one is assigned the number of shares at
     * the matching position in the `shares_` array.
     *
     * All addresses in `payees` must be non-zero. Both arrays must have the same non-zero length, and there must be no
     * duplicates in `payees`.
     */
    constructor(address[][] memory payees, uint256[] memory shares_) payable {
        require(payees.length == shares_.length, "Equity: payees and shares length mismatch");
        require(payees.length > 0, "Equity: no payees");

        for (uint256 i = 0; i < payees.length; i++) {
            require(payees[i].length == PAYEE_ADDRESSES_NB, "Equity: bad payee addresses number");
            _addPayee(i, payees[i], shares_[i]);
        }
    }

    /**
     * @dev The Ether received will be logged with {PaymentReceived} events. Note that these events are not fully
     * reliable: it's possible for a contract to receive Ether without triggering this function. This only affects the
     * reliability of the events, and not the actual splitting of Ether.
     *
     * To learn more about this see the Solidity documentation for
     * https://solidity.readthedocs.io/en/latest/contracts.html#fallback-function.
     */
    fallback() external payable {
        emit PaymentReceived(_msgSender(), msg.value);
    }

    /**
     * @dev Getter for the number of payees.
     */
    function payeesNb() public view returns (uint256) {
        return _payees.length;
    }

    /**
     * @dev Getter for a payee's addresses.
     */
    function payeeAddresses(uint256 payeeIndex) public view returns (address[] memory) {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        return _payees[payeeIndex];
    }

    /**
     * @dev Getter for the total shares held by payees.
     */
    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    /**
     * @dev Getter for the total amount of Ether already released.
     */
    function totalReleased() public view returns (uint256) {
        return _totalReleased;
    }

    /**
     * @dev Getter for the amount of shares held by a payee.
     */
    function shares(uint256 payeeIndex) public view returns (uint256) {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        return _shares[payeeIndex];
    }

    /**
     * @dev Getter for the amount of Ether already released to a payee.
     */
    function released(uint256 payeeIndex) public view returns (uint256) {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        return _released[payeeIndex];
    }

    /**
     * @dev Getter for the active address index of a payee.
     */
    function payeeEnabledAddressIndex(uint256 payeeIndex) public view returns (uint256) {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        return _payeesEnabledAddressIndex[payeeIndex];
    }

    /**
     * @dev Getter for the active address of a payee.
     */
    function payeeEnabledAddress(uint256 payeeIndex) public view returns (address) {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        return _payees[payeeIndex][payeeEnabledAddressIndex(payeeIndex)];
    }

    /**
     * @dev Disable the current and all previous addresses of payee referenced by `payeeIndex` and enable the next one.
     * The last address of a payee _cannot_ be disabled. Only addresses from other payees can call this function.
     */
    function useNextAddress(uint256 payeeIndex) public {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        require(_payeesEnabledAddressIndex[payeeIndex] + 1 < PAYEE_ADDRESSES_NB, "Equity: all addresses already used");

        (bool callerIsAPayee, uint256 callerPayeeIndex, bool callerAddressIsEnabled) = _callerPayeeIndex();
        require(callerIsAPayee == true, "Equity: caller is not a payee");
        require(callerPayeeIndex != payeeIndex, "Equity: payee cannot disable their own addresses");
        require(callerAddressIsEnabled == true, "Equity: caller payee address is disabled");

        _payeesEnabledAddressIndex[payeeIndex] += 1;
        emit PayeeNextAddressUsed(payeeIndex, _payeesEnabledAddressIndex[payeeIndex]);
    }

    /**
     * @dev Triggers a transfer to the payee referenced by `payeeIndex` of the amount of Ether they are owed, according
     * to their percentage of the total shares and their previous withdrawals.
     */
    function release(uint256 payeeIndex) public {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        require(_shares[payeeIndex] > 0, "Equity: payee has no shares");

        uint256 totalReceived = address(this).balance + totalReleased();
        uint256 payment = _pendingPayment(payeeIndex, totalReceived, released(payeeIndex));
        address payeeAddress = payeeEnabledAddress(payeeIndex);

        require(payment != 0, "Equity: payee is not due payment");

        _released[payeeIndex] += payment;
        _totalReleased += payment;

        Address.sendValue(payable(payeeAddress), payment);
        emit PaymentReleased(payeeIndex, payeeAddress, payment);
    }

    /**
     * @dev Getter for the payee index of the message caller (if the caller is a payee at all).
     * @return A tuple of three values, respectively:
     * - bool: whether the caller is a payee
     * - uint256: the payee index of the caller (or 0 if it's not a payee)
     * - bool: whether the caller address is enabled (or false if it's not a payee)
     */
    function _callerPayeeIndex() private view returns (bool, uint256, bool) {
        for (uint256 i = 0; i < _payees.length; i++) {
            for (uint256 j = 0; j < _payees[i].length; j++) {
                if (_payees[i][j] == _msgSender()) {
                    return (true, i, _isPayeeAddressIndexEnabled(i, j));
                }
            }
        }

        return (false, 0, false);
    }

    function _isPayeeAddressIndexEnabled(uint256 payeeIndex, uint256 addressIndex) private view returns (bool) {
        return addressIndex >= _payeesEnabledAddressIndex[payeeIndex];
    }

    /**
     * @dev Internal logic for computing the pending payment of a payee given the historical balances and already
     * released amounts.
     */
    function _pendingPayment(
        uint256 payeeIndex,
        uint256 totalReceived,
        uint256 payeeAlreadyReleased
    ) private view returns (uint256) {
        require(payeeIndex < _payees.length, "Equity: bad payee index");
        return (totalReceived * _shares[payeeIndex]) / _totalShares - payeeAlreadyReleased;
    }

    /**
     * @dev Add a new payee to the contract.
     * @param payeeIndex Index (unique ID) of the payee to add.
     * @param addresses The addresses of the payee to add.
     * @param shares_ The number of shares owned by the payee.
     */
    function _addPayee(uint256 payeeIndex, address[] memory addresses, uint256 shares_) private {
        require(payeeIndex == _payees.length, "Equity: payee index already exists");
        require(addresses.length == PAYEE_ADDRESSES_NB, "Equity: bad payee addresses number");
        require(_shares[payeeIndex] == 0, "Equity: payee already has shares");
        require(shares_ > 0, "Equity: shares are 0");

        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i] != address(0), "Equity: address is the zero address");
        }

        _payees.push(addresses);

        _shares[payeeIndex] = shares_;
        _totalShares = _totalShares + shares_;

        emit PayeeAdded(payeeIndex, addresses, shares_);
    }
}
