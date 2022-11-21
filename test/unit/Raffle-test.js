const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Test", async () => {
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

      describe("constructor", async () => {
        it("Initialize correctly the raffle", async () => {
          const raffleState = await raffle.getRaflleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(
            interval.toString(),
            networkConfig[chainId].keepersUpdateInterval
          );
        });
      });

      describe("enterTheRaffle", async () => {
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

      describe("checkUpkeep", async () => {
        it("returns false if users haven't send eth", async () => {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 31,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeed } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(!upkeepNeed, true);
        });
      });
    });
