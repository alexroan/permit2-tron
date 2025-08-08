// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {ISignatureTransfer} from "./interfaces/ISignatureTransfer.sol";
import {SignatureVerification} from "./libraries/SignatureVerification.sol";
import {PermitHash} from "./libraries/PermitHash.sol";
import {TIP712} from "./TIP712.sol";

contract TestHashing is ISignatureTransfer, TIP712 {
    using SignatureVerification for bytes;
    using PermitHash for PermitTransferFrom;

    function hashTokenPermissions(ISignatureTransfer.TokenPermissions memory permitted) public view returns (bytes32) {
        return keccak256(getTokenPermissionsEncoding(permitted));
    }
    
    // Debug function to see what uint160 value we get from an address
    function addressToUint160(address addr) public pure returns (uint160) {
        return uint160(addr);
    }
    
    // Get the TOKEN_PERMISSIONS_TYPEHASH constant
    function getTokenPermissionsTypehash() public pure returns (bytes32) {
        return PermitHash._TOKEN_PERMISSIONS_TYPEHASH;
    }
    
    // Debug function to see the exact encoding
    function getTokenPermissionsEncoding(ISignatureTransfer.TokenPermissions memory permitted) public pure returns (bytes memory) {
        return abi.encode(PermitHash._TOKEN_PERMISSIONS_TYPEHASH, uint160(permitted.token), permitted.amount);
    }

    function hashWithWitness(PermitTransferFrom memory permit, bytes32 witness, string calldata witnessTypeString) public view returns (bytes32) {
        return permit.hashWithWitness(witness, witnessTypeString);
    }

    function hashTypedData(bytes32 dataHash) public view returns (bytes32) {
        return _hashTypedData(dataHash);
    }

    function verify(bytes calldata signature, bytes32 hash, address claimedSigner) public view {
        signature.verify(hash, claimedSigner);
    }

    /// Stubs

    function nonceBitmap(address, uint256) external view returns (uint256) {return 0;}

    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external {}

    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external {}


    function permitTransferFrom(
        PermitBatchTransferFrom memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external {}

    function permitWitnessTransferFrom(
        PermitBatchTransferFrom memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external{}

    function invalidateUnorderedNonces(uint256 wordPos, uint256 mask) external{}

}
