// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title  MathsBlitzEscrow
 * @notice Two-player wager escrow in **native CELO**, settled by an authorised
 *         off-chain signer. Winner receives 95 % of the pot; treasury receives 5 %.
 *
 * Flow
 * ----
 * 1. player1 calls createMatch(matchId){value: wager}  → match is OPEN
 * 2. player2 calls joinMatch(matchId){value: wager}     → match is ACTIVE
 * 3. backend signer calls settleMatch(matchId, winner, sig) → distributes pot
 *
 * Native CELO is the chain's gas currency (18 decimals, same as ETH), so all
 * stakes and payouts use `msg.value` / `call{value:}` rather than ERC-20 transfers.
 */
contract MathsBlitzEscrow is Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum MatchStatus {
        NonExistent,
        Open,
        Active,
        Settled,
        Cancelled
    }

    struct Match {
        address player1;
        address player2;
        uint256 wager; // per-player stake in native CELO (wei)
        MatchStatus status;
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant WINNER_BPS = 9500; // 95 %
    uint256 public constant TREASURY_BPS = 500; // 5 %
    uint256 public constant BPS_DENOM = 10_000;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Address that receives the 5 % treasury cut.
    address public treasury;

    /// @notice Off-chain signer authorised to submit settlement proofs.
    address public authorizedSigner;

    /// @dev matchId → Match
    mapping(bytes32 => Match) private _matches;

    /// @dev Replay-protection: settlement digests already consumed.
    mapping(bytes32 => bool) private _usedSettlements;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MatchCreated(bytes32 indexed matchId, address indexed player1, uint256 wager);
    event MatchJoined(bytes32 indexed matchId, address indexed player2);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 winnerAmount, uint256 treasuryAmount);
    event MatchCancelled(bytes32 indexed matchId);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event AuthorizedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error MatchAlreadyExists(bytes32 matchId);
    error MatchNotOpen(bytes32 matchId);
    error MatchNotActive(bytes32 matchId);
    error CannotJoinOwnMatch();
    error WinnerNotAPlayer(bytes32 matchId, address winner);
    error WrongStake(uint256 expected, uint256 sent);
    error InvalidSignature();
    error SettlementAlreadyUsed();
    error NotAuthorized();
    error ZeroAddress();
    error ZeroWager();
    error TransferFailed();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _treasury         Address that receives the 5 % fee.
     * @param _authorizedSigner Off-chain signer that approves settlements.
     */
    constructor(address _treasury, address _authorizedSigner) Ownable(msg.sender) {
        if (_treasury == address(0) || _authorizedSigner == address(0)) revert ZeroAddress();

        treasury = _treasury;
        authorizedSigner = _authorizedSigner;
    }

    // ─── External ─────────────────────────────────────────────────────────────

    /**
     * @notice Player 1 opens a match and stakes `msg.value` CELO.
     * @param matchId Unique identifier for this match (generated off-chain, e.g. keccak256 of DB id).
     *                The per-player wager is fixed to the CELO sent with this call.
     */
    function createMatch(bytes32 matchId) external payable whenNotPaused {
        if (msg.value == 0) revert ZeroWager();
        if (_matches[matchId].status != MatchStatus.NonExistent) revert MatchAlreadyExists(matchId);

        _matches[matchId] = Match({
            player1: msg.sender,
            player2: address(0),
            wager: msg.value,
            status: MatchStatus.Open
        });

        emit MatchCreated(matchId, msg.sender, msg.value);
    }

    /**
     * @notice Player 2 joins an open match by matching the exact wager in CELO.
     * @param matchId The match to join.
     */
    function joinMatch(bytes32 matchId) external payable whenNotPaused {
        Match storage m = _matches[matchId];
        if (m.status != MatchStatus.Open) revert MatchNotOpen(matchId);
        if (m.player1 == msg.sender) revert CannotJoinOwnMatch();
        if (msg.value != m.wager) revert WrongStake(m.wager, msg.value);

        m.player2 = msg.sender;
        m.status = MatchStatus.Active;

        emit MatchJoined(matchId, msg.sender);
    }

    /**
     * @notice Settle an active match. Must be called by the owner OR accompanied
     *         by a valid authorised-signer signature. This is the only path that
     *         releases the escrowed pot.
     *
     * @param matchId   The match to settle.
     * @param winner    Either player1 or player2.
     * @param signature ECDSA signature over the settlement digest produced by
     *                  `authorizedSigner`. Required when caller is not the owner.
     */
    function settleMatch(
        bytes32 matchId,
        address winner,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        Match storage m = _matches[matchId];
        if (m.status != MatchStatus.Active) revert MatchNotActive(matchId);
        if (winner != m.player1 && winner != m.player2) revert WinnerNotAPlayer(matchId, winner);

        bytes32 digest = _settlementDigest(matchId, winner);

        if (msg.sender != owner()) {
            // Non-owner path: verify authorised-signer signature
            if (_usedSettlements[digest]) revert SettlementAlreadyUsed();
            address recovered = MessageHashUtils.toEthSignedMessageHash(digest).recover(signature);
            if (recovered != authorizedSigner) revert InvalidSignature();
        }

        _usedSettlements[digest] = true;
        m.status = MatchStatus.Settled;

        uint256 pot = m.wager * 2;
        uint256 winnerAmount = (pot * WINNER_BPS) / BPS_DENOM;
        uint256 treasuryAmount = pot - winnerAmount; // captures any rounding dust

        _sendValue(winner, winnerAmount);
        _sendValue(treasury, treasuryAmount);

        emit MatchSettled(matchId, winner, winnerAmount, treasuryAmount);
    }

    /**
     * @notice Cancel an Open match and refund player1's stake. Callable by
     *         player1 (to reclaim an unmatched stake) or the owner (emergency).
     */
    function cancelMatch(bytes32 matchId) external nonReentrant {
        Match storage m = _matches[matchId];
        if (m.status != MatchStatus.Open) revert MatchNotOpen(matchId);
        if (msg.sender != m.player1 && msg.sender != owner()) revert NotAuthorized();

        uint256 refund = m.wager;
        address player1 = m.player1;
        m.status = MatchStatus.Cancelled;

        _sendValue(player1, refund);

        emit MatchCancelled(matchId);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return _matches[matchId];
    }

    function isSettlementUsed(bytes32 matchId, address winner) external view returns (bool) {
        return _usedSettlements[_settlementDigest(matchId, winner)];
    }

    /// @notice The exact digest the authorised signer must sign for a settlement.
    function settlementDigest(bytes32 matchId, address winner) external view returns (bytes32) {
        return _settlementDigest(matchId, winner);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function setAuthorizedSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        emit AuthorizedSignerUpdated(authorizedSigner, _signer);
        authorizedSigner = _signer;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @dev Deterministic digest for a settlement claim.
     *      Binds to contract address + chainId to prevent cross-chain/cross-contract replay.
     */
    function _settlementDigest(bytes32 matchId, address winner) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(matchId, winner, address(this), block.chainid));
    }

    /// @dev Forward `amount` native CELO to `to`, reverting on failure.
    function _sendValue(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
