// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import "../src/MathsBlitzEscrow.sol";

// ─── Test suite ───────────────────────────────────────────────────────────────

contract MathsBlitzEscrowTest is Test {
    // ── Contract ──
    MathsBlitzEscrow internal escrow;

    // ── Named actors ──
    address internal owner;
    address internal player1;
    address internal player2;
    address internal treasury;
    address internal stranger;
    uint256 internal signerPk;
    address internal signer;

    // ── Constants ──
    uint256 internal constant WAGER = 10 ether; // 10 CELO
    uint256 internal constant START_BAL = 100 ether;
    bytes32 internal constant MATCH_ID = keccak256("match-001");

    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        owner = makeAddr("owner");
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");
        treasury = makeAddr("treasury");
        stranger = makeAddr("stranger");
        signerPk = 0xBEEF;
        signer = vm.addr(signerPk);

        // Deploy escrow as owner
        vm.prank(owner);
        escrow = new MathsBlitzEscrow(treasury, signer);

        // Fund players with native CELO
        vm.deal(player1, START_BAL);
        vm.deal(player2, START_BAL);
        vm.deal(stranger, START_BAL);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// @dev Sign a settlement (matchId, winner) with the authorised signer key.
    function _sign(bytes32 matchId, address winner) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(matchId, winner, address(escrow), block.chainid)
        );
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _createAndJoin(bytes32 matchId) internal {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(matchId);
        vm.prank(player2);
        escrow.joinMatch{value: WAGER}(matchId);
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    function test_constructor_setsFields() public view {
        assertEq(escrow.treasury(), treasury);
        assertEq(escrow.authorizedSigner(), signer);
        assertEq(escrow.owner(), owner);
    }

    function test_constructor_revertZeroAddress() public {
        vm.expectRevert(MathsBlitzEscrow.ZeroAddress.selector);
        new MathsBlitzEscrow(address(0), signer);

        vm.expectRevert(MathsBlitzEscrow.ZeroAddress.selector);
        new MathsBlitzEscrow(treasury, address(0));
    }

    // ─── createMatch ─────────────────────────────────────────────────────────

    function test_createMatch_success() public {
        uint256 p1Before = player1.balance;

        vm.expectEmit(true, true, false, true);
        emit MathsBlitzEscrow.MatchCreated(MATCH_ID, player1, WAGER);

        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        MathsBlitzEscrow.Match memory m = escrow.getMatch(MATCH_ID);
        assertEq(m.player1, player1);
        assertEq(m.player2, address(0));
        assertEq(m.wager, WAGER);
        assertEq(uint8(m.status), uint8(MathsBlitzEscrow.MatchStatus.Open));
        assertEq(player1.balance, p1Before - WAGER);
        assertEq(address(escrow).balance, WAGER);
    }

    function test_createMatch_revertZeroWager() public {
        vm.prank(player1);
        vm.expectRevert(MathsBlitzEscrow.ZeroWager.selector);
        escrow.createMatch{value: 0}(MATCH_ID);
    }

    function test_createMatch_revertDuplicateId() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        vm.prank(player2);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchAlreadyExists.selector, MATCH_ID));
        escrow.createMatch{value: WAGER}(MATCH_ID);
    }

    function test_createMatch_revertWhenPaused() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(player1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.createMatch{value: WAGER}(MATCH_ID);
    }

    // ─── joinMatch ───────────────────────────────────────────────────────────

    function test_joinMatch_success() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        uint256 p2Before = player2.balance;

        vm.expectEmit(true, true, false, false);
        emit MathsBlitzEscrow.MatchJoined(MATCH_ID, player2);

        vm.prank(player2);
        escrow.joinMatch{value: WAGER}(MATCH_ID);

        MathsBlitzEscrow.Match memory m = escrow.getMatch(MATCH_ID);
        assertEq(m.player2, player2);
        assertEq(uint8(m.status), uint8(MathsBlitzEscrow.MatchStatus.Active));
        assertEq(player2.balance, p2Before - WAGER);
        assertEq(address(escrow).balance, WAGER * 2);
    }

    function test_joinMatch_revertWrongStake() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        vm.prank(player2);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.WrongStake.selector, WAGER, WAGER - 1));
        escrow.joinMatch{value: WAGER - 1}(MATCH_ID);
    }

    function test_joinMatch_revertNotOpen() public {
        // NonExistent
        vm.prank(player2);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchNotOpen.selector, MATCH_ID));
        escrow.joinMatch{value: WAGER}(MATCH_ID);
    }

    function test_joinMatch_revertOwnMatch() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        vm.prank(player1);
        vm.expectRevert(MathsBlitzEscrow.CannotJoinOwnMatch.selector);
        escrow.joinMatch{value: WAGER}(MATCH_ID);
    }

    function test_joinMatch_revertWhenPaused() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        vm.prank(owner);
        escrow.pause();

        vm.prank(player2);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.joinMatch{value: WAGER}(MATCH_ID);
    }

    // ─── settleMatch ─────────────────────────────────────────────────────────

    function test_settleMatch_player1Wins_viaSigner() public {
        _createAndJoin(MATCH_ID);

        uint256 pot = WAGER * 2;
        uint256 expectedWinnerAmt = (pot * 9500) / 10_000;
        uint256 expectedTreasuryAmt = pot - expectedWinnerAmt;

        uint256 p1Before = player1.balance;
        uint256 treBefore = treasury.balance;

        bytes memory sig = _sign(MATCH_ID, player1);

        vm.expectEmit(true, true, false, true);
        emit MathsBlitzEscrow.MatchSettled(MATCH_ID, player1, expectedWinnerAmt, expectedTreasuryAmt);

        vm.prank(stranger); // any caller works when sig is valid
        escrow.settleMatch(MATCH_ID, player1, sig);

        assertEq(player1.balance, p1Before + expectedWinnerAmt);
        assertEq(treasury.balance, treBefore + expectedTreasuryAmt);
        assertEq(address(escrow).balance, 0);
        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(MathsBlitzEscrow.MatchStatus.Settled));
    }

    function test_settleMatch_player2Wins_viaSigner() public {
        _createAndJoin(MATCH_ID);

        uint256 pot = WAGER * 2;
        uint256 expectedWinnerAmt = (pot * 9500) / 10_000;
        uint256 expectedTreasuryAmt = pot - expectedWinnerAmt;

        uint256 p2Before = player2.balance;

        bytes memory sig = _sign(MATCH_ID, player2);
        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player2, sig);

        assertEq(player2.balance, p2Before + expectedWinnerAmt);
        assertEq(treasury.balance, expectedTreasuryAmt);
    }

    function test_settleMatch_byOwner_noSig() public {
        _createAndJoin(MATCH_ID);

        // Owner can pass empty signature
        vm.prank(owner);
        escrow.settleMatch(MATCH_ID, player1, "");

        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(MathsBlitzEscrow.MatchStatus.Settled));
    }

    function test_settleMatch_revertNotActive() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchNotActive.selector, MATCH_ID));
        escrow.settleMatch(MATCH_ID, player1, sig);
    }

    function test_settleMatch_revertWinnerNotPlayer() public {
        _createAndJoin(MATCH_ID);

        bytes memory sig = _sign(MATCH_ID, stranger);
        vm.expectRevert(
            abi.encodeWithSelector(MathsBlitzEscrow.WinnerNotAPlayer.selector, MATCH_ID, stranger)
        );
        escrow.settleMatch(MATCH_ID, stranger, sig);
    }

    function test_settleMatch_revertBadSignature() public {
        _createAndJoin(MATCH_ID);

        // Sign with wrong key
        uint256 badPk = 0xDEAD;
        bytes32 digest = keccak256(
            abi.encodePacked(MATCH_ID, player1, address(escrow), block.chainid)
        );
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPk, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(MathsBlitzEscrow.InvalidSignature.selector);
        escrow.settleMatch(MATCH_ID, player1, badSig);
    }

    function test_settleMatch_revertDoubleSettle() public {
        _createAndJoin(MATCH_ID);

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player1, sig);

        // Second attempt on the now-Settled match reverts (double-settlement guard)
        bytes memory sig2 = _sign(MATCH_ID, player1);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchNotActive.selector, MATCH_ID));
        escrow.settleMatch(MATCH_ID, player1, sig2);
    }

    function test_settleMatch_revertWhenPaused() public {
        _createAndJoin(MATCH_ID);

        vm.prank(owner);
        escrow.pause();

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.settleMatch(MATCH_ID, player1, sig);
    }

    // ─── cancelMatch ─────────────────────────────────────────────────────────

    function test_cancelMatch_byPlayer1() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        uint256 p1Before = player1.balance;

        vm.expectEmit(true, false, false, false);
        emit MathsBlitzEscrow.MatchCancelled(MATCH_ID);

        vm.prank(player1);
        escrow.cancelMatch(MATCH_ID);

        assertEq(player1.balance, p1Before + WAGER);
        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(MathsBlitzEscrow.MatchStatus.Cancelled));
    }

    function test_cancelMatch_byOwner() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        vm.prank(owner);
        escrow.cancelMatch(MATCH_ID);

        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(MathsBlitzEscrow.MatchStatus.Cancelled));
    }

    function test_cancelMatch_revertByStranger() public {
        vm.prank(player1);
        escrow.createMatch{value: WAGER}(MATCH_ID);

        vm.prank(stranger);
        vm.expectRevert(MathsBlitzEscrow.NotAuthorized.selector);
        escrow.cancelMatch(MATCH_ID);
    }

    function test_cancelMatch_revertNotOpen() public {
        _createAndJoin(MATCH_ID); // now ACTIVE

        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchNotOpen.selector, MATCH_ID));
        escrow.cancelMatch(MATCH_ID);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function test_setTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit MathsBlitzEscrow.TreasuryUpdated(treasury, newTreasury);
        escrow.setTreasury(newTreasury);
        assertEq(escrow.treasury(), newTreasury);
    }

    function test_setTreasury_revertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(MathsBlitzEscrow.ZeroAddress.selector);
        escrow.setTreasury(address(0));
    }

    function test_setTreasury_revertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.setTreasury(makeAddr("x"));
    }

    function test_setAuthorizedSigner() public {
        address newSigner = makeAddr("newSigner");
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit MathsBlitzEscrow.AuthorizedSignerUpdated(signer, newSigner);
        escrow.setAuthorizedSigner(newSigner);
        assertEq(escrow.authorizedSigner(), newSigner);
    }

    function test_setAuthorizedSigner_revertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(MathsBlitzEscrow.ZeroAddress.selector);
        escrow.setAuthorizedSigner(address(0));
    }

    function test_pauseUnpause() public {
        vm.prank(owner);
        escrow.pause();
        assertTrue(escrow.paused());

        vm.prank(owner);
        escrow.unpause();
        assertFalse(escrow.paused());
    }

    function test_pause_revertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.pause();
    }

    // ─── Fuzz ────────────────────────────────────────────────────────────────

    /// @dev Fuzz over wager amounts; verify 95/5 split always accounts for full pot.
    function testFuzz_payoutSplit(uint96 rawWager) public {
        uint256 wager = uint256(rawWager) + 1; // ensure > 0

        vm.deal(player1, wager);
        vm.deal(player2, wager);

        bytes32 fuzzId = keccak256(abi.encodePacked("fuzz", rawWager));
        vm.prank(player1);
        escrow.createMatch{value: wager}(fuzzId);
        vm.prank(player2);
        escrow.joinMatch{value: wager}(fuzzId);

        uint256 pot = wager * 2;
        uint256 expectedWinner = (pot * 9500) / 10_000;
        uint256 expectedTreasury = pot - expectedWinner;

        uint256 p1Before = player1.balance;
        bytes memory sig = _sign(fuzzId, player1);
        vm.prank(stranger);
        escrow.settleMatch(fuzzId, player1, sig);

        // Pot fully distributed (no dust left in escrow from this match)
        assertEq(expectedWinner + expectedTreasury, pot);
        assertEq(player1.balance, p1Before + expectedWinner);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function test_isSettlementUsed_beforeAndAfter() public {
        _createAndJoin(MATCH_ID);

        assertFalse(escrow.isSettlementUsed(MATCH_ID, player1));

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player1, sig);

        assertTrue(escrow.isSettlementUsed(MATCH_ID, player1));
    }

    function test_settlementDigest_matchesOffchain() public view {
        bytes32 expected = keccak256(
            abi.encodePacked(MATCH_ID, player1, address(escrow), block.chainid)
        );
        assertEq(escrow.settlementDigest(MATCH_ID, player1), expected);
    }

    // ─── Constants ───────────────────────────────────────────────────────────

    function test_bpsConstants() public view {
        assertEq(escrow.WINNER_BPS() + escrow.TREASURY_BPS(), escrow.BPS_DENOM());
    }

    // Allow this test contract to receive refunds/payouts in cancel/settle paths.
    receive() external payable {}
}
