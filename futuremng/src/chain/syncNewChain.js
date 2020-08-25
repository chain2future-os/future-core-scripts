var logger = require("../config/logConfig").getLogger("syncNewChain");
var chainConfig = require("./chainConfig")
var chainApi = require("./chainApi")
var constants = require("../common/constant/constants")
var chainNameConstants = require("../common/constant/constants").chainNameConstants
var sleep = require("sleep")
var utils = require("../common/util/utils")
var NodFuture = require("../nodfuture/nodfuture")
var process = require('child_process');
var Chain = require("./chain")
var chainSyncService = require("./chainSyncService")

/**
 * 是否在运行创世脚本
 * @type {bool}
 */
var is_running_bios = false;

/**
 * 执行创世脚本
 * @returns {Promise<void>}
 */
async function execGenesisBios( genesisBiosCmd ) {
    try {
        let subBlockNumMax = await chainApi.getHeadBlockNum(chainConfig.nodPort);
        if ( utils.isNull(subBlockNumMax) || subBlockNumMax < 3 ) {
            return false;
        }
        let result = await NodFuture.execGenesisBios( genesisBiosCmd );
        if ( result == true ) {
            logger.info("execGenesisBios successed cmd:", genesisBiosCmd );
            is_running_bios = true;
            return true;
        } else {
            logger.info("execGenesisBios failed");
        }

    } catch (e) {
        logger.error("execGenesisBios error:",e);
    }
    return false;
}

/**
 *
 * @returns {Promise<void>}
 */
async function checkBiosProcess() {

    let command = "ps axu | grep bios-new-chain.py";
    process.exec(command, function (error, stdout, stderr, finish) {
        try {
            is_running_bios = false;
            logger.info("bios-new-chain.py path:", NodFuture.biosGenesisPath);
            if (error !== null) {
                logger.error("exec ps bios-new-chain.py error: " + error);
            } else {
                logger.info("exccmd success:" + command);
                logger.info("command res :", stdout);
                let resData = stdout.split("\n");
                logger.info("command resData :",resData.length);
                for (let i = 0; i < resData.length; i++) {
                    logger.info("command line :",resData[i]);
                    if (resData[i].indexOf(NodFuture.biosGenesisPath) != -1) {
                        logger.info("bios process is :", resData[i]);
                        is_running_bios = true;
                        break;
                    }
                }
            }
        } catch (e) {
            logger.error("checkBiosProcess error:",e);
        }

    });
    return is_running_bios;
}

/**
 * start entry
 * @returns {Promise<void>}
 */
async function start() {
    logger.info("syncNewChain start...");

    try {
        //如果是主链，啥都不操作
        if (chainConfig.isMainChain() == true) {
            logger.info("syncNewChain need not work in main chain");
            return;
        }
        const globalInfo = await chainApi.get_table_records_info( "http://127.0.0.1:"+chainConfig.nodPort,
                                                                    constants.contractConstants.FUTUREIO,
                                                                    constants.contractConstants.FUTUREIO,
                                                                    constants.tableConstants.GLOBAL
                                                                    );
        logger.info("syncNewChain get_table_records_info globalInfo result:", globalInfo);
        if ( !utils.isNull(globalInfo) && globalInfo[0].cur_committee_number >= globalInfo[0].min_committee_member_number ) {
            logger.info("syncNewChain get_table_records_info  genesis already finish");
            return;
        }
        //查询新链是否已创建
        const newchaininfo = await chainApi.get_table_records_info( chainConfig.config.httpEndpoint,
                                                                    constants.contractConstants.FUTUREIO,
                                                                    constants.contractConstants.FUTUREIO,
                                                                    constants.tableConstants.NEWCHAIN
                                                                    );
        if( !utils.isNotNull( newchaininfo ) ) {
            logger.error("syncNewChain get_table_records_info result is null");
        }
        logger.info("syncNewChain get_table_records_info result:", newchaininfo);
        const genesis_producer_pk = newchaininfo[0]["genesis_producer_pk"];
        //通过块高，去主链拿取主链委员会和块高信息
        const master_block_height = newchaininfo[0]["master_block_height"];
        const chain_name = newchaininfo[0]["chain_name"];
        const genesis_time = newchaininfo[0]["genesis_time"];
        const creation_status = newchaininfo[0]["creation_status"];
        if ( creation_status != 3 ) {
            logger.error("syncNewChain not ready,creation_status:",creation_status);
            return;
        }
        logger.info("syncNewChain ready success, creation_status:",creation_status);
        
        //设置用户属于的chainname信息,genesis_producer_pk等信息。
        if (utils.isNull(genesis_producer_pk) || utils.isNull(master_block_height) || utils.isNull(genesis_time) || utils.isNull(chain_name)) {
            return;
        }

        chainConfig.chainName = chain_name;
        chainConfig.genesisPK = genesis_producer_pk;
        // chainConfig.genesisTime =  genesis_time;
        const newchain_head_block = await chainApi.getHeadBlockNum(chainConfig.nodPort);
        logger.info("syncNewChain start localchainName:",chainConfig.localChainName," newchain_head_block:",newchain_head_block);
        if ( chainConfig.localChainName != chain_name || utils.isNull(newchain_head_block) || newchain_head_block < 3 ) {
            return;
        }
        let seedPk = await chainApi.getChainSeedPk(chain_name, chainConfig.myAccountAsCommitteeList[0], chainConfig);
        //创建系统账号，合约，参数
        //判断是seed节点，且未创世
        sleep.msleep(1000 * 3);
        let is_exist_genesis = await chainApi.getAccount( chainConfig.nodPort, constants.accountConstants.GENESIS_ACCOUNT );
        logger.info("syncNewChain isSeed:",chainConfig.isSeed()," is_running_bios:", is_running_bios);
        if (chainConfig.isSeed() == true && !is_running_bios ) {
            if( utils.isNull(is_exist_genesis) ) {
                let genesisBiosCmd = " python3 " +NodFuture.biosGenesisPath + " -n "
                                    + " --seed-accont " + chainConfig.myAccountAsCommitteeList[0]
                                    + " --seed-account-pk " + seedPk
                                    + " -mh " + chainConfig.config.httpEndpoint
                                    + " --num-master-block " + master_block_height
                                    + " -sub " + chain_name;
                logger.info("syncNewChain execGenesisBios start");
                let genesisRes = await execGenesisBios( genesisBiosCmd );
                sleep.msleep(1000 * 60);
                logger.info("syncNewChain execGenesisBios end res:", genesisRes," genesisBiosCmd:",genesisBiosCmd);
            }

        }

        //设置同步服务
        if ( chainConfig.myAccountAsCommitteeList.indexOf("genesis") != -1 ) {
            //获取子链已经处理过的块高
            let subchainSyncBlock = await chainSyncService.getProcessedBlock(chain_name,chainNameConstants.MAIN_CHAIN_NAME);
            logger.info("syncNewChain subchainSyncBlock: ",subchainSyncBlock);
            if ( subchainSyncBlock < 0) {
                await chainSyncService.updateProcessedBlock(chain_name,chainNameConstants.MAIN_CHAIN_NAME,1);
            }

            //获取主链已经处理过的块高
            let mainchainSyncBlock = await chainSyncService.getProcessedBlock(chainNameConstants.MAIN_CHAIN_NAME,chain_name);
            logger.info("syncNewChain mainchainSyncBlock: ",mainchainSyncBlock);
            if ( mainchainSyncBlock < 0) {
                await chainSyncService.updateProcessedBlock(chainNameConstants.MAIN_CHAIN_NAME,chain_name,master_block_height);
            }

        }

    } catch (e) {
        logger.error("syncNewChain exec error:",e);
    }

    logger.info("syncNewChain end...");
}

module.exports = {
    start,
}
