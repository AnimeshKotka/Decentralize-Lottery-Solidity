const { ethers } = require("hardhat");

async function enterTheRaffle() {
  const raffle = await ethers.getContract("Raffle");
  const entranceFee = await raffle.getEntranceFee();
  await raffle.enterTheRaffle({ value: entranceFee + 1 });
  console.log("Entered!");
}

enterTheRaffle()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
