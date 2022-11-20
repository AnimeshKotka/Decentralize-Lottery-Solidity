module.exports = async ({ getNameAccounts, deployments }) => {
  const { deploye, logs } = deployments;
  const { deployer } = await getNameAccounts();
};
