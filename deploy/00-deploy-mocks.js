const { network } = require("hardhat");
const BASE_FEE = ethers.parseEther("0.25"); // premium price to chain link, pays in link
const GAS_PRICE_LINK = 1e9; // limit the gas usage of eth
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, deploy } = deployments;
  const deployer = await getNamedAccounts();
  const chainId = network.config.chainId;

  if (chainId == 31337) {
    log("Local network detected! Deploying mocks...");

    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      args: [BASE_FEE, GAS_PRICE_LINK],
      log: true,
    });
    log("Mocks Deployed!");
    log("----------------------------------------------------------");
    log(
      "You are deploying to a local network, you'll need a local network running to interact"
    );
    log(
      "Please run `yarn hardhat console --network localhost` to interact with the deployed smart contracts!"
    );
    log("----------------------------------------------------------");
  }
};
module.exports.tags = ["all", "mocks"];
