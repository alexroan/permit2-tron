// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {PermitSignature} from "./utils/PermitSignature.sol";
import {PermitHash} from "../src/libraries/PermitHash.sol";
import {IAllowanceTransfer} from "../src/interfaces/IAllowanceTransfer.sol";
import {ISignatureTransfer} from "../src/interfaces/ISignatureTransfer.sol";
import {MockSignatureVerification} from "./mocks/MockSignatureVerification.sol";
import {MockHash} from "./mocks/MockHash.sol";
import {AddressBuilder} from "./utils/AddressBuilder.sol";
import {SignatureVerification} from "../src/libraries/SignatureVerification.sol";

contract TypehashGeneration is Test, PermitSignature {
    using PermitHash for *;
    using AddressBuilder for address[];

    MockHash mockHash;

    uint256 PRIV_KEY_TEST =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address from = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    address verifyingContract;
    uint256 chainId;

    address token1;
    address token2;
    address spender;
    uint160 amount;
    uint48 expiration;
    uint256 sigDeadline;
    uint48 nonce;

    bytes32 DOMAIN_SEPARATOR;

    bytes32 WITNESS_TYPE_HASH =
        keccak256("MockWitness(address person,uint256 amount)");

    MockSignatureVerification mockSig;

    address person = 0xd5F5175D014F28c85F7D67A111C2c9335D7CD771;

    struct MockWitness {
        address person;
        uint256 amount;
    }

    function setUp() public {
        mockHash = new MockHash();
        // hardcoding these to match mm inputs
        verifyingContract = 0xCe71065D4017F316EC606Fe4422e11eB2c47c246;
        chainId = 1;
        token1 = 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984;
        token2 = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
        spender = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
        amount = 100;
        expiration = 946902158100;
        sigDeadline = 146902158100;
        nonce = 0;

        DOMAIN_SEPARATOR = _buildDomainSeparator();

        mockSig = new MockSignatureVerification();
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        bytes32 nameHash = keccak256("Permit2");
        bytes32 typeHash = keccak256(
            "TIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );
        // TIP-712: encode address as uint160
        return
            keccak256(
                abi.encode(
                    typeHash,
                    nameHash,
                    chainId,
                    uint160(verifyingContract)
                )
            );
    }

    function testPermitSingle() public {
        // Instead of using hardcoded metamask signatures, generate them dynamically
        // to match our TIP-712 implementation

        // generate local data
        IAllowanceTransfer.PermitDetails memory details = IAllowanceTransfer
            .PermitDetails({
                token: token1,
                amount: amount,
                expiration: expiration,
                nonce: nonce
            });

        IAllowanceTransfer.PermitSingle memory permit = IAllowanceTransfer
            .PermitSingle({
                details: details,
                spender: spender,
                sigDeadline: sigDeadline
            });

        // generate hash of local data
        bytes32 hashedPermit = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, permit.hash())
        );

        // Sign with the test private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIV_KEY_TEST, hashedPermit);
        bytes memory sig = bytes.concat(r, s, bytes1(v));

        // verify the signed data againt the locally generated hash
        // this should not revert, validating that from is indeed the signer
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitBatch() public {
        // Instead of using hardcoded metamask signatures, generate them dynamically
        // to match our TIP-712 implementation

        // generate local data
        address[] memory tokens = AddressBuilder.fill(1, token1).push(token2);
        IAllowanceTransfer.PermitDetails[]
            memory details = new IAllowanceTransfer.PermitDetails[](
                tokens.length
            );

        for (uint256 i = 0; i < tokens.length; ++i) {
            details[i] = IAllowanceTransfer.PermitDetails({
                token: tokens[i],
                amount: amount,
                expiration: expiration,
                nonce: nonce
            });
        }

        IAllowanceTransfer.PermitBatch memory permit = IAllowanceTransfer
            .PermitBatch({
                details: details,
                spender: spender,
                sigDeadline: sigDeadline
            });

        // generate hash of local data
        bytes32 hashedPermit = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, permit.hash())
        );

        // Sign with the test private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIV_KEY_TEST, hashedPermit);
        bytes memory sig = bytes.concat(r, s, bytes1(v));

        // verify the signed data againt the locally generated hash
        // this should not revert, validating that from is indeed the signer
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitTransferFrom() public {
        // Instead of using hardcoded metamask signatures, generate them dynamically
        // to match our TIP-712 implementation

        ISignatureTransfer.PermitTransferFrom
            memory permitTransferFrom = ISignatureTransfer.PermitTransferFrom({
                permitted: ISignatureTransfer.TokenPermissions({
                    token: token1,
                    amount: amount
                }),
                nonce: nonce,
                deadline: sigDeadline
            });

        vm.prank(spender);
        bytes32 permitTransferFromHash = mockHash.hash(permitTransferFrom);
        bytes32 hashedPermit = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                permitTransferFromHash
            )
        );

        // Sign with the test private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIV_KEY_TEST, hashedPermit);
        bytes memory sig = bytes.concat(r, s, bytes1(v));

        // verify the signed data againt the locally generated hash
        // this should not revert, validating that from is indeed the signer
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitBatchTransferFrom() public {
        // Instead of using hardcoded metamask signatures, generate them dynamically
        // to match our TIP-712 implementation

        address[] memory tokens = AddressBuilder.fill(1, token1).push(token2);

        ISignatureTransfer.TokenPermissions[]
            memory permitted = new ISignatureTransfer.TokenPermissions[](
                tokens.length
            );

        for (uint256 i = 0; i < tokens.length; ++i) {
            permitted[i] = ISignatureTransfer.TokenPermissions({
                token: tokens[i],
                amount: amount
            });
        }
        ISignatureTransfer.PermitBatchTransferFrom
            memory permitBatchTransferFrom = ISignatureTransfer
                .PermitBatchTransferFrom({
                    permitted: permitted,
                    nonce: nonce,
                    deadline: sigDeadline
                });

        vm.prank(spender);
        bytes32 permitBatchTransferFromHash = mockHash.hash(
            permitBatchTransferFrom
        );
        bytes32 hashedPermit = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                permitBatchTransferFromHash
            )
        );

        // Sign with the test private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIV_KEY_TEST, hashedPermit);
        bytes memory sig = bytes.concat(r, s, bytes1(v));

        // verify the signed data againt the locally generated hash
        // this should not revert, validating that from is indeed the signer
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitTransferFromWithWitness() public {
        string
            memory WITNESS_TYPE_STRING_STUB = "MockWitness witness)MockWitness(address person,uint256 amount)TokenPermissions(address token,uint256 amount)";
        bytes32 hashedPermit = _getLocalSingleWitnessHash(
            amount,
            WITNESS_TYPE_STRING_STUB
        );

        // Sign with the test private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIV_KEY_TEST, hashedPermit);
        bytes memory sig = bytes.concat(r, s, bytes1(v));

        // verify the signed data againt the locally generated hash
        // this should not revert, validating that from is indeed the signer
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitTransferFromWithWitnessIncorrectTypehashStub() public {
        string
            memory INCORRECT_WITNESS_TYPE_STRING_STUB = "MockWitness witness)TokenPermissions(address token,uint256 amount)MockWitness(address person,uint256 amount)";
        bytes memory sig = _getSingleWitnessMetamaskSignature();
        bytes32 hashedPermit = _getLocalSingleWitnessHash(
            amount,
            INCORRECT_WITNESS_TYPE_STRING_STUB
        );

        // verify the signed data againt the locally generated hash
        // should revert since the typehash is incorrect
        vm.expectRevert(SignatureVerification.InvalidSigner.selector);
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitTransferFromWithWitnessIncorrectPermitData() public {
        string
            memory WITNESS_TYPE_STRING_STUB = "MockWitness witness)MockWitness(address person,uint256 amount)TokenPermissions(address token,uint256 amount)";
        bytes memory sig = _getSingleWitnessMetamaskSignature();
        uint256 incorrectAmount = 10000000000;
        bytes32 hashedPermit = _getLocalSingleWitnessHash(
            incorrectAmount,
            WITNESS_TYPE_STRING_STUB
        );

        // verify the signed data againt the locally generated hash
        // should revert since the incorrect amount is passed
        vm.expectRevert(SignatureVerification.InvalidSigner.selector);
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitBatchTransferFromWithWitness() public {
        string
            memory WITNESS_TYPE_STRING_STUB = "MockWitness witness)MockWitness(address person,uint256 amount)TokenPermissions(address token,uint256 amount)";
        bytes32 hashedPermit = _getLocalBatchedWitnessHash(
            amount,
            WITNESS_TYPE_STRING_STUB
        );

        // Sign with the test private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIV_KEY_TEST, hashedPermit);
        bytes memory sig = bytes.concat(r, s, bytes1(v));

        // verify the signed data againt the locally generated hash
        // this should not revert, validating that from is indeed the signer
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitBatchTransferFromWithWitnessIncorrectTypehashStub()
        public
    {
        string
            memory INCORRECT_WITNESS_TYPE_STRING_STUB = "MockWitness witness)TokenPermissions(address token,uint256 amount)MockWitness(address person,uint256 amount)";
        bytes memory sig = _getBatchedWitnessMetamaskSignature();
        bytes32 hashedPermit = _getLocalBatchedWitnessHash(
            amount,
            INCORRECT_WITNESS_TYPE_STRING_STUB
        );

        // verify the signed data againt the locally generated hash
        // this should revert since the typehash is incorrect
        vm.expectRevert(SignatureVerification.InvalidSigner.selector);
        mockSig.verify(sig, hashedPermit, from);
    }

    function testPermitBatchTransferFromWithWitnessIncorrectPermitData()
        public
    {
        string
            memory INCORRECT_WITNESS_TYPE_STRING_STUB = "MockWitness witness)TokenPermissions(address token,uint256 amount)MockWitness(address person,uint256 amount)";
        bytes memory sig = _getBatchedWitnessMetamaskSignature();
        uint256 incorrectAmount = 100000000000;
        bytes32 hashedPermit = _getLocalBatchedWitnessHash(
            incorrectAmount,
            INCORRECT_WITNESS_TYPE_STRING_STUB
        );

        // verify the signed data againt the locally generated hash
        // this should revert since the incorrect amount is passed
        vm.expectRevert(SignatureVerification.InvalidSigner.selector);
        mockSig.verify(sig, hashedPermit, from);
    }

    function _getSingleWitnessMetamaskSignature()
        private
        pure
        returns (bytes memory sig)
    {
        // metamask wallet signed data
        // 0x6cf7721a2a489c29d86fe0bb9b1f5f440a6a7e3fea5f5533ec080068025a7d4f30d7d8452106654827fd3b44f24260bacb8cf191ec185fc19fc24f5941d573d71c
        bytes32 r = 0x6cf7721a2a489c29d86fe0bb9b1f5f440a6a7e3fea5f5533ec080068025a7d4f;
        bytes32 s = 0x30d7d8452106654827fd3b44f24260bacb8cf191ec185fc19fc24f5941d573d7;
        uint8 v = 0x1c;

        sig = bytes.concat(r, s, bytes1(v));
    }

    function _getLocalSingleWitnessHash(
        uint256 amountToHash,
        string memory typehashStub
    ) private returns (bytes32 hashedPermit) {
        ISignatureTransfer.PermitTransferFrom
            memory permitTransferFrom = ISignatureTransfer.PermitTransferFrom({
                permitted: ISignatureTransfer.TokenPermissions({
                    token: token1,
                    amount: amountToHash
                }),
                nonce: nonce,
                deadline: sigDeadline
            });

        MockWitness memory witness = MockWitness({
            person: person,
            amount: amount
        });
        bytes32 hashedWitness = hashTypedWitness(WITNESS_TYPE_HASH, witness);

        vm.prank(spender);
        bytes32 permitTrasferFromWitnessHash = mockHash.hashWithWitness(
            permitTransferFrom,
            hashedWitness,
            typehashStub
        );

        hashedPermit = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                permitTrasferFromWitnessHash
            )
        );
    }

    function _getBatchedWitnessMetamaskSignature()
        private
        pure
        returns (bytes memory sig)
    {
        // metamask wallet signed data
        // 0x0dff2ebed15802a2a21eaac44a12fb182ac41771aaaf6ff33a6a5c78ac66aec306e693dba180302dc0b6aecd97261adfa91f27fd0964e71f58c8b40444ce2f7a1b
        bytes32 r = 0x0dff2ebed15802a2a21eaac44a12fb182ac41771aaaf6ff33a6a5c78ac66aec3;
        bytes32 s = 0x06e693dba180302dc0b6aecd97261adfa91f27fd0964e71f58c8b40444ce2f7a;
        uint8 v = 0x1b;

        sig = bytes.concat(r, s, bytes1(v));
    }

    function _getLocalBatchedWitnessHash(
        uint256 amountToHash,
        string memory typehashStub
    ) private returns (bytes32 hashedPermit) {
        MockWitness memory witness = MockWitness({
            person: person,
            amount: amount
        });
        bytes32 hashedWitness = hashTypedWitness(WITNESS_TYPE_HASH, witness);

        address[] memory tokens = AddressBuilder.fill(1, token1).push(token2);
        ISignatureTransfer.TokenPermissions[]
            memory permitted = new ISignatureTransfer.TokenPermissions[](
                tokens.length
            );
        for (uint256 i = 0; i < tokens.length; ++i) {
            permitted[i] = ISignatureTransfer.TokenPermissions({
                token: tokens[i],
                amount: amountToHash
            });
        }
        ISignatureTransfer.PermitBatchTransferFrom
            memory permitBatchTransferFrom = ISignatureTransfer
                .PermitBatchTransferFrom({
                    permitted: permitted,
                    nonce: nonce,
                    deadline: sigDeadline
                });

        vm.prank(spender);
        bytes32 permitBatchTransferFromWitnessHash = mockHash.hashWithWitness(
            permitBatchTransferFrom,
            hashedWitness,
            typehashStub
        );
        hashedPermit = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                permitBatchTransferFromWitnessHash
            )
        );
    }

    function hashTypedWitness(
        bytes32 typehash,
        MockWitness memory typedWitness
    ) private pure returns (bytes32 witness) {
        return keccak256(abi.encode(typehash, typedWitness));
    }
}
