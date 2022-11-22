const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Test", () => {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        raffleEntranceFee = raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });

      describe("constructor", () => {
        it("Initialize correctly the raffle", async () => {
          const raffleState = await raffle.getRaflleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(
            interval.toString(),
            networkConfig[chainId].keepersUpdateInterval
          );
        });
      });

      describe("enterTheRaffle", () => {
        it("It revert when you don't pay enought", async () => {
          expect(raffle.enterTheRaffle()).to.be.revertedWith(
            "Raffle__NotEnoughEntranceFee"
          );
        });

        it("records players when they enters", async () => {
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          const currentPlayer = await raffle.getPlayer(0);
          assert.equal(currentPlayer, deployer);
        });

        it("emit event on enter player", async () => {
          expect(
            await raffle.enterTheRaffle({ value: raffleEntranceFee })
          ).to.emit(raffle, "RaffleEnter");
        });

        it("Doesn't allow entering when raffle is calculating", async () => {
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 31,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          // we pretend to be a keeper for a second
          await raffle.performUpkeep([]); // changes the state to calculating for our comparison below
          await expect(
            raffle.enterTheRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWith(
            // is reverted as raffle is calculating
            "Raffle__NotOpen"
          );
        });
      });

      describe("checkUpkeep", () => {
        it("returns false if users haven't send eth", async () => {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 31,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeed } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(!upkeepNeed, true);
        });

        it("returns false if raffle isn't open", async () => {
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await raffle.performUpkeep([]); // changes the state to calculating
          const raffleState = await raffle.getRaflleState(); // stores the new state
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert.equal(raffleState.toString() == "1", upkeepNeeded == false);
        });

        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 5,
          ]); // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", () => {
        it("Only work if checkup is true", async () => {
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 31,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await raffle.callStatic.performUpkeep([]);
          assert(tx);
        });

        it("reverts if checkup is false", async () => {
          await expect(raffle.performUpkeep("0x")).to.be.revertedWith(
            "Raffle__UpkeepNotNeeded"
          );
        });

        it("updates the raffle state and emits a requestId", async () => {
          // Too many asserts in this test!
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep("0x"); // emits requestId
          const txReceipt = await txResponse.wait(1); // waits 1 block
          const raffleState = await raffle.getRaflleState(); // updates state
          const requestId = txReceipt.events[1].args.requestId;
          assert(requestId.toNumber() > 0);
          assert(raffleState == 1); // 0 = open, 1 = calculating
        });
      });

      describe("fulfillRandomWords", () => {
        beforeEach(async () => {
          await raffle.enterTheRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 31,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });

        it("can only be called after performupkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
        });

        it("picks a winner, resets the lottery and sends money", async () => {
          const additionalEntrances = 0;
          const startingIndex = 2;
          const accounts = await ethers.getSigners();

          for (
            let i = startingIndex;
            i < startingIndex + additionalEntrances;
            i++
          ) {
            const raffleAccountConnected = raffle.connect(accounts[i]);
            await raffleAccountConnected.enterTheRaffle({
              value: raffleEntranceFee,
            });
          }
          const startingtTimeStamp = await raffle.getLatestTimeStamp();

          await new Promise(async (resolve, reject) => {
            await raffle.once("RaffleWinnerPicked", async () => {
              console.log("WinnerPicked event fired!");
              // assert throws an error if it fails, so we need to wrap
              // it in a try/catch so that the promise returns event
              // if it fails.

              try {
                // Now lets get the ending values...
                const numPlayers = await raffle.getPlayerNumbers();
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaflleState();
                const winnerBalance = await accounts[2].getBalance();
                const endingTimeStamp = await raffle.getLatestTimeStamp();
                assert.equal(numPlayers.toString(), "0");
                assert.equal(raffleState, 0);
                assert(endingTimeStamp > startingtTimeStamp);
              } catch (e) {
                reject();
              }
              resolve();
            });
            const tx = await raffle.performUpkeep([]);
            const txReceipt = await tx.wait(1);
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            );
          });
        });
      });
    });
