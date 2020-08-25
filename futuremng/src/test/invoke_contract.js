//const { createU3 } = require("u3.js");
const {U3} = require('u3.js');
const {createU3, format} = U3;
/**
 * 异步延迟
 * @param {number} time 延迟的时间,单位毫秒
 */
function sleep(time = 0) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
        resolve();
        }, time);
    })
};

let config = {
    httpEndpoint: "http://172.16.10.9:8899",
    httpEndpointHistory: "http://172.16.10.6:3001",
    chainId: "20c35b993c10b5ea1007014857bb2b8832fb8ae22e9dcfdc61dacf336af4450f",//"1f1155433d9097e0f67de63a48369916da91f19cb1feff6ba8eca2e5d978a2b2",
    broadcast: true,
    sign: true,
    logger: {
      directory: "./logs", // daily rotate file directory
      level: "info", // error->warn->info->verbose->debug->silly
      console: true, // print to console
      file: false // append to file
    },
    symbol: "FGAS",
    keyProvider:["5KPyztSimiMwNw78BanenZ4nCXjxUdjBNx4JMDNGJhNc5gFku6Q"],
    //expireInSeconds:60
}

/**
 * 调用智能合约的入口方法
 * @param config 配置文件
 * @param contractName
 * @param actionName
 * @param params
 * @param accountName
 * @param privateKey
 * @returns {Promise<void>}
 */
async function contractInteract(config, contractName, actionName, params, accountName, privateKey) {
    try {

        config.keyProvider = [privateKey];
        const u3 = createU3(config);
        const contract = await u3.contract(contractName);
        //let ee = error;
        //logger.debug("contract=", JSON.stringify(contract.fc.abi.structs));
        if (!contract) {
            throw new Error("can't found contract " + contractName);
        }
        if (!contract[actionName] || typeof contract[actionName] !== 'function') {
            throw new Error("action doesn't exist:" + actionName);
        }
        const data = await contract[actionName](params, {
            authorization: [`${accountName}@active`],
        });
        console.log('contractInteract success contractName:',contractName," actionName:", actionName, " params:",params);
        return data;
    } catch (err) {
        console.log('contractInteract error contractName:',contractName," actionName:", actionName, " params:",params, " accountName:",accountName," privateKey:",privateKey);
        console.log('' + actionName + ' error :', err);
    }
    return null;
}

//config.keyProvider = ["5KPyztSimiMwNw78BanenZ4nCXjxUdjBNx4JMDNGJhNc5gFku6Q"];
// let u3 = createU3(config);

// u3.getChainInfo((err, info) => {
//   if (err) {throw err;}
//   console.log(info);
// });

async function runInvokeContract() {
    try {
        let contract_name = 'hello'
        let account_name = 'hello'
        let _sender = account_name
        let params = {
            user: "nihao",
        }
        let result = await contractInteract( config, contract_name, "hey", params, account_name, "5KPyztSimiMwNw78BanenZ4nCXjxUdjBNx4JMDNGJhNc5gFku6Q");
        console.log("contractInteract result:" + JSON.stringify(result));
    } catch (err) {
        console.log('contractInteract failed error :', err);
    }
    return null;
}

runInvokeContract();
