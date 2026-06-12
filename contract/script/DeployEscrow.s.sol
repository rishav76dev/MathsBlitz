// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MathsBlitzEscrow.sol";

/**
 * @notice Deploys MathsBlitzEscrow.
 *
 * Required env vars:
 *   PRIVATE_KEY        - deployer key (becomes contract owner)
 *   TREASURY_ADDRESS   - receives the 5 % cut
 *   AUTHORIZED_SIGNER  - backend signer allowed to settle matches
 *
 * Example (Alfajores):
 *   forge script script/DeployEscrow.s.sol:DeployEscrow \
 *     --rpc-url https://alfajores-forno.celo-testnet.org \
 *     --broadcast
 */
contract DeployEscrow is Script {
    function run() external returns (MathsBlitzEscrow escrow) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address signer = vm.envAddress("AUTHORIZED_SIGNER");

        vm.startBroadcast(deployerPk);
        escrow = new MathsBlitzEscrow(treasury, signer);
        vm.stopBroadcast();

        console.log("MathsBlitzEscrow deployed at:", address(escrow));
        console.log("  owner:    ", escrow.owner());
        console.log("  treasury: ", escrow.treasury());
        console.log("  signer:   ", escrow.authorizedSigner());
    }
}
