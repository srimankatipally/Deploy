require("dotenv").config();
const Web3 = require("web3");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

// Load Environment Variables
const INFURA_URL = process.env.INFURA_URL; // Use Infura, Alchemy, or your own node

// Connect to Ethereum Network
const web3 = new Web3(new Web3.providers.HttpProvider(INFURA_URL));

// Read compiled contract
const contractPath = path.resolve(__dirname, "SimpleContract.json"); // Ensure this file exists
const contractJson = JSON.parse(fs.readFileSync(contractPath, "utf-8"));
const { abi, evm } = contractJson;
const bytecode = evm.bytecode.object;

// Read Wallets from CSV
const wallets = [];

fs.createReadStream("wallets.csv")
  .pipe(csv())
  .on("data", (row) => {
    wallets.push(row.private_key);
  })
  .on("end", async () => {
    console.log(`Loaded ${wallets.length} wallets.`);
    await deployContracts(wallets);
  });

async function deployContracts(wallets) {
    for (let i = 0; i < wallets.length; i++) {
        const privateKey = wallets[i];

        try {
            // Load Wallet
            const account = web3.eth.accounts.privateKeyToAccount(privateKey);
            web3.eth.accounts.wallet.add(account);
            web3.eth.defaultAccount = account.address;

            console.log(`Deploying contract from: ${account.address}`);

            // Deploy Contract
            const contract = new web3.eth.Contract(abi);
            const deployTx = contract.deploy({ data: bytecode });

            // Estimate Gas
            const gas = await deployTx.estimateGas();

            // Send Transaction
            const deployedContract = await deployTx.send({
                from: account.address,
                gas: gas,
            });

            console.log(`✅ Contract deployed at: ${deployedContract.options.address} from ${account.address}`);

            // Log deployment
            fs.appendFileSync(
                "deployed_contracts.csv",
                `${account.address},${deployedContract.options.address}\n`
            );

        } catch (error) {
            console.error(`❌ Error deploying with ${privateKey}:`, error.message);
        }
    }

    console.log("✅ All contracts deployed.");
}
