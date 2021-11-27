// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../LazyMintingERC721.sol";


/**
 * @title TestLazyMintingERC721
 * @dev Concrete implementation of LazyMintingERC721 for testing purposes.
 */
contract TestLazyMintingERC721 is LazyMintingERC721 {
    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
        EIP712(name_, "1") {}
}
