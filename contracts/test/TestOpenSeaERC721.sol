// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../OpenSeaERC721.sol";


/**
 * @title TestOpenSeaERC721
 * @dev Concrete implementation of OpenSeaERC721 for testing purposes.
 */
contract TestOpenSeaERC721 is OpenSeaERC721 {
    constructor(string memory name_, string memory symbol_, string memory baseTokenURI_, string memory contractURI_)
        ERC721(name_, symbol_)
        OpenSeaERC721(baseTokenURI_, contractURI_) {}
}
