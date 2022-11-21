// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
// import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";

error Raffle__NotEnoughEntranceFee();
error Raffle__TransactionFaild();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/**
 * @title Lottery Project
 * @author Animesh Kotka
 * @notice this is contract to create decenterlize lottery
 */

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /** Deceration */
    enum RaffleState {
        OPEN,
        CALCULATING
    } // => CONvert into uint256 0,1,2 link this

    /**State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address payable private s_recentWinner;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_gasLimit;
    uint64 private immutable i_subscriptionId;
    uint256 private immutable i_interval;
    uint16 private constant REQUEST_CONFIRMATION = 3;
    uint16 private constant NUM_WORD = 1;
    RaffleState private s_raffleState;

    uint256 private s_lastTimeStamp;

    /** Events */

    event RaffleEnter(address indexed player);
    event RaffleRequestWinner(uint256 indexed requestId);
    event RaffleWinnerPicked(address indexed Winner);

    constructor(
        address vrfCoordinatoreV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 gasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatoreV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatoreV2);
        i_gasLane = gasLane;
        i_gasLimit = gasLimit;
        i_subscriptionId = subscriptionId;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterTheRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEntranceFee();
        }

        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }

        s_players.push(payable(msg.sender));

        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the functions that chainlink keep will look and call
     * @notice using bytes as angument we can pass anything link functions and maps etc
     * 1. Time should be passed
     * 2. Minimum 2 player
     * 3. must funded with link
     * 4. Lottery must be in open state
     */
    function checkUpkeep(
        bytes memory /**callData */
    )
        public
        override
        returns (
            bool upkeepNeeded,
            bytes memory /** performData */
        )
    {
        bool isOpen = RaffleState.OPEN == s_raffleState;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers);
        // bool isOpen = (s_raffleState == RaffleState.OPEN);
        // upkeepNeeded = (isOpen &&
        //     (block.timestamp - s_lastTimeStamp > i_interval) &&
        //     (s_players.length > 2) &&
        //     (address(this).balance) > 0);
        return (upkeepNeeded, "0x0"); // can we comment this out?
    }

    function performUpkeep(
        bytes memory /** performData */
    ) external override {
        (bool isUpkeepNeeded, ) = checkUpkeep("");
        if (!isUpkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }

        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_gasLimit,
            NUM_WORD
        );

        emit RaffleRequestWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /**requestId */
        uint256[] memory randomWords
    ) internal override {
        uint256 indexofwinner = randomWords[0] % s_players.length;
        address payable winner = s_players[indexofwinner];
        s_recentWinner = winner;
        (bool success, ) = winner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransactionFaild();
        }
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        emit RaffleWinnerPicked(winner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaflleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORD;
    }

    function getPlayerNumbers() public view returns (uint256) {
        return s_players.length;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }
}
// https://youtu.be/gyMwXuJrbJQ?t=54110
