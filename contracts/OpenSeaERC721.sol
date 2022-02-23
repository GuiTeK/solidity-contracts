// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title OpenSeaERC721
 * @dev This contract, based on OpenZeppelin's `ERC721` contract (see
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/extensions/ERC721.sol),
 * adds functions required by OpenSea to properly list NFTs on the platform. The required functions are:
 * - `baseTokenURI()` (already implemented in OpenZeppelin's `ERC721` contract as `_baseURI()` but not exposed, so we
 *    expose it here as `baseTokenURI()`)
 * - `tokenURI()` (already implemented in OpenZeppelin's `ERC721` contract, so we have nothing to do)
 * - `contractURI()`
 */
abstract contract OpenSeaERC721 is ERC721 {
    string private _baseTokenURI;
    string private _contractURI;

    constructor(string memory baseTokenURI_, string memory contractURI_) {
        _baseTokenURI = baseTokenURI_;
        _contractURI = contractURI_;
    }

    /**
     * @dev /!\ POLYGON ONLY /!\ ----- Comment out this function if not using Polygon.
     * Allows OpenSea Polygon proxy contract to manage all the tokens of the contract and, in conjunction with
     * meta-transactions (see `_msgSender()` override), enables gasless minting.
     * C.F. https://docs.opensea.io/docs/polygon-basic-integration
     */
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        if (operator == address(0x58807baD0B376efc12F5AD86aAc70E78ed67deaE)) {
            return true;
        }

        return ERC721.isApprovedForAll(owner, operator);
    }

    /**
     * @dev /!\ POLYGON ONLY /!\ ----- Comment out this function if not using Polygon.
     * Allows for meta-transactions and, in conjunction with the use of OpenSea Polygon proxy contract
     * (see `isApprovedForAll()` override), enables gasless minting.
     * C.F. https://docs.opensea.io/docs/polygon-basic-integration
     */
    function _msgSender() internal view virtual override returns (address sender) {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;

            assembly {
                // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(
                mload(add(array, index)),
                0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = msg.sender;
        }

        return sender;
    }

    /**
     * @dev Required by OpenSea. Redundant with OpenZeppelin's `ERC721._baseURI()`, so let's just make it a wrapper of
     * `_baseURI()`. Child contracts should override `_baseURI()` and NOT `baseTokenURI()`.
     * @return The base token URI, e.g. `ipfs://`.
     */
    function baseTokenURI() public view virtual returns (string memory) {
        return _baseURI();
    }

    /*
     * @inheritdoc ERC721
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Required by OpenSea.
     * @return The contract URI, e.g. `ipfs://{CID}`.
     */
    function contractURI() public view virtual returns (string memory) {
        return _contractURI;
    }
}
