const { network, ethers } = require("hardhat");
const {
  developmentChains,
  VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config");

module.exports = async ({ getNameAccounts, deployments }) => {
  const { deploye, logs } = deployments;
  const { deployer } = await getNameAccounts();

  const waitBlockConfirmations = developmentChains.includes(network.name)
    ? 1
    : VERIFICATION_BLOCK_CONFIRMATIONS;

  const raffle = await deploye("Raffle", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: waitBlockConfirmations,
  });
  log(`raffle deployed at ${raffle.address}`);
};
