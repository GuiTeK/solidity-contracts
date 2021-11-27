// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 * @title LazyMintingERC721
 * @dev This contract, based on OpenZeppelin's `ERC721URIStorage` contract (see
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/extensions/ERC721URIStorage.sol)
 * adds lazy minting capability (see https://nftschool.dev/tutorial/lazy-minting) using OpenZeppelin's `EIP712` contract
 * (see
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/draft-EIP712.sol).
 *
 * Anyone with a valid voucher (i.e. a voucher cryptographically signed by the `owner()` of the contract) can mint the
 * NFT described in the voucher.
 * This allows the creator of the NFTs to not mint (and not pay the minting fees) themselves. Instead, they will issue
 * signed vouchers (off-chain, e.g. on a marketplace/website) so people can mint the tokens themselves.
 * The signature mechanism ensures that people can't mint tokens with characteristics the creator doesn't want them to.
 *
 * The implemented `NFTVoucher` struct allows to define a token's ID, minimum price (in wei) and metadata URI. It should
 * be flexible enough for most use-cases as it is pretty generic and all the token-specific data should be in its
 * metadata located off-chain at the specified metadata URI.
 * However, if for some reason you need to add fields in the `NFTVoucher` struct, you will need to edit this contract
 * directly because you can't inherit from it and modify the struct.
 */
abstract contract LazyMintingERC721 is ERC721URIStorage, EIP712, Ownable {
    /// @dev Voucher containing all the data necessary to mint an NFT.
    struct NFTVoucher {
        /// @dev ID which will be given to the NFT.
        uint256 tokenId;

        /// @dev Minimum price (in wei) required to mint the NFT.
        uint256 minPriceWei;

        /// @dev URI of the metadata of the NFT to be minted. This should contain all the NFT characteristics.
        string metadataURI;

        /// @dev The EIP-712 signature of all other fields (tokenId, minPriceWei, metadataURI) in the `NFTVoucher`
        /// struct.
        bytes signature;
    }

    mapping(bytes32 => bool) private _usedMetadataURIs;

    /*
     * @dev Checks if the `voucher` is valid and if so, mints the NFT to the `redeemer` address. Conditions for a
     * voucher to be valid are:
     * - Signature must be cryptographically valid
     * - Signature must be issued by `owner()`
     * - Ether sent with the transaction must be greater than or equal to `voucher.minPriceWei`
     * - `voucher.metadataURI` must have never been used for another minted NFT
     * - `voucher.tokenId` must have never been used for another minted NFT
     * @return The newly minted NFT ID.
     */
    function redeem(address redeemer, NFTVoucher calldata voucher) public virtual payable returns (uint256) {
        address signer = _getVoucherSigner(voucher);

        require(owner() == signer, "LazyMintingERC721: signer is not allowed");

        require(msg.value >= voucher.minPriceWei, "LazyMintingERC721: insufficient funds to redeem");

        bytes32 metadataURIHash = keccak256(bytes(voucher.metadataURI));
        require(_usedMetadataURIs[metadataURIHash] == false,
            "LazyMintingERC721: token already minted (metadata URI already used)");

        _mint(redeemer, voucher.tokenId);
        _setTokenURI(voucher.tokenId, voucher.metadataURI);
        _usedMetadataURIs[metadataURIHash] = true;

        return voucher.tokenId;
    }

    /* @dev Computes the hash of the given `voucher` using EIP-712 typed data hashing rules (see
     * https://docs.openzeppelin.com/contracts/4.x/api/utils#EIP712-_hashTypedDataV4-bytes32).
     */
    function _hash(NFTVoucher calldata voucher) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
                keccak256("NFTVoucher(uint256 tokenId,uint256 minPriceWei,string metadataURI)"),
                    voucher.tokenId, voucher.minPriceWei, keccak256(bytes(voucher.metadataURI))
            )));
    }

    /*
     * @dev Tries to get the signer of the voucher, or reverts if the signature is invalid. Does not verify that the
     * signer is authorized to mint NFTs.
     * @return The signer of the `voucher`.
     */
    function _getVoucherSigner(NFTVoucher calldata voucher) internal view returns (address) {
        bytes32 digest = _hash(voucher);
        return ECDSA.recover(digest, voucher.signature);
    }

    /*
     * @dev Intended to be called by minters. See https://github.com/protocol/nft-website/issues/121 for context.
     * @return The chain ID of the current blockchain.
     */
    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
