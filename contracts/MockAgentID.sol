// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/** Test-only fake deployed at the official registry address with hardhat_setCode.
 * NEVER deploy/mock this contract on BNB Mainnet. AgentOrchard always uses the real registry.
 */
contract MockAgentID {
    mapping(address => uint256) public balanceOf;
    function setBalance(address owner, uint256 amount) external { balanceOf[owner] = amount; }
}
