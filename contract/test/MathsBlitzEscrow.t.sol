// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MathsBlitzEscrow.sol";

contract MathsBlitzEscrowTest is Test {
    MathsBlitzEscrow internal escrow;

    address internal owner;
    address internal player1;
    address internal player2;
    address internal treasury;
    address internal stranger;
    uint256 internal signerPk;
    address internal signer;

    uint256 internal constant WAGER    = 10 ether;
    uint256 internal constant START_BAL = 100 ether;

    bytes32 internal constant MATCH_ID  = keccak256("match-001");
    bytes32 internal constant RESERV_A  = keccak256("reserv-player1");
    bytes32 internal constant RESERV_B  = keccak256("reserv-player2");

    function setUp() public {
        owner     = makeAddr("owner");
        player1   = makeAddr("player1");
        player2   = makeAddr("player2");
        treasury  = makeAddr("treasury");
        stranger  = makeAddr("stranger");
        signerPk  = 0xBEEF;
        signer    = vm.addr(signerPk);

        vm.prank(owner);
        escrow = new MathsBlitzEscrow(treasury, signer);

        vm.deal(player1, START_BAL);
        vm.deal(player2, START_BAL);
        vm.deal(stranger, START_BAL);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _sign(bytes32 matchId, address winner) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked(matchId, winner, address(escrow), block.chainid));
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    /// Deposit both players' stakes and link them into an active match.
    function _depositAndLink(bytes32 matchId, bytes32 reservA, bytes32 reservB) internal {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(reservA);
        vm.prank(player2);
        escrow.depositStake{value: WAGER}(reservB);
        vm.prank(signer);
        escrow.linkMatch(matchId, reservA, reservB);
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

    // ─── depositStake ─────────────────────────────────────────────────────────

    function test_depositStake_success() public {
        uint256 p1Before = player1.balance;

        vm.expectEmit(true, true, false, true);
        emit MathsBlitzEscrow.StakeDeposited(RESERV_A, player1, WAGER);

        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);

        MathsBlitzEscrow.Reservation memory r = escrow.getReservation(RESERV_A);
        assertEq(r.player, player1);
        assertEq(r.amount, WAGER);
        assertFalse(r.linked);
        assertEq(player1.balance, p1Before - WAGER);
        assertEq(address(escrow).balance, WAGER);
    }

    function test_depositStake_revertZeroWager() public {
        vm.prank(player1);
        vm.expectRevert(MathsBlitzEscrow.ZeroWager.selector);
        escrow.depositStake{value: 0}(RESERV_A);
    }

    function test_depositStake_revertDuplicate() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);

        vm.prank(player2);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.ReservationAlreadyExists.selector, RESERV_A));
        escrow.depositStake{value: WAGER}(RESERV_A);
    }

    function test_depositStake_revertWhenPaused() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(player1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.depositStake{value: WAGER}(RESERV_A);
    }

    // ─── withdrawStake ────────────────────────────────────────────────────────

    function test_withdrawStake_success() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);

        uint256 p1Before = player1.balance;

        vm.expectEmit(true, true, false, true);
        emit MathsBlitzEscrow.StakeWithdrawn(RESERV_A, player1, WAGER);

        vm.prank(player1);
        escrow.withdrawStake(RESERV_A);

        MathsBlitzEscrow.Reservation memory r = escrow.getReservation(RESERV_A);
        assertEq(r.player, address(0)); // deleted
        assertEq(player1.balance, p1Before + WAGER);
        assertEq(address(escrow).balance, 0);
    }

    function test_withdrawStake_revertNotFound() public {
        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.ReservationNotFound.selector, RESERV_A));
        escrow.withdrawStake(RESERV_A);
    }

    function test_withdrawStake_revertNotPlayer() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);

        vm.prank(stranger);
        vm.expectRevert(MathsBlitzEscrow.NotAuthorized.selector);
        escrow.withdrawStake(RESERV_A);
    }

    function test_withdrawStake_revertAlreadyLinked() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.ReservationAlreadyLinked.selector, RESERV_A));
        escrow.withdrawStake(RESERV_A);
    }

    // ─── linkMatch ────────────────────────────────────────────────────────────

    function test_linkMatch_success() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);
        vm.prank(player2);
        escrow.depositStake{value: WAGER}(RESERV_B);

        vm.expectEmit(true, true, true, true);
        emit MathsBlitzEscrow.MatchLinked(MATCH_ID, RESERV_A, RESERV_B, WAGER);

        vm.prank(signer);
        escrow.linkMatch(MATCH_ID, RESERV_A, RESERV_B);

        MathsBlitzEscrow.Match memory m = escrow.getMatch(MATCH_ID);
        assertEq(m.player1, player1);
        assertEq(m.player2, player2);
        assertEq(m.wager, WAGER);
        assertEq(uint8(m.status), uint8(MathsBlitzEscrow.MatchStatus.Active));
        assertTrue(escrow.getReservation(RESERV_A).linked);
        assertTrue(escrow.getReservation(RESERV_B).linked);
        assertEq(address(escrow).balance, WAGER * 2);
    }

    function test_linkMatch_revertNotAuthorizedSigner() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);
        vm.prank(player2);
        escrow.depositStake{value: WAGER}(RESERV_B);

        vm.prank(stranger);
        vm.expectRevert(MathsBlitzEscrow.NotAuthorized.selector);
        escrow.linkMatch(MATCH_ID, RESERV_A, RESERV_B);
    }

    function test_linkMatch_revertMatchAlreadyExists() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        bytes32 reservC = keccak256("reserv-c");
        bytes32 reservD = keccak256("reserv-d");
        vm.deal(makeAddr("p3"), WAGER);
        vm.deal(makeAddr("p4"), WAGER);
        vm.prank(makeAddr("p3")); escrow.depositStake{value: WAGER}(reservC);
        vm.prank(makeAddr("p4")); escrow.depositStake{value: WAGER}(reservD);

        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchAlreadyExists.selector, MATCH_ID));
        escrow.linkMatch(MATCH_ID, reservC, reservD);
    }

    function test_linkMatch_revertReservationNotFound() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);

        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.ReservationNotFound.selector, RESERV_B));
        escrow.linkMatch(MATCH_ID, RESERV_A, RESERV_B);
    }

    function test_linkMatch_revertAlreadyLinked() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        bytes32 newMatch = keccak256("match-002");
        bytes32 reservC  = keccak256("reserv-c");
        vm.deal(stranger, WAGER);
        vm.prank(stranger);
        escrow.depositStake{value: WAGER}(reservC);

        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.ReservationAlreadyLinked.selector, RESERV_A));
        escrow.linkMatch(newMatch, RESERV_A, reservC);
    }

    function test_linkMatch_revertWagerMismatch() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);
        vm.prank(player2);
        escrow.depositStake{value: WAGER + 1}(RESERV_B);

        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.WagerMismatch.selector, WAGER, WAGER + 1));
        escrow.linkMatch(MATCH_ID, RESERV_A, RESERV_B);
    }

    function test_linkMatch_revertSamePlayer() public {
        bytes32 reservSame = keccak256("same-player-2");

        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(reservSame);

        vm.prank(signer);
        vm.expectRevert(MathsBlitzEscrow.SamePlayer.selector);
        escrow.linkMatch(MATCH_ID, RESERV_A, reservSame);
    }

    function test_linkMatch_revertWhenPaused() public {
        vm.prank(player1);
        escrow.depositStake{value: WAGER}(RESERV_A);
        vm.prank(player2);
        escrow.depositStake{value: WAGER}(RESERV_B);

        vm.prank(owner);
        escrow.pause();

        vm.prank(signer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.linkMatch(MATCH_ID, RESERV_A, RESERV_B);
    }

    // ─── settleMatch ─────────────────────────────────────────────────────────

    function test_settleMatch_player1Wins() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        uint256 pot = WAGER * 2;
        uint256 expectedWinnerAmt   = (pot * 9500) / 10_000;
        uint256 expectedTreasuryAmt = pot - expectedWinnerAmt;

        uint256 p1Before  = player1.balance;
        uint256 treBefore = treasury.balance;

        bytes memory sig = _sign(MATCH_ID, player1);

        vm.expectEmit(true, true, false, true);
        emit MathsBlitzEscrow.MatchSettled(MATCH_ID, player1, expectedWinnerAmt, expectedTreasuryAmt);

        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player1, sig);

        assertEq(player1.balance,   p1Before + expectedWinnerAmt);
        // Treasury cut is now retained in-contract (TVL), not pushed to treasury wallet.
        assertEq(treasury.balance,  treBefore);
        assertEq(escrow.accumulatedFees(), expectedTreasuryAmt);
        assertEq(address(escrow).balance, expectedTreasuryAmt);
        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(MathsBlitzEscrow.MatchStatus.Settled));
    }

    function test_withdrawFees_byOwner() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        uint256 pot = WAGER * 2;
        uint256 expectedTreasuryAmt = pot - (pot * 9500) / 10_000;

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player1, sig);

        uint256 treBefore = treasury.balance;

        vm.expectEmit(true, false, false, true);
        emit MathsBlitzEscrow.FeesWithdrawn(treasury, expectedTreasuryAmt);

        vm.prank(owner);
        escrow.withdrawFees();

        assertEq(treasury.balance, treBefore + expectedTreasuryAmt);
        assertEq(escrow.accumulatedFees(), 0);
        assertEq(address(escrow).balance, 0);
    }

    function test_withdrawFees_revertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.withdrawFees();
    }

    function test_settleMatch_player2Wins() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        uint256 pot = WAGER * 2;
        uint256 expectedWinnerAmt = (pot * 9500) / 10_000;

        uint256 p2Before = player2.balance;
        bytes memory sig = _sign(MATCH_ID, player2);
        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player2, sig);

        assertEq(player2.balance, p2Before + expectedWinnerAmt);
    }

    function test_settleMatch_byOwner_noSig() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        vm.prank(owner);
        escrow.settleMatch(MATCH_ID, player1, "");

        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(MathsBlitzEscrow.MatchStatus.Settled));
    }

    function test_settleMatch_revertNotActive() public {
        bytes memory sig = _sign(MATCH_ID, player1);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchNotActive.selector, MATCH_ID));
        escrow.settleMatch(MATCH_ID, player1, sig);
    }

    function test_settleMatch_revertWinnerNotPlayer() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        bytes memory sig = _sign(MATCH_ID, stranger);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.WinnerNotAPlayer.selector, MATCH_ID, stranger));
        escrow.settleMatch(MATCH_ID, stranger, sig);
    }

    function test_settleMatch_revertBadSignature() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        uint256 badPk = 0xDEAD;
        bytes32 digest = keccak256(abi.encodePacked(MATCH_ID, player1, address(escrow), block.chainid));
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPk, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(MathsBlitzEscrow.InvalidSignature.selector);
        escrow.settleMatch(MATCH_ID, player1, badSig);
    }

    function test_settleMatch_revertDoubleSettle() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player1, sig);

        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchNotActive.selector, MATCH_ID));
        escrow.settleMatch(MATCH_ID, player1, sig);
    }

    function test_settleMatch_revertWhenPaused() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        vm.prank(owner);
        escrow.pause();

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.settleMatch(MATCH_ID, player1, sig);
    }

    // ─── cancelMatch (owner emergency) ───────────────────────────────────────

    function test_cancelMatch_byOwner_refundsBoth() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;

        vm.expectEmit(true, false, false, false);
        emit MathsBlitzEscrow.MatchCancelled(MATCH_ID);

        vm.prank(owner);
        escrow.cancelMatch(MATCH_ID);

        assertEq(player1.balance, p1Before + WAGER);
        assertEq(player2.balance, p2Before + WAGER);
        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(MathsBlitzEscrow.MatchStatus.Cancelled));
    }

    function test_cancelMatch_revertByStranger() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.cancelMatch(MATCH_ID);
    }

    function test_cancelMatch_revertNotActive() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MathsBlitzEscrow.MatchNotActive.selector, MATCH_ID));
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

    function test_setAuthorizedSigner() public {
        address newSigner = makeAddr("newSigner");
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit MathsBlitzEscrow.AuthorizedSignerUpdated(signer, newSigner);
        escrow.setAuthorizedSigner(newSigner);
        assertEq(escrow.authorizedSigner(), newSigner);
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

    function testFuzz_payoutSplit(uint96 rawWager) public {
        uint256 wager = uint256(rawWager) + 1;

        vm.deal(player1, wager);
        vm.deal(player2, wager);

        bytes32 fuzzMatch  = keccak256(abi.encodePacked("fuzz-match",  rawWager));
        bytes32 fuzzReservA = keccak256(abi.encodePacked("fuzz-reservA", rawWager));
        bytes32 fuzzReservB = keccak256(abi.encodePacked("fuzz-reservB", rawWager));

        vm.prank(player1); escrow.depositStake{value: wager}(fuzzReservA);
        vm.prank(player2); escrow.depositStake{value: wager}(fuzzReservB);
        vm.prank(signer);  escrow.linkMatch(fuzzMatch, fuzzReservA, fuzzReservB);

        uint256 pot = wager * 2;
        uint256 expectedWinner   = (pot * 9500) / 10_000;
        uint256 expectedTreasury = pot - expectedWinner;

        uint256 p1Before = player1.balance;
        bytes memory sig = _sign(fuzzMatch, player1);
        vm.prank(stranger);
        escrow.settleMatch(fuzzMatch, player1, sig);

        assertEq(expectedWinner + expectedTreasury, pot);
        assertEq(player1.balance, p1Before + expectedWinner);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function test_isSettlementUsed_beforeAndAfter() public {
        _depositAndLink(MATCH_ID, RESERV_A, RESERV_B);

        assertFalse(escrow.isSettlementUsed(MATCH_ID, player1));

        bytes memory sig = _sign(MATCH_ID, player1);
        vm.prank(stranger);
        escrow.settleMatch(MATCH_ID, player1, sig);

        assertTrue(escrow.isSettlementUsed(MATCH_ID, player1));
    }

    function test_settlementDigest_matchesOffchain() public view {
        bytes32 expected = keccak256(abi.encodePacked(MATCH_ID, player1, address(escrow), block.chainid));
        assertEq(escrow.settlementDigest(MATCH_ID, player1), expected);
    }

    function test_bpsConstants() public view {
        assertEq(escrow.WINNER_BPS() + escrow.TREASURY_BPS(), escrow.BPS_DENOM());
    }

    receive() external payable {}
}
