// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title  MathsBlitzEscrow
 * @notice Symmetric two-player wager escrow in native CELO.
 *         Both players deposit independently before matchmaking. The authorised
 *         backend signer links two deposits into a match once an opponent is
 *         found, then settles after the game.
 *
 * Flow
 * ----
 * 1. player calls  depositStake(reservationId){value: wager}   → reservation created
 * 2. server calls  linkMatch(matchId, reservA, reservB)         → match Active
 * 3. server calls  settleMatch(matchId, winner, sig)            → pot distributed
 *
 * Player can call withdrawStake(reservationId) at any time before linkMatch.
 * The authorised backend signer can call serverWithdrawStake(reservationId) on behalf
 * of the player (e.g. when they leave the matchmaking queue), so no second user
 * transaction is required.
 */
contract MathsBlitzEscrow is Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum MatchStatus {
        NonExistent,
        Active,
        Settled,
        Cancelled
    }

    struct Reservation {
        address player;
        uint256 amount;
        bool linked;
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

    address public treasury;
    address public authorizedSigner;

    // Treasury fees accumulate here instead of being pushed out on every settle.
    // They stay locked in the contract (counts as TVL) until the owner withdraws.
    uint256 public accumulatedFees;

    mapping(bytes32 => Reservation) private _reservations;
    mapping(bytes32 => Match) private _matches;
    mapping(bytes32 => bool) private _usedSettlements;

    // ─── Events ───────────────────────────────────────────────────────────────

    event StakeDeposited(bytes32 indexed reservationId, address indexed player, uint256 amount);
    event StakeWithdrawn(bytes32 indexed reservationId, address indexed player, uint256 amount);
    event MatchLinked(bytes32 indexed matchId, bytes32 indexed reservationA, bytes32 indexed reservationB, uint256 wager);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 winnerAmount, uint256 treasuryAmount);
    event MatchCancelled(bytes32 indexed matchId);
    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event AuthorizedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ReservationAlreadyExists(bytes32 reservationId);
    error ReservationNotFound(bytes32 reservationId);
    error ReservationAlreadyLinked(bytes32 reservationId);
    error MatchAlreadyExists(bytes32 matchId);
    error MatchNotActive(bytes32 matchId);
    error WinnerNotAPlayer(bytes32 matchId, address winner);
    error WagerMismatch(uint256 amountA, uint256 amountB);
    error SamePlayer();
    error InvalidSignature();
    error SettlementAlreadyUsed();
    error NotAuthorized();
    error ZeroAddress();
    error ZeroWager();
    error TransferFailed();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _treasury, address _authorizedSigner) Ownable(msg.sender) {
        if (_treasury == address(0) || _authorizedSigner == address(0)) revert ZeroAddress();
        treasury = _treasury;
        authorizedSigner = _authorizedSigner;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAuthorizedSigner() {
        if (msg.sender != authorizedSigner) revert NotAuthorized();
        _;
    }

    // ─── External ─────────────────────────────────────────────────────────────

    /**
     * @notice Lock CELO against a unique reservation ID.
     *         Call this before joining the matchmaking queue.
     * @param reservationId Unique ID derived off-chain (keccak256 of userId + timestamp).
     */
    function depositStake(bytes32 reservationId) external payable whenNotPaused {
        if (msg.value == 0) revert ZeroWager();
        if (_reservations[reservationId].player != address(0)) revert ReservationAlreadyExists(reservationId);

        _reservations[reservationId] = Reservation({
            player: msg.sender,
            amount: msg.value,
            linked: false
        });

        emit StakeDeposited(reservationId, msg.sender, msg.value);
    }

    /**
     * @notice Reclaim an unlinked stake. Only the depositing player may call this.
     * @param reservationId The reservation to withdraw.
     */
    function withdrawStake(bytes32 reservationId) external nonReentrant {
        Reservation storage r = _reservations[reservationId];
        if (r.player == address(0)) revert ReservationNotFound(reservationId);
        if (r.linked) revert ReservationAlreadyLinked(reservationId);
        if (r.player != msg.sender) revert NotAuthorized();

        uint256 amount = r.amount;
        address player = r.player;
        delete _reservations[reservationId];

        _sendValue(player, amount);
        emit StakeWithdrawn(reservationId, player, amount);
    }

    /**
     * @notice Reclaim an unlinked stake on behalf of the depositing player.
     *         Called by the authorised backend signer when a player leaves the
     *         matchmaking queue, so the player does not need to sign a second
     *         transaction.
     * @param reservationId The reservation to withdraw.
     */
    function serverWithdrawStake(bytes32 reservationId) external nonReentrant onlyAuthorizedSigner {
        Reservation storage r = _reservations[reservationId];
        if (r.player == address(0)) revert ReservationNotFound(reservationId);
        if (r.linked) revert ReservationAlreadyLinked(reservationId);

        uint256 amount = r.amount;
        address player = r.player;
        delete _reservations[reservationId];

        _sendValue(player, amount);
        emit StakeWithdrawn(reservationId, player, amount);
    }

    /**
     * @notice Link two pre-staked reservations into an active match.
     *         Only callable by the authorised backend signer.
     * @param matchId      Unique match ID (keccak256 of DB record id).
     * @param reservationA Reservation belonging to player1.
     * @param reservationB Reservation belonging to player2.
     */
    function linkMatch(
        bytes32 matchId,
        bytes32 reservationA,
        bytes32 reservationB
    ) external whenNotPaused onlyAuthorizedSigner {
        if (_matches[matchId].status != MatchStatus.NonExistent) revert MatchAlreadyExists(matchId);

        Reservation storage rA = _reservations[reservationA];
        Reservation storage rB = _reservations[reservationB];

        if (rA.player == address(0)) revert ReservationNotFound(reservationA);
        if (rB.player == address(0)) revert ReservationNotFound(reservationB);
        if (rA.linked) revert ReservationAlreadyLinked(reservationA);
        if (rB.linked) revert ReservationAlreadyLinked(reservationB);
        if (rA.amount != rB.amount) revert WagerMismatch(rA.amount, rB.amount);
        if (rA.player == rB.player) revert SamePlayer();

        rA.linked = true;
        rB.linked = true;

        _matches[matchId] = Match({
            player1: rA.player,
            player2: rB.player,
            wager: rA.amount,
            status: MatchStatus.Active
        });

        emit MatchLinked(matchId, reservationA, reservationB, rA.amount);
    }

    /**
     * @notice Settle an active match. Requires a valid authorised-signer signature,
     *         or may be called directly by the owner for emergency settlement.
     * @param matchId   The match to settle.
     * @param winner    Either player1 or player2.
     * @param signature ECDSA signature from authorizedSigner over the settlement digest.
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
            if (_usedSettlements[digest]) revert SettlementAlreadyUsed();
            address recovered = MessageHashUtils.toEthSignedMessageHash(digest).recover(signature);
            if (recovered != authorizedSigner) revert InvalidSignature();
        }

        _usedSettlements[digest] = true;
        m.status = MatchStatus.Settled;

        uint256 pot = m.wager * 2;
        uint256 winnerAmount = (pot * WINNER_BPS) / BPS_DENOM;
        uint256 treasuryAmount = pot - winnerAmount;

        // Winner is paid out immediately; the treasury cut stays locked in the
        // contract (accumulatedFees) and is withdrawn later via withdrawFees().
        accumulatedFees += treasuryAmount;
        _sendValue(winner, winnerAmount);

        emit MatchSettled(matchId, winner, winnerAmount, treasuryAmount);
    }

    /**
     * @notice Refund both players when a game ends in a draw.
     *         Called by the authorised backend signer — no manual owner action needed.
     */
    function refundDraw(bytes32 matchId) external nonReentrant onlyAuthorizedSigner {
        Match storage m = _matches[matchId];
        if (m.status != MatchStatus.Active) revert MatchNotActive(matchId);

        address p1 = m.player1;
        address p2 = m.player2;
        uint256 wager = m.wager;
        m.status = MatchStatus.Cancelled;

        _sendValue(p1, wager);
        _sendValue(p2, wager);

        emit MatchCancelled(matchId);
    }

    /**
     * @notice Emergency: cancel an active match and refund both players. Owner only.
     */
    function cancelMatch(bytes32 matchId) external nonReentrant onlyOwner {
        Match storage m = _matches[matchId];
        if (m.status != MatchStatus.Active) revert MatchNotActive(matchId);

        address p1 = m.player1;
        address p2 = m.player2;
        uint256 wager = m.wager;
        m.status = MatchStatus.Cancelled;

        _sendValue(p1, wager);
        _sendValue(p2, wager);

        emit MatchCancelled(matchId);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getReservation(bytes32 reservationId) external view returns (Reservation memory) {
        return _reservations[reservationId];
    }

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return _matches[matchId];
    }

    function isSettlementUsed(bytes32 matchId, address winner) external view returns (bool) {
        return _usedSettlements[_settlementDigest(matchId, winner)];
    }

    function settlementDigest(bytes32 matchId, address winner) external view returns (bytes32) {
        return _settlementDigest(matchId, winner);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Withdraw all accumulated treasury fees to the treasury address.
     *         Fees sit locked in the contract until this is called.
     */
    function withdrawFees() external nonReentrant onlyOwner {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        _sendValue(treasury, amount);
        emit FeesWithdrawn(treasury, amount);
    }

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

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Internal ─────────────────────────────────────────────────────────────

    // Settlement digest binds to contract address + chainId to prevent cross-chain replay.
    function _settlementDigest(bytes32 matchId, address winner) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(matchId, winner, address(this), block.chainid));
    }

    function _sendValue(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
