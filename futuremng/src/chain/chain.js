const fs = require('fs');
var logger = require("../config/logConfig").getLogger("Chain");
var loggerChainChanging = require("../config/logConfig").getLogger("ChainChanging");
var chainConfig = require("./chainConfig")
var chainApi = require("./chainApi")
var constants = require("../common/constant/constants")
var chainNameConstants = require("../common/constant/constants").chainNameConstants
var contractConstants = require("../common/constant/constants").contractConstants
var tableConstants = require("../common/constant/constants").tableConstants
var chainIdConstants = require("../common/constant/constants").chainIdConstants
var pathConstants = require("../common/constant/constants").pathConstants
var scopeConstants = require("../common/constant/constants").scopeConstants
var sleep = require("sleep")
var utils = require("../common/util/utils")
var committeeUtil = require("./util/committeeUtil");
var blockUtil = require("./util/blockUtil");
var NodFuture = require("../nodfuture/nodfuture")
var WorldState = require("../worldstate/worldstate")
var chainUtil = require("./util/chainUtil");
var monitor = require("./monitor")
var mongoUtil = require("./util/mongoUtil");
var process = require('child_process');
var filenameConstants = require("../common/constant/constants").filenameConstants;



/**
 * 同步子链内数据标志（当该字段为false时，不向主链同步块，资源，用户等信息
 * 1. 当自己是主链是为false
 * 2. 当自己是子链，但不是委员会成员是为false
 * @type {boolean}
 */
var syncChainData = false;

//链切换flag-表示正在做链切换
var syncChainChanging = false;


//本地委员会成员列表
var localProducers = []

//nod请求失败次数
var nodFailedTimes=0;
var maxNodFailedTimes=5;

//wss请求失败次数
var wssFailedTimes=0;
var maxWssFailedTimes=5;

//交易缓存
var trxCacheSet = new Set();

var seedCheckCount = 0;

var lastHeartbeatMs = 0;

/**
 * 进程正在跑
 * @type {boolean}
 */
var processRuning = false;

//自己投过票的块高
var voteBlockWssBlockNum = 0;
var serachBlockMerkleVoteCnt = 0;

/**
 *
 * @returns {*}
 */
function getmaxNodFailedTimes() {

    if (utils.isNotNull(chainConfig.configFileData.local.maxNodFailedTimes)) {
        return chainConfig.configFileData.local.maxNodFailedTimes;
    }

    return maxNodFailedTimes;

}

/**
 *
 * @param config
 * @param chainName
 * @returns {Promise<number>}
 */
async function getMaxConfirmBlock(config,chainName) {
    let maxConfirmBlock = 0;
    logger.info("getMaxConfirmBlock:",chainName);
    try {
        let tableData = await chainApi.getTableAllData(config,contractConstants.FUTUREIO,contractConstants.FUTUREIO,tableConstants.CHAINS,"chain_name");
        //logger.info("getMaxConfirmBlock rows:",tableData);
        if (tableData.rows.length >0) {
            for (let i=0;i<tableData.rows.length;i++) {
                let row = tableData.rows[i];
                if (row.chain_name == chainName) {
                    maxConfirmBlock = row.confirmed_block_number;
                    break;
                }
            }
        }

    } catch (e) {
        logger.error("getMaxConfirmBlock error:",e);
    }

    return maxConfirmBlock;
}

/**
 *
 * @param
 * @returns {Promise<number>}
 */
async function checkMainchainSeedNormal() {
    let seedArray = [];
    let isNormalFlag = false;
    try {
        logger.info("checkMainchainSeedNormal  start check httpEndpoint:",chainConfig.config.httpEndpoint);
        seedArray.push(chainConfig.config.httpEndpoint);
        isNormalFlag = await chainApi.checkSeedReady(seedArray,chainConfig.nodPort,null);
        if (isNormalFlag == false) {
            let mainSeedList = await chainApi.getChainHttpListByGroup(chainNameConstants.MAIN_CHAIN_NAME, chainConfig);
            if (mainSeedList.length > 0) {
                logger.info("mainSeedList.length(" + mainSeedList.length + ") update main seedList:", mainSeedList);
                chainConfig.config.seedHttpList = mainSeedList;
                await chainApi.checkMainchainSeed(chainConfig,true);
            }
        }
    } catch (e) {
        logger.error("checkMainchainSeedNormal error,",e);
    }
    logger.info("checkMainchainSeedNormal isNormalFlag:",isNormalFlag," mainchain httpEndpoint:",chainConfig.config.httpEndpoint);
}


/**
 *
 * @param blockHeightInfo
 * @param trx_receipt_bytes
 * @returns {boolean}
 */
function checkHashIsready(blockHeightInfo,tranId) {
    let flag = false;
    try {
        if (blockHeightInfo.length > 0) {
            let trx_ids = blockHeightInfo[0].trx_ids;
            for (let i = 0; i < trx_ids.length; i++) {
                if (trx_ids[i] == tranId) {
                    return true;
                } else {
                    logger.debug("table tra_id("+trx_ids[i]+") is not equal tra_id("+tranId+"):");
                }
            }

        }
    } catch (e) {
        logger.error("checkHashIsready error,",e);
    }

    return flag;
}

/**
 *
 * @param confirmed_block
 * @returns {*}
 */
function getHasConfirmBlock(confirmed_block) {
    try {
         let number = confirmed_block.number;
         if (utils.isNotNull(number)) {
             return number;
         }
    } catch (e) {
        logger.error("confirmed_block process error:",e)
    }

    return -1;
}

/**
 * 获取打卡检测周期
 * @returns {Promise<void>}
 */
async function get_heartbeat_period_minutes() {
    const default_period_minutes = 10;
    try{
        let tableRecData = await chainApi.get_table_records_info(chainConfig.config.httpEndpoint, contractConstants.FUTUREIO, contractConstants.FUTUREIO, tableConstants.GLOBAL);
        if ( utils.isNull(tableRecData) == true ) {
            logger.error("producerHeartBeat get_heartbeat_period_minutes data is null, chain_name:",chainConfig.chainName);
            await checkMainchainSeedNormal();
            return default_period_minutes;
        }
        let table_extension = tableRecData[0].table_extension;
        if( table_extension.length == 0 ) {
            logger.info("producerHeartBeat get_heartbeat_period_minutes get global extension data is null, chain_name:",chainConfig.chainName);
            return default_period_minutes;
        }
        for (let i=0;i<table_extension.length;i++) {
            const producer_heartbeat_check_period = 18;
            if ( Number( table_extension[i].key ) == producer_heartbeat_check_period
                && Number( table_extension[i].value ) != 0 ) {
                logger.info("producerHeartBeat get_heartbeat_period_minutes global minutes:",Number( table_extension[i].value ));
                return Number( table_extension[i].value );
            }
        }
    } catch (e) {
        await checkMainchainSeedNormal();
        logger.error("producerHeartBeat get_heartbeat_period_minutes error:",e);
    }
    return default_period_minutes;
}

/**
 * producer心跳包
 * @returns {Promise<void>}
 */
async function producerHeartBeat() {
    try{
        if( chainConfig.isNoneProducer() ) { //非出块节点
            return;
        }
        const currentTime = new Date().getTime();
        //每半个周期打卡一次
        const periodMinutes = await get_heartbeat_period_minutes();
        const shouldCheckTime = lastHeartbeatMs + (periodMinutes)* 60 * 1000 / 2 - 60 * 1000;
        if( shouldCheckTime > currentTime ) {
            return;
        }

        logger.info("producerHeartBeat start check HeartBeat lastHeartbeatMs:",lastHeartbeatMs,"  currentTime:",currentTime," periodMinutes:",periodMinutes," mainhttppoint:",chainConfig.config.httpEndpoint);
        //从briefprod表里查询所在的链,以防矿工被移除委员会，而使用错误的链名
        let briefProdTableData = await chainApi.getTableInfo(chainConfig.config.httpEndpoint, contractConstants.FUTUREIO, contractConstants.FUTUREIO, tableConstants.BRIEFPROD, 1, chainConfig.myAccountAsCommitteeList[0]);
        if ( utils.isNull(briefProdTableData) == true || (utils.isNull(briefProdTableData.rows) == true) || briefProdTableData.rows.length == 0 ) {
            logger.error("producerHeartBeat get briefprod data is null, chain_name:",chainConfig.myAccountAsCommitteeList[0]);
            await checkMainchainSeedNormal();
            return;
        }
        let tableData = await chainApi.getTableInfo(chainConfig.config.httpEndpoint, contractConstants.FUTUREIO, contractConstants.FUTUREIO, tableConstants.CHAINS, 1, briefProdTableData.rows[0].location);
        logger.debug("producerHeartBeat chainsdata:",tableData);
        if ( utils.isNull(tableData) == true || (utils.isNull(tableData.rows) == true) || tableData.rows.length == 0 ) {
            logger.error("producerHeartBeat get chains data is null, chain_name:",chainConfig.chainName," brief_location:",briefProdTableData.rows[0].location);
            await checkMainchainSeedNormal();
            return;
        }
        let table_extension = tableData.rows[0].table_extension;
        if( table_extension.length == 0 ) {
            logger.info("producerHeartBeat get chains extension data is null,not heartbeat, chain_name:",briefProdTableData.rows[0].location);
            return;
        }
        for (let i=0;i<table_extension.length;i++) {
            let producer_supervision = 3;
            if ( Number( table_extension[i].key ) == producer_supervision
                && Number( table_extension[i].value ) != 0 ) {
                let fixCmtTableData = await chainApi.getTableInfo(chainConfig.config.httpEndpoint, contractConstants.FUTUREIO, contractConstants.FUTUREIO, tableConstants.FIXED_COMMITTEE, 100000, null, null, null );
                logger.debug("producerHeartBeat fixedcmt:",fixCmtTableData);
                for(let k =0; k < chainConfig.myAccountAsCommitteeList.length; k++ ) {
                    if ( utils.isNull(fixCmtTableData) == false && (utils.isNull(fixCmtTableData.rows) == false) || fixCmtTableData.rows.length > 0 ) {
                        for( let j=0; j<fixCmtTableData.rows.length; j++ ) {
                            if( chainConfig.myAccountAsCommitteeList[k] == fixCmtTableData.rows[j].producer ) {
                                logger.info("producerHeartBeat not need heartbeat producer:",fixCmtTableData.rows[j].producer);
                                continue;
                            }
                        }
                    }
                    let param = {
                        producer: chainConfig.myAccountAsCommitteeList[k]
                    }
                    let res = await chainApi.contractInteract(chainConfig.config, contractConstants.FUTUREIO, constants.actionConstants.PROD_HEAER_BEAT, param, chainConfig.myAccountAsCommitteeList[k], chainConfig.mySkAsAccountList[k]);
                    if( utils.isNull(res) == false ){
                        lastHeartbeatMs = currentTime;
                    } else {
                        logger.info("producerHeartBeat trx failed check seed mainchain seed is normal");
                        await checkMainchainSeedNormal();
                    }
                    logger.info("producerHeartBeat producer_supervision:" + chainConfig.myAccountAsCommitteeList[k] + ", contract return result:", res, " currentTime:",currentTime);
                }
                return;
            }
        }
        logger.info("producerHeartBeat not need producer_supervision chain_name:",briefProdTableData.rows[0].location);
    } catch (e) {
        logger.error("producerHeartBeat error:",e);
    }
}

/**
 * 同步块头
 * @returns {Promise<void>}
 */
async function syncBlock() {

    if (monitor.isDeploying()) {
        logger.error("monitor.isDeploying(),wait...", monitor.isDeploying());
        return;
    } else {
        logger.info("monitor.isDeploying()", monitor.isDeploying());
    }

    logger.info("sync block start syncChainData:",syncChainData, " isMainChain():",isMainChain(), " myAccountAsCommitteeList:",chainConfig.myAccountAsCommitteeList);

    //一次最大块数
    var blockSyncMaxNum = chainConfig.getLocalConfigInfo("blockSyncMaxNum", 10);
    if( (syncChainData == true || (chainConfig.myAccountAsCommitteeList.indexOf("genesis") != -1 && chainConfig.configFileData.local.isSyncNewChain == true)) && isMainChain() == false ) {
        //同步主链块头
        await syncMasterBlock();
    }

    if ( syncChainData == true && isMainChain() == false) {

        var subBlockNumMax = await chainApi.getHeadBlockNum(chainConfig.nodPort);
        if (subBlockNumMax == null) {
            logger.error("subBlockNumMax is null,abort sync block");
            return;
        }
        logger.info("subBlockNumMax:"+subBlockNumMax);
        var traceMode = true;
        //获取本地最新的块头，获取服务端最新的块头
        let result = await chainApi.getBlockInfoData(chainConfig.getLocalHttpEndpoint(),(subBlockNumMax).toString());
        logger.info("result.proposer,",result.proposer);

        //判断是否要上传块头
        let need_sync_proposer_index = -1;
        for(let k =0; k < chainConfig.myAccountAsCommitteeList.length; k++ ) {
            if ( blockUtil.needPushBlockByProducerList(result.proposer, chainConfig.myAccountAsCommitteeList[k], localProducers) ) {
                need_sync_proposer_index = k;
                logger.info("need sync block.. localProducers:",chainConfig.myAccountAsCommitteeList[k]," index:",need_sync_proposer_index);
                break;
            }
        }
        if ( need_sync_proposer_index < 0 ) {
            logger.info("not need sync block.. localProducersList:",chainConfig.myAccountAsCommitteeList);
            return;
        }

        logger.info("start to push block..");
        let blockNum = 0;
        let subchainBlockNumResult = await chainApi.getSubchainBlockNum(chainConfig.config, chainConfig.localChainName);
        logger.info("mainchain block num:", subchainBlockNumResult);

        //设置本链已同步最高的块告
        let confirmed_block = subchainBlockNumResult.confirmed_block;
        logger.error("[sync block]confirmed_block:",getHasConfirmBlock(confirmed_block));
        monitor.setConfirmBlockLocal(getHasConfirmBlock(confirmed_block));

        let forks = subchainBlockNumResult.forks;
        let findFlag = false;
        if (utils.isNullList(forks) == false) {
            for (let i = 0; i < forks.length; i++) {
                let fork = forks[i];
                let block_id = fork.block_id;
                logger.info("fork:", fork);
                let localBlockId = 0;
                try {
                    let result = await chainApi.getBlockInfoData(chainConfig.getLocalHttpEndpoint(),(fork.number).toString());
                    logger.debug("block info", result);
                    localBlockId = result.id;
                } catch (e) {
                    logger.error("get block(" + fork.number + ") error,", e);
                }

                if (block_id == localBlockId) {
                    findFlag = true;
                    logger.info("block id(" + block_id + ") == local block id(" + localBlockId + "),match");
                    blockNum = fork.number;
                    break;
                } else {
                    logger.info("block id(" + block_id + ") != local block id(" + localBlockId + "),mot match");
                }

            }
        } else {
            findFlag = true;
        }

        //如果找不到块，不上传块头
        if (findFlag == false) {
            logger.error("can't find matched block info , nedd not sync block");
            return;
        }

        logger.info("subchain head block num=", subBlockNumMax);
        logger.info("mainchain(subchain:" + chainConfig.localChainName + ") max blockNum =" + blockNum);


        //初始化block Num
        let blockNumInt = parseInt(blockNum, 10) + 1;
        var traceBlcokCount = subBlockNumMax - blockNumInt;
        logger.debug("trace block num count =", traceBlcokCount);

        if (subBlockNumMax - blockNumInt >= blockSyncMaxNum) {
            subBlockNumMax = blockNumInt + blockSyncMaxNum;
        }

        logger.info("need upload block range [" + blockNumInt + " -> " + subBlockNumMax - 1 + "]");
        let results = [];
        let blockListStr = "(";
        for (var i = blockNumInt; i < subBlockNumMax; i++) {
            let result = await chainApi.getBlockInfoData(chainConfig.getLocalHttpEndpoint(),(i).toString());
            logger.info("block " + i + ": (proposer:", result.proposer + ")");
            logger.debug("block:",result);
            logger.debug("header_extensions:", result.header_extensions);
            var extensions = [];
            if (result.header_extensions.length > 0) {
                result.header_extensions.forEach(function (item, index) {
                    extensions.push({"type": item[0], "data": item[1]})
                })
            }

            //logger.info("extensions:",extensions);
            /**
             * 需要上传
             */

            logger.debug("add push array(block num ：" + i + ")");
            results.push({
                "timestamp": result.timevalue,
                "proposer": result.proposer,
                // "proposerProof": proposerProof,
                "version": result.version,
                "previous": result.previous,
                "transaction_mroot": result.transaction_mroot,
                "action_mroot": result.action_mroot,
                "committee_mroot": result.committee_mroot,
                "header_extensions": extensions,
                "signature": result.signature,
                //blockNum : i
            });

            blockListStr += i + ",";


        }
        blockListStr += ")";
        logger.info("local uncommit blocklist :", blockListStr);

        /**
         * 块头上传
         */
        if (results) {
            const params = {
                chain_name: chainConfig.localChainName,
                headers: results
            };

            logger.info("block params:", params);
            logger.info("pushing block to head (chain_name :" + chainConfig.localChainName + " count :" + results.length + ") myAccountAsCommitteeList:",chainConfig.myAccountAsCommitteeList[need_sync_proposer_index],+ ") mySkAsAccountList:",chainConfig.mySkAsAccountList[need_sync_proposer_index]);
            if (results.length > 0) {
                await chainApi.contractInteract(chainConfig.config, contractConstants.FUTUREIO, "acceptheader", params, chainConfig.myAccountAsCommitteeList[need_sync_proposer_index], chainConfig.mySkAsAccountList[need_sync_proposer_index]);
            }
        }

        //上传同步块高的数据
        if (monitor.checkNeedSync() ) {
            await chainApi.confirmBlockCheckIn(monitor.getMonitorUrl(), monitor.generateSign({
                "baseChain": chainConfig.localChainName,
                "targetChain": constants.chainNameConstants.MAIN_CHAIN_NAME,
                "confirmBlock": monitor.getConfirmBlockLocal()
            }));
            await chainApi.confirmBlockCheckIn(monitor.getMonitorUrl(), monitor.generateSign({
                "baseChain": constants.chainNameConstants.MAIN_CHAIN_NAME,
                "targetChain": chainConfig.localChainName,
                "confirmBlock": monitor.getConfirmBlockMaster()
            }));
        } else {
            logger.error("monitor is false,need not upload confirm block info");
        }
        return;


    } else {
        logger.error("sync block is not needed")
    }

    logger.info("sync block finish")

}


/**
 * 同步主链块头
 * @returns {Promise<void>}
 */
async function syncMasterBlock() {

    if (monitor.isDeploying()) {
        logger.error("monitor.isDeploying(),wait...", monitor.isDeploying());
        return;
    } else {
        logger.info("monitor.isDeploying()", monitor.isDeploying());
    }

    if (isMainChain() == true) {
        logger.error("I am in masterchain ,need not sync master chain block");
        return;
    }

    logger.info("sync master block start syncChainData:",syncChainData," myAccountAsCommitteeList:",chainConfig.myAccountAsCommitteeList);

    //一次最大块数
    var blockSyncMaxNum = chainConfig.getLocalConfigInfo("blockSyncMaxNum", 10);

    if (syncChainData == true || (chainConfig.myAccountAsCommitteeList.indexOf("genesis") != -1 && chainConfig.configFileData.local.isSyncNewChain == true)) {

        var masterBlockNumMax = await chainApi.getMasterHeadBlockNum(chainConfig.config.httpEndpoint);
        if (masterBlockNumMax == null) {
            logger.error("masterBlockNumMax is null,abort sync block");
            return;
        }

        //获取主链现在最大的块头
        logger.info("masterBlockNumMax:",masterBlockNumMax);
        logger.info("start to push master block..");
        let blockNum = 0;
        let subchainBlockNumResult = await chainApi.getMasterBlockNum(chainConfig.nodPort);
        logger.info("subchain max block num:", subchainBlockNumResult);

        //设置已同步主链的块高信息
        let confirmed_block = subchainBlockNumResult.confirmed_block;
        logger.error("[sync master block]confirmed_block:",getHasConfirmBlock(confirmed_block));
        monitor.setConfirmBlockMaster(getHasConfirmBlock(confirmed_block));


        let forks = subchainBlockNumResult.forks;
        let findFlag = false;
        if (utils.isNullList(forks) == false) {
            for (let i = 0; i < forks.length; i++) {
                let fork = forks[i];
                let block_id = fork.block_id;
                logger.info("master fork:", fork);
                let localBlockId = 0;
                try {
                    let result = await chainApi.getBlockInfoData(chainConfig.config.httpEndpoint,fork.number.toString());
                    logger.debug("block info", result);
                    localBlockId = result.id;
                } catch (e) {
                    logger.error("get master block(" + fork.number + ") error,", e);
                }

                if (block_id == localBlockId) {
                    findFlag = true;
                    logger.info("master block id(" + block_id + ") == local master block id(" + localBlockId + "),match");
                    blockNum = fork.number;
                    break;
                } else {
                    logger.error("master block id(" + block_id + ") != local master block id(" + localBlockId + "),mot match");
                }

            }
        } else {
            findFlag = true;
        }

        //如果找不到块，不上传块头
        if (findFlag == false) {
            logger.error("can't find matched master block info , nedd not sync master block");
            return;
        }

        logger.info("master chain  head block num=", masterBlockNumMax);
        logger.info("subchain info(subchain:" + chainConfig.localChainName + ") max master synced blockNum =" + blockNum);


        //初始化block Num
        let blockNumInt = parseInt(blockNum, 10) + 1;


        if (masterBlockNumMax - blockNumInt >= blockSyncMaxNum) {
            masterBlockNumMax = blockNumInt + blockSyncMaxNum;
        }

        logger.info("need upload block range [" + blockNumInt + " -> " + masterBlockNumMax - 1 + "]");
        let results = [];
        let blockListStr = "(";
        for (var i = blockNumInt; i < masterBlockNumMax; i++) {
            let result = await chainApi.getBlockInfoData(chainConfig.config.httpEndpoint,(i).toString());
            logger.debug("master block " + i + ": (proposer:", result.proposer + ")");
            logger.debug("master block header_extensions:", result.header_extensions);
            var extensions = [];
            if (result.header_extensions.length > 0) {
                result.header_extensions.forEach(function (item, index) {
                    extensions.push({"type": item[0], "data": item[1]})
                })
            }

            //logger.info("extensions:",extensions);
            /**
             * 需要上传
             */

            logger.debug("add push array(block num ：" + i + ")");
            results.push({
                "timestamp": result.timevalue,
                "proposer": result.proposer,
                // "proposerProof": proposerProof,
                "version": result.version,
                "previous": result.previous,
                "transaction_mroot": result.transaction_mroot,
                "action_mroot": result.action_mroot,
                "committee_mroot": result.committee_mroot,
                "header_extensions": extensions,
                "signature": result.signature,
                //blockNum : i
            });
            blockListStr += i + ",";


        }
        blockListStr += ")";
        logger.info("local uncommit master blocklist :", blockListStr);

        /**
         * 主链块头上传
         */
        if (results) {
            const params = {
                headers: results
            };

            if (results.length > 0) {
                logger.debug("master block params:", params);
                logger.info("pushing master block to subchain ( count :" + results.length + ")");
                if (results.length > 0) {
                    let resAcceptMaster = await chainApi.contractInteract(chainConfig.configSub, contractConstants.FUTUREIO, "acceptmaster", params, chainConfig.myAccountAsCommitteeList[0], chainConfig.mySkAsAccountList[0]);
                    //logger.info("resAcceptMaster res:",resAcceptMaster);
                }
            }
        }


    } else {
        logger.error("sync master block is not needed")
    }

    logger.info("sync master block finish")

}

/**
 * 同步委员会
 * @returns {Promise<void>}
 */
async function syncCommitee() {

    try {
        logger.info("syncCommitee start");

        if ((syncChainData == true || (chainConfig.myAccountAsCommitteeList.indexOf("genesis") != -1 && chainConfig.configFileData.local.isSyncNewChain == true)) && isMainChain() == false) {

            var subBlockNumMax = await chainApi.getHeadBlockNum(chainConfig.nodPort);
            if (subBlockNumMax == null) {
                logger.error("[committee trx] subBlockNumMax is null,abort sync block");
                return;
            }
            logger.info("[committee trx] subBlockNumMax:" + subBlockNumMax);
            //获取本地最新的块头，获取服务端最新的块头
            let result = await chainApi.getBlockInfoData(chainConfig.getLocalHttpEndpoint(),(subBlockNumMax).toString());

            //判断是否要同步委员会
            let need_sync_proposer_index = -1;
            for(let k =0; k < chainConfig.myAccountAsCommitteeList.length; k++ ) {
                if ( blockUtil.needPushBlockByProducerList(result.proposer, chainConfig.myAccountAsCommitteeList[k], localProducers) ) {
                    logger.info("[committee trx] start sync committee,is me localProducers:",chainConfig.myAccountAsCommitteeList[k]);
                    need_sync_proposer_index = k;
                    break;
                }
            }
            if ( need_sync_proposer_index < 0 ) {
                logger.info("[committee trx] finish sync committee,is not me.. localProducersList:",chainConfig.myAccountAsCommitteeList);
                return;
            }

            let bulletin = await chainApi.getCommitteeBulletin(chainConfig.config, chainConfig.localChainName);

            if (bulletin.length == 0) {
                logger.error("no data in committee bulletin,need not do anythin");
            } else {
                logger.error("find data in committee bulletin,need to process:", bulletin);
                let syncNumCount = 0;
                //委员会同步数据
                var committeeCountRes = {
                    totalNum: 0,
                    successAccountNum: 0,
                    syncNum: 0,
                    blockNotReadyNum: 0,
                }

                let maxConfirmBlockNum = monitor.getConfirmBlockMaster();

                committeeCountRes.totalNum = bulletin.length;

                for (let i = 0; i < bulletin.length; i++) {
                    let bulletinObj = bulletin[i];
                    logger.info("[committee trx] check block(" + bulletinObj.block_num + ") confirmBlock(" + maxConfirmBlockNum + ")");

                    /**
                     * 判断confirm block是否已经同步了
                     */
                    if (bulletinObj.block_num > maxConfirmBlockNum) {
                        committeeCountRes.blockNotReadyNum++;
                        continue;
                    }

                    try {
                        //获取块信息并找到交易id
                        let blockInfo = await chainApi.getBlockInfoData(chainConfig.config.httpEndpoint,(bulletinObj.block_num).toString());
                        let trans = chainUtil.getMoveProdRTransFromBlockHeader(blockInfo, chainConfig.localChainName);
                        logger.error("[committee trx] trans(block:" + bulletinObj.block_num + "):", trans.length);
                        if (trans.length > 0) {
                            for (let t = 0; t < trans.length; t++) {
                                let tranId = trans[t].trx.id;
                                logger.info("[committee trx]block(" + bulletinObj.block_num + ") trxid(" + tranId + ")");

                                if (trxCacheSet.has(tranId) == true) {
                                    logger.info("[committee trx](blockheight:" + bulletinObj.block_num + ",trxid:" + tranId + " trx-m-root  is in cache,need not work");
                                    committeeCountRes.successAccountNum++;
                                    continue;
                                }

                                logger.info("[committee trx](blockheight:" + bulletinObj.block_num + ",trxid:" + tranId + " is not in cache,need query table check is ready");

                                logger.info("[committee trx]getMerkleProof(blockheight:" + bulletinObj.block_num + ",trxid:" + tranId);
                                let merkleProof = await chainApi.getMerkleProof(chainConfig.config, bulletinObj.block_num, tranId);
                                logger.info("[committee trx]merkleProof:", merkleProof);
                                if (utils.isNotNull(merkleProof)) {
                                    logger.debug("[committee trx]merkleProof trx_receipt_bytes:", merkleProof.trx_receipt_bytes);
                                    let tx_bytes_array = chainUtil.transferTrxReceiptBytesToArray(merkleProof.trx_receipt_bytes);

                                    let blockHeightInfo = await chainApi.getBlockHeaderInfo(chainConfig.getLocalHttpEndpoint(), chainNameConstants.MAIN_CHAIN_NAME_TRANSFER, bulletinObj.block_num);
                                    logger.debug("[committee trx]master blockHeightInfo(" + bulletinObj.block_num + "):", blockHeightInfo);
                                    let hashIsReady = checkHashIsready(blockHeightInfo, tranId);
                                    if (hashIsReady == true) {
                                        logger.info("[committee trx]master blockHeightInfo(" + bulletinObj.block_num + ") trx id : " + tranId + ", is ready, need not push");
                                        trxCacheSet.add(tranId);
                                        committeeCountRes.successAccountNum++;
                                        continue;
                                    }

                                    /**
                                     * 未在缓存中，重新投递消息
                                     */
                                    logger.info("[committee trx]master blockHeightInfo(" + bulletinObj.block_num + ") trx id : " + tranId + ", is not ready, need push");

                                    //控制最大次数
                                    if (syncNumCount >= 1) {
                                        logger.error("[committee trx]sync Committee count (" + syncNumCount + ") >= maxnum(" + monitor.getSyncBlockHeaderMaxTranNum() + "),need break");
                                        break;
                                    }

                                    let param = {
                                        chain_name: chainNameConstants.MAIN_CHAIN_NAME_TRANSFER,
                                        block_number: bulletinObj.block_num,
                                        merkle_proofs: merkleProof.merkle_proof,
                                        tx_bytes: tx_bytes_array.toString()
                                    }
                                    logger.info("[Sync Ugas-Master]prepare to push sync  transfer trx:", param);

                                    param = {
                                        chain_name: chainNameConstants.MAIN_CHAIN_NAME_TRANSFER,
                                        block_number: bulletinObj.block_num,
                                        merkle_proofs: merkleProof.merkle_proof,
                                        tx_bytes: tx_bytes_array
                                    }

                                    syncNumCount++;
                                    committeeCountRes.syncNum++;

                                    let res = await chainApi.contractInteract(chainConfig.configSub, contractConstants.FUTUREIO, "synclwctx", param, chainConfig.myAccountAsCommitteeList[need_sync_proposer_index], chainConfig.mySkAsAccountList[need_sync_proposer_index]);
                                    logger.info("[committee trx]synclwctx res:", res);
                                }

                                //控制最大次数
                                if (syncNumCount >= 1) {
                                    logger.error("[committee trx]sync Committee count (" + syncNumCount + ") >= maxnum(1),need break");
                                    break;
                                }
                            }

                        }

                    } catch (e) {
                        logger.error("[committee trx] sync committee tran error:", e);
                    }

                }


                logger.error("[committee trx]sync committee res:", committeeCountRes);

            }
        }
    }
    catch
        (e)
        {
            logger.error("[committee trx] error:", e);
        }

        logger.info("sync committee end");
    }

/**
 * 同步链信息
 * @returns {Promise<void>}
 */
async function syncChainInfo() {
    try {

        logger.info("sync chain info and committee start..");

        //如果已在切换链过程中，不需要再同步数据
        if (syncChainChanging == true) {
            logger.info("chain changing , need not sync chain info");
            return;
        }

        logger.info("[seed check] start to check seed is alive");

        //同步seed的信息
        seedCheckCount++;
        logger.info("sync chain seed count :",seedCheckCount);
        if (seedCheckCount >= 120) {
            seedCheckCount = 0;
            //检查主链seed是否有变化
            let mainSeedList = await chainApi.getChainHttpListByGroup(chainNameConstants.MAIN_CHAIN_NAME, chainConfig);
            if (mainSeedList.length > 0 && mainSeedList.length != chainConfig.config.seedHttpList.length) {
                logger.error("mainSeedList.length(" + mainSeedList.length + ") != config.seedHttpList(" + chainConfig.config.seedHttpList.length + "),need update main seedList:", mainSeedList);
                chainConfig.config.seedHttpList = mainSeedList;
            } else {
                logger.info("mainSeedList.length(" + mainSeedList.length + ") == config.seedHttpList(" + chainConfig.config.seedHttpList.length + "),need not update main seedList:", chainConfig.config.seedHttpList);
            }

            //检查子链seed是否有变化
            let subSeedList = await chainApi.getChainHttpListByGroup(chainConfig.localChainName, chainConfig);
            if (subSeedList.length > 0 && subSeedList.length != chainConfig.configSub.seedHttpList.length) {
                logger.error("subSeedList.length(" + subSeedList.length + ") != configSub.seedHttpList(" + chainConfig.configSub.seedHttpList.length + "),need update subchain seedList:", subSeedList);
                chainConfig.configSub.seedHttpList = subSeedList;
            } else {
                logger.info("subSeedList.length(" + subSeedList.length + ") == configSub.seedHttpList(" + chainConfig.configSub.seedHttpList.length + "),need not update sub seedList:", chainConfig.configSub.seedHttpList);
            }
        }

        //5个周期做一次seed check，减少seed 检查的频率
        if (seedCheckCount % 5  == 1) {
            //定期更新configsub
            await chainApi.checkSubchainSeed(chainConfig);

            //定期更新config
            await chainApi.checkMainchainSeed(chainConfig);


            //同步链名称（子链id,链名称等）
            let chainName = null;
            let chainId = null;
            let genesisTime = null;
            let genesisPk = null;
            if (utils.isNull(chainConfig.configSub.chainId)) {
                chainConfig.configSub.chainId = await chainApi.getChainId(chainConfig.configSub);
            }

            if (utils.isNull(chainConfig.config.chainId)) {
                chainConfig.config.chainId = await chainApi.getChainId(chainConfig.config);
            }
            logger.info("get masterchain config.chainId=", chainConfig.config.chainId," subchain configSub.chainId=", chainConfig.configSub.chainId);


            let chainInfo = await chainApi.getChainInfo(chainConfig.config, chainConfig.myAccountAsCommitteeList[0]);
            logger.info("chain info from mainchain:", chainInfo," localChainName:",chainConfig.localChainName);
            if (utils.isNotNull(chainInfo)) {
                chainName = chainInfo.location;
                chainId = chainInfo.chain_id;
                genesisTime = chainUtil.formatGensisTime(chainInfo.genesis_time);
                genesisPk = chainInfo.genesis_pk;
            }

            //设置用户属于的chainid和chainname信息
            logger.info("chain info localChainName:", chainConfig.localChainName," chain_name:",chainConfig.chainName);
            if (utils.isNotNull(chainName)) {
                chainConfig.chainName = chainName;
            }
            if (utils.isNotNull(chainId) && chainIdConstants.NONE_CHAIN != chainId) {
                chainConfig.chainId = chainId;
            }
            if (utils.isNotNull(genesisTime)) {
                chainConfig.genesisTime = genesisTime;
                chainConfig.genesisPK = genesisPk;
            }

            logger.error("genesis-pk is ", chainConfig.genesisPK);

            //如果是主链，啥都不操作
            if (isMainChain()) {
                logger.error(chainConfig.myAccountAsCommitteeList[0] + " runing in main chain, need not work");
                //check alive
                await checkNodAlive();
            }

            //如果是非出块节点，啥都不操作
            if (chainConfig.isNoneProducer()) {
                syncChainData = false;
                logger.error(chainConfig.myAccountAsCommitteeList[0] + " runing is none-producer, need not work");
                //check alive
                await checkNodAlive();
                return;
            }

            logger.info(chainConfig.myAccountAsCommitteeList[0] + " belongs to chaininfo (name:" + chainConfig.chainName + ",chain_id:" + chainConfig.chainId + " ,genesisTime:" + chainConfig.genesisTime + ") from mainchain");
            logger.info("now subchain's chainid :" + chainConfig.configSub.chainId);

            //主链返回的chainname非法，说明主链返回的有问题，或者是该用户在主链不存在,不工作
            if (chainConfig.chainName == chainNameConstants.INVAILD_CHAIN_NAME) {
                syncChainData = false;
                logger.error(chainConfig.myAccountAsCommitteeList[0] + " is a invalid name in main chain,need not work");
                await checkNodAlive();
                return;
            }

            //同步本地委员会
            logger.info("sync local commitee");
            //获取本地prodcuers信息
            let producerList = await chainApi.getProducerLists(chainConfig.getLocalHttpEndpoint());
            logger.debug("subchain producers: ", producerList);
            if (utils.isNotNull(producerList) && producerList.length > 0) {
                localProducers = producerList;
            } else {
                logger.error("get subchain producers is null,sync committee end", producerList);
            }

            var isStrillInCommittee = committeeUtil.isStayInCommittee(localProducers, chainConfig.myAccountAsCommitteeList[0]);
            //检查自己是否不在委员会里面
            if (!isStrillInCommittee) {
                syncChainData = false;
                logger.info("I(" + chainConfig.myAccountAsCommitteeList[0] + ") am not in subchain committee")
            } else {
                syncChainData = true;
                logger.info("I(" + chainConfig.myAccountAsCommitteeList[0] + ") am still in subchain committee")
            }

            //非主链需要检查是否要调度
            if (isMainChain() == false) {
                var rightChain = chainConfig.isInRightChain()
                if (!rightChain) {
                    //我已不属于这条链，准备迁走
                    if (isStrillInCommittee) {
                        logger.error("I(" + chainConfig.myAccountAsCommitteeList[0] + ") am still in subchain committee,can't be transfer,wait...")
                    } else {
                        syncChainData = false;
                        logger.info(chainConfig.myAccountAsCommitteeList[0] + " are not in subchain committee , need trandfer to chain(" + chainName + "）, start transfer...");
                        if (monitor.isDeploying() == true) {
                            logger.error("monitor isDeploying, wait to switchChain");
                            sleep.msleep(1000);
                        } else {
                            sleep.msleep(1000);
                            syncChainChanging = true;
                            monitor.disableDeploy();

                            //清除数据
                            clearCacheData()
                            //开始迁移
                            await switchChain();
                            return;
                        }
                    }
                } else {
                    syncChainChanging = false;
                    logger.info("i am in right chain");
                }
            }
        }

        //check nod alive
        await checkNodAlive();
        //check wss alive
        await checkWssAlive();

    } catch (e) {
        logger.error("sync chain error:", e);
    }

    logger.info("sync chain info and committee end");

}

/**
 *
 * @returns {Promise<void>}
 */
async function checkNodProcess() {
    let nodKeyword = "nodfuture";
    let nodPath = utils.formatHomePath(chainConfig.configFileData.local.nodpath) + "/" + filenameConstants.NOD_EXE_FILE;
    chainUtil.checkProcess(nodKeyword, nodPath, function (result) {
        processRuning = result;
    });
    return processRuning;
}



/**
 * 检查nod是否还存活
 * @returns {Promise<void>}
 */
async function checkNodAlive() {

    logger.info("start to checkNodAlive....");

    //检查程序进程
    await checkNodProcess();

    let rsdata = await NodFuture.checkAlive(chainConfig.nodPort);
    if (rsdata != null) {
        logger.info("head_block_num:",rsdata.head_block_num);
        monitor.setHeadBlockNum(rsdata.head_block_num);
    } else {
        logger.error("head_block_num is null");
    }
    //配置文件和monitor配置同时关闭才生效
    if (chainConfig.configFileData.local.enableRestart == false || monitor.needCheckNod() == false) {
        logger.error("local config enable restart("+chainConfig.configFileData.local.enableRestart+") == false || monitor enable restart("+monitor.needCheckNod()+") == false, need not check nod alive");
        return;
    }

    logger.info("local config enable restart == true || monitor enable restart == true,need check nod alive syncChainChanging:",syncChainChanging, " isSyncNewChain:",chainConfig.configFileData.local.isSyncNewChain);

    //如果不在进行链切换且本地访问不到本地链信息，需要重启下
    if (syncChainChanging == false) {
        logger.info("checking nod is alive ....");
        logger.debug("check alive data:", rsdata);

        if (utils.isNull(rsdata)) {
            if (nodFailedTimes >= getmaxNodFailedTimes()) {
                nodFailedTimes = 0;
                logger.info("nod is not runing ,need restart it..");
                await restartNod();
                logger.info("nod restart end..");
            } else {

                if (chainConfig.isProducer() == false) {
                    logger.info("I am a none-producer,need to check process");
                    if (processRuning == true) {
                        logger.info("I am a none-producer,and processRuning is running,need not check restart");
                    } else {
                        logger.error("I am a none-producer,and processRuning is not running,need check restart");
                        nodFailedTimes++;
                        logger.info("nod is not alive,count(" + nodFailedTimes + ")");
                    }

                } else {

                    logger.info("I am a producer,and processRuning is "+processRuning);

                    nodFailedTimes++;
                    logger.info("nod is not alive,count(" + nodFailedTimes + ")");
                }

                NodFuture.getNewestLog(chainConfig.getLocalConfigInfo("nodLogPath", "/log"), function (log) {
                    nodLogData = log;
                    if (utils.isNotNull(nodLogData)) {
                        let l = nodLogData.length;
                        logger.info("get nod log data:", nodLogData.substring(l - 100));
                    }

                });
            }
        } else {
            nodFailedTimes = 0;
            nodLogData = "";
        }
    }
}

/**
 * 检查wss进程是否还存活
 * @returns {Promise<void>}
 */
async function checkWssAlive() {
    try {
        if (chainConfig.isMongo() == true) {
            logger.info("checkWssAlive mongo not check wss alive");
            return;
        }
        if ( processRuning == false ) {
            logger.info("checkWssAlive node process not running,need to start together");
            return;
        }
        //检查程序进程
        if (utils.isNotNull(await WorldState.checkAlive()) == true) {
            logger.info("checkWssAlive wss is alive");
            wssFailedTimes = 0;
            return;
        }
        wssFailedTimes++;
        logger.info("checkWssAlive wss not alive, need restart current wssFailedTimes:",wssFailedTimes);
        if( wssFailedTimes < maxWssFailedTimes) {
            return;
        }
        wssFailedTimes = 0;
        let seedIpInfo = await chainApi.getChainSeedIPByGroup(chainConfig.localChainName, chainConfig);
        if (utils.isNull(seedIpInfo)) {
            logger.info("checkWssAlive getChainSeedIPByGroup serach seedIpInfo is null try serach getChainSeedIP");
            seedIpInfo = await chainApi.getChainSeedIP(chainConfig.localChainName, chainConfig);
        }
        let killWssResult = await WorldState.stop(120000);
        if (killWssResult == true) {
            logger.info("checkWssAlive worldstate already stopped");
        } else {
            logger.info("checkWssAlive worldstate is not stopped ,not restart");
            return;
        }
        let result = await WorldState.start(chainConfig.chainName, seedIpInfo, 120000, utils.formatHomePath(chainConfig.configFileData.local.wsspath),chainConfig.localTest,chainConfig);
        if (result == true) {
            logger.info("checkWssAlive start ws success");
        } else {
            logger.info("checkWssAlive restart ws success faild");
        }
    } catch (e) {
        logger.error("checkWssAlive exception:", e);
    }
}

/**
 * 清除缓存信息
 */
function clearCacheData() {
    WorldState.status = null;
    nodFailedTimes = 0;
    trxCacheSet.clear()
    monitor.setHeadBlockNum(0);
    monitor.clearConfirmBlock();
}

function clearCache() {
    logger.info("clear chain cache");
    trxCacheSet.clear();
}

/**
 * 链接切换
 * @returns {Promise<void>}
 */
async function switchChain() {

    loggerChainChanging.info("starting to switch chain...");
    let param = [];
    let logMsg = "";
    try {

        param = await monitor.buildParam();
        param.chainNameFrom = chainConfig.localChainName;
        param.chainNameTo = chainConfig.chainName;
        param.startTime = new Date().getTime();

        //停止nod程序
        loggerChainChanging.info("shuting down nod...")
        let result = await NodFuture.stop(120000,chainConfig.nodPort);
        if (result == false) {
            loggerChainChanging.info("nod is stopped");
            logMsg = utils.addLogStr(logMsg,"nod is stopped");
        } else {
            loggerChainChanging.info("nod is not stopped");
            logMsg = utils.addLogStr(logMsg,"nod is not stopped");
        }

        //停止worldstate的程序
        if (chainConfig.configFileData.local.worldstate == true) {
            result = await WorldState.stop(120000);
            if (result) {
                logger.info("worldstate is stopped");
                logMsg = utils.addLogStr(logMsg,"worldstate is stopped");
            } else {
                logger.info("worldstate is not stopped");
                logMsg = utils.addLogStr(logMsg,"worldstate is not stopped");
            }
        }

        //删除block和shared_memory.bin数据
        await NodFuture.removeData();
        loggerChainChanging.info("remove block data and shared_memory.bin");
        logMsg = utils.addLogStr(logMsg,"remove block data");
        sleep.msleep(5000);


        //清除世界状态数据
        if (chainConfig.configFileData.local.worldstate == true) {
            await WorldState.clearDB();
            loggerChainChanging.info("remove worldstate data files");
            logMsg = utils.addLogStr(logMsg,"remove worldstate file");
            sleep.msleep(5000);
        }

        //通过chainid拿到seedList
        let privateIpFlag = true;
        loggerChainChanging.info("switchChain cur chain_name:",chainConfig.chainName, " localChainName:",chainConfig.localChainName);
        let search_chain_name = chainConfig.chainName;
        let seedIpInfo = await chainApi.getChainSeedIPByGroup(search_chain_name, chainConfig);
        if (utils.isNull(seedIpInfo)) {
            logger.error("get chainid(" + search_chain_name + ")'s seed ip info from group is null,need get from seedlist:", seedIpInfo);
            seedIpInfo = await chainApi.getChainSeedIP(search_chain_name, chainConfig);
            privateIpFlag = false;
            if (utils.isNull(seedIpInfo)) {
                logger.error("switchChain seedIpInfo is null ");
                privateIpFlag = false;
            }
        }

        logger.info("get chainid(" + search_chain_name + ")'s seed ip info:", seedIpInfo);
        if (utils.isNull(seedIpInfo)) {
            loggerChainChanging.error("seed ip info is null");
            logMsg = utils.addLogStr(logMsg,"seed ip info is null");
            syncChainChanging = false;
            monitor.enableDeploy();
            param.endTime = new Date().getTime();
            param.status = 0;
            param.result = logMsg;
            await chainApi.addSwitchLog(monitor.getMonitorUrl(),param);
            return;
        }

        //通过chainid拿到peerkeys
        let chainPeerInfo = await chainApi.getChainPeerKeyByGroup(chainConfig.chainName, chainConfig);
        logger.info("get chainid(" + chainConfig.chainName + ")'s peer info:", chainPeerInfo);
        if (utils.isNull(chainPeerInfo)) {
            loggerChainChanging.error("chainPeerInfo is null");
            logMsg = utils.addLogStr(logMsg,"chainPeerInfo is null");
        }


        let wssinfo = " ";
        let wssFilePath = null;
        //重启世界状态并拉块
        if (chainConfig.configFileData.local.worldstate == true) {
            logger.info("start world state");
            logMsg = utils.addLogStr(logMsg,"start world state");
            result = await WorldState.start(chainConfig.chainName, seedIpInfo, 120000, utils.formatHomePath(chainConfig.configFileData.local.wsspath),chainConfig.localTest,chainConfig);
            if (result == true) {
                logger.info("start ws success");
                logMsg = utils.addLogStr(logMsg,"start ws success");
            } else {
                logger.info("start ws error");
                logMsg = utils.addLogStr(logMsg,"start ws error");
                // syncChainChanging = false;
                // return;
            }

            sleep.msleep(2000);

            //调用世界状态程序同步数据
            var worldstatelist = null;
            let mainChainData = await chainApi.getTableAllData(chainConfig.config, contractConstants.FUTUREIO, chainConfig.chainName, tableConstants.WORLDSTATE_HASH, "block_num");
            if (utils.isNotNull(mainChainData) && mainChainData.rows.length > 0) {
                //worldstatedata = mainChainData.rows[mainChainData.rows.length - 1];
                worldstatelist = chainUtil.getValidWorldStateList(mainChainData.rows);
                logger.info("get worldstate data:", worldstatelist);
            } else {
                logger.error("can not get world state file,or data is null");
                logMsg = utils.addLogStr(logMsg,"ws data is null");
            }

            if (worldstatelist != null && worldstatelist.length > 0) {
                sleep.msleep(1000);
                let blockNum = 0;
                loggerChainChanging.info("start to require ws:");
                for(var i = 0; i < worldstatelist.length; i++) {
                    let hash = worldstatelist[i].hash_v[0].hash;
                    blockNum = worldstatelist[i].block_num;
                    let filesize = worldstatelist[i].hash_v[0].file_size;
                    logger.info("start to require ws : (block num : " + blockNum + " " + "hash:" + hash);
                    result = await WorldState.syncWorldState(hash, blockNum, filesize, chainConfig.chainId);
                    if (result == true) {
                        logger.info("sync worldstate request success");
                        logMsg = utils.addLogStr(logMsg,"sync ws req success");
                    } else {
                        logger.info("sync worldstate request failed");
                        logMsg = utils.addLogStr(logMsg,"sync ws req error");
                    }

                    loggerChainChanging.info("polling worldstate sync status ..")

                    sleep.msleep(1000);

                    /**
                     * 轮询检查同步世界状态情况
                     */
                    wssFilePath = pathConstants.WSS_DATA+ chainConfig.chainId + "-" + blockNum + ".ws";
                    wssinfo = "--worldstate " + pathConstants.WSS_DATA + chainConfig.chainId + "-" + blockNum + ".ws";

                    result = await WorldState.pollingkWSState(1000, 1200000);
                    if (result == false) {
                        logger.error("require ws error："+wssinfo);
                        logMsg = utils.addLogStr(logMsg,"require ws error");
                        wssinfo = " ";
                        wssFilePath = " ";
                    } else {
                        logMsg = utils.addLogStr(logMsg,"require ws success");
                        logger.info("require ws success");
                        logger.info("wssinfo:" + wssinfo);
                        //check file exist
                        if (fs.existsSync(wssFilePath)) {
                            logger.info("file exists :",wssFilePath);
                            break;
                        } else {
                            logger.error("file not exists :",wssFilePath)
                        }
                    }
                }

                sleep.msleep(1000);

                //判断配置是否需要拉块
                if (chainConfig.configFileData.local.wsSyncBlock == true) {
                    logger.info("wsSyncBlock is true，need sync block");
                    logMsg = utils.addLogStr(logMsg,"require block start");
                    /**
                     * 调用block
                     */
                    logger.info("start to sync block:(chainid:" + chainConfig.chainId + ",block num:" + blockNum);
                    result = await WorldState.syncBlocks(chainConfig.chainId, blockNum);
                    if (result == false) {
                        logger.info("sync block request error");
                    } else {
                        logger.info("sync block request success");
                    }

                    sleep.msleep(1000);

                    /**
                     * 轮询检查同步世界状态情况block
                     */
                    logger.info("pollingBlockState start...");
                    result = await WorldState.pollingBlockState(1000, 300000);
                    if (result == false) {
                        logger.info("require block error");
                        logMsg = utils.addLogStr(logMsg,"require block error");
                    } else {
                        logger.info("require block success");
                        logMsg = utils.addLogStr(logMsg,"require block success");
                    }

                    sleep.msleep(1000);

                } else {
                    logger.info("wsSyncBlock is false，need not sync block");
                    logMsg = utils.addLogStr(logMsg,"require block not need");
                    sleep.msleep(3000);
                }
            }
        }


        //修改nod程序配置信息
        search_chain_name = chainConfig.chainName;
        var subchainEndPoint = await chainApi.getSubchanEndPoint(search_chain_name, chainConfig);
        var subchainMonitorService = await chainApi.getSubchanMonitorService(search_chain_name, chainConfig);
        logger.info("get chainid(" + search_chain_name + ")'s seed ip info:", seedIpInfo);
        logger.info("subchainEndPoint:", subchainEndPoint);
        logger.info("genesisTime:", chainConfig.genesisTime);
        logger.info("genesisPK:", chainConfig.genesisPK);
        logger.info("get chainid(" + search_chain_name + ")'s", subchainMonitorService);
        result = await NodFuture.updateConfig(seedIpInfo, privateIpFlag,subchainEndPoint, chainConfig.genesisTime, chainConfig.genesisPK, subchainMonitorService,chainPeerInfo,chainConfig.chainName);
        if (result == true) {
            logMsg = utils.addLogStr(logMsg,"update nod config success");
            loggerChainChanging.info("update nod config file success")
            //重新加载配置文件信息
            loggerChainChanging.info("reload config files")
            await chainConfig.waitSyncConfig();
            loggerChainChanging.info("reload config files ready")
        } else {
            loggerChainChanging.error("update nod config file error")
            logMsg = utils.addLogStr(logMsg,"update nod config file error");
            syncChainChanging = false;
            monitor.enableDeploy();
            param.endTime = new Date().getTime();
            param.status = 0;
            param.result = logMsg;
            await chainApi.addSwitchLog(monitor.getMonitorUrl(),param);
            return;
        }


        //check file exist
        if (fs.existsSync(wssFilePath)) {
            logger.info("file exists :",wssFilePath);
            logger.info("start nod use wss:",wssinfo);
        } else {
            logger.error("file not exists :",wssFilePath);
            logger.info("start nod not use wss:",wssinfo);
            wssinfo = " "
        }


        let cmd = "sync && cd " + utils.formatHomePath(chainConfig.configFileData.local.nodpath);
        process.exec(cmd, async function (error, stdout, stderr, finish) {
            if (error !== null) {
                logger.error("exccmd error:" + cmd);
                logger.error('exec error: ' + error);

                logMsg = utils.addLogStr(logMsg,"error:"+cmd);
                param.status = 0;
            } else {
                logger.info("exccmd success:" + cmd);

                //启动nod
                result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), wssinfo, chainConfig.localTest, chainConfig.nodPort);
                if (result == true) {
                    logger.info("nod start success");
                    logMsg = utils.addLogStr(logMsg, "nod start success");
                    param.status = 1;

                    //等待配置信息同步完成-重新加载配置
                    chainConfig.clearChainInfo();
                    await chainConfig.waitSyncConfig()

                } else {
                    logger.error("node start error");
                    logMsg = utils.addLogStr(logMsg, "nod start error");
                    param.status = 0;
                }

            }

            //结束设置结束flag
            logMsg = utils.addLogStr(logMsg,"switching chain end");
            loggerChainChanging.info("switching chain successfully...");
            param.result = logMsg;
            await finsihSwitchChain(param);

        });

    } catch (e) {
        loggerChainChanging.info("fail to switch chain...", e);
        //结束设置结束flag
        param.result = "error,"+e.toString();
        await finsihSwitchChain(param);
    }
}


var nodLogData = "";


/**
 * 重启nod
 * @returns {Promise<void>}
 */
async function restartNod() {

    if (monitor.isDeploying() == true) {
        logger.info("monitor isDeploying, wait to restart");
        sleep.msleep(1000);
        return;
    }

    //producer节点
    if (chainConfig.isNoneProducer() == false) {
        await restartNodProducer();
        return;
    }

    //seed节点
    if (chainConfig.isSeed() == true) {
        await restartSeed();
        return;
    }

    //mongo节点
    if (chainConfig.isMongo() == true) {
        await restartMongo();
        return;
    }

}

/**
 * 重启nod-seed节点
 * @returns {Promise<void>}
 */
async function restartSeed() {
    logger.info("start to restart nod(seed)");

    //标志位设置
    syncChainChanging = true;
    monitor.disableDeploy();


    let param = [];
    let logMsg = "";

    try {
        param = await monitor.buildParam();
        param.chainName = chainConfig.localChainName;
        param.startTime = new Date().getTime();
        param.status = 0;

        logger.info("[seed restart]start to launch nod directly...");
        logMsg = utils.addLogStr(logMsg, "[seed restart]start to launch nod directly...");

        logger.info("[seed restart]stop nod start");
        logMsg = utils.addLogStr(logMsg, "[seed restart]stop nod start");
        //停止nod
        await NodFuture.stop(120000, chainConfig.nodPort);
        sleep.msleep(1000);
        logger.info("[seed restart]stop nod finish");
        logMsg = utils.addLogStr(logMsg, "[seed restart]stop nod finish");

        //启动nod
        //let result = await NodFuture.start(10000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), "", chainConfig.localTest,chainConfig.nodPort);
        let result = false;
        if (result == false) {
            //logger.error("[seed restart]node start error");
            //logMsg = utils.addLogStr(logMsg, "[seed restart]nod start error,maybe database is dirty");

            //启动ws
            //停止worldstate的程序
            result = await WorldState.stop(120000);
            if (result) {
                logger.info("[seed restart]worldstate is stopped");
                logMsg = utils.addLogStr(logMsg, "[seed restart]worldstate is stopped");
            } else {
                logger.info("[seed restart]worldstate is not stopped");
                logMsg = utils.addLogStr(logMsg, "[seed restart]worldstate is not stopped");
            }

            //通过chainid拿到seedList
            logger.info("[seed restart] cur chain_name:",chainConfig.chainName, " localChainName:",chainConfig.localChainName);
            let seedIpInfo = await chainApi.getChainSeedIPByGroup(chainConfig.localChainName, chainConfig);
            if (utils.isNull(seedIpInfo)) {
                logger.info("[seed restart] getChainSeedIPByGroup serach seedIpInfo is null try serach getChainSeedIP");
                seedIpInfo = await chainApi.getChainSeedIP(chainConfig.localChainName, chainConfig);
            }
            logger.info("[seed restart]get chainid(" + chainConfig.localChainName + ")'s seed ip info:", seedIpInfo);
            if (utils.isNull(seedIpInfo)) {
                loggerChainChanging.error("[seed restart]seed ip info is null");
                logMsg = utils.addLogStr(logMsg, "seed ip info is null(chainName:" + chainConfig.localChainName + ")");
            } else {
                logger.info("[seed restart]start world state");
                result = await WorldState.start(chainConfig.localChainName, seedIpInfo, 60000, utils.formatHomePath(chainConfig.configFileData.local.wsspath), chainConfig.localTest, chainConfig);
                if (result == false) {
                    logger.info("[seed restart]start ws error");
                    logMsg = utils.addLogStr(logMsg, "start ws error");
                } else {
                    logger.info("[seed restart]start ws success");
                    logMsg = utils.addLogStr(logMsg, "start ws success");

                    //通过ws获取本地最大块信息
                    let localMaxBlockHeight = await WorldState.getLocalBlockInfo();
                    logger.info("[seed restart]localMaxBlockHeight is:", localMaxBlockHeight, utils.isNull(localMaxBlockHeight) );
                    if (utils.isNull(localMaxBlockHeight)) {
                        logMsg = utils.addLogStr(logMsg, "localMaxBlockHeight is null");
                    } else {
                        logMsg = utils.addLogStr(logMsg, "localMaxBlockHeight is " + localMaxBlockHeight);

                        //ws文件ready
                        let wsFileReady = false;

                        //世界状态文件
                        let wssFilePath = "";
                        let wssinfo = "";

                        //调用表数据找到需要下载的世界状态文件信息
                        let wsTableData = await chainApi.getTableAllData(chainConfig.config, contractConstants.FUTUREIO, chainConfig.localChainName, tableConstants.WORLDSTATE_HASH, "block_num");
                        let wsResList = chainUtil.getNearestWsInfoByBlockHeight(wsTableData, localMaxBlockHeight);
                        if (utils.isNull(wsResList) || wsResList.length <= 0) {
                            logger.error("[seed restart]get ws info by block height is null");
                            logMsg = utils.addLogStr(logMsg, "get ws info by block height is null");
                        } else {
                            logger.info("[seed restart]get ws info list by block height is ", wsResList);
                            logMsg = utils.addLogStr(logMsg, "[seed restart]get ws info list by block height is "+wsResList);
                            for(var i = 0; i < wsResList.length; i++) {
                                //世界状态文件
                                wssFilePath = pathConstants.WSS_LOCAL_DATA + chainConfig.configSub.chainId + "-" + wsResList[i].block_num + ".ws";
                                wssinfo = "--worldstate " + wssFilePath + " --truncate-at-block " + localMaxBlockHeight+constants.CMD_HARDREPLAY_BLOCKS;

                                //从本地查找ws文件
                                if (fs.existsSync(wssFilePath) == true) {
                                    logger.info("[seed restart]ws file exists in local:" + wssFilePath);
                                    logMsg = utils.addLogStr(logMsg, "[seed restart]ws file exists in local:"+wssFilePath+")");
                                    wsFileReady = true;
                                    break;
                                } else {
                                    //本地不存在世界状态文件，需要通过ws拉取
                                    logger.error("[seed restart]ws file not exists in local:" + wssFilePath);
                                    logMsg = utils.addLogStr(logMsg, "[seed restart]ws file not exists in local:\"+wssFilePath)");

                                    wssFilePath = pathConstants.WSS_DATA + chainConfig.configSub.chainId + "-" + wsResList[i].block_num + ".ws";
                                    wssinfo = "--worldstate " + wssFilePath + " --truncate-at-block " + localMaxBlockHeight+constants.CMD_HARDREPLAY_BLOCKS;

                                    //通过seed拉取世界状态
                                    result = await WorldState.syncWorldState(wsResList[i].hash, wsResList[i].block_num, wsResList[i].file_size, chainConfig.configSub.chainId);
                                    if (result == false) {
                                        logger.error("sync worldstate request failed,wsResList[i].block_num:",wsResList[i].block_num);
                                        logMsg = utils.addLogStr(logMsg, "[seed restart]sync worldstate request failed");
                                    } else {
                                        logger.info("sync worldstate request success");
                                        logMsg = utils.addLogStr(logMsg, "[seed restart]sync worldstate request success");

                                        loggerChainChanging.info("polling worldstate sync status ..")
                                        sleep.msleep(1000);

                                        /**
                                         * 轮询检查同步世界状态情况
                                         */
                                        result = await WorldState.pollingkWSState(1000, 1200000);
                                        if (result == false) {
                                            logMsg = utils.addLogStr(logMsg, "require ws error");
                                            logger.error("require ws error：" + wssinfo);
                                        } else {
                                            logger.info("require ws success");
                                            logMsg = utils.addLogStr(logMsg, "require ws success");
                                            logger.info("wssinfo:" + wssinfo);

                                            //检查文件是否下载成功
                                            if (fs.existsSync(wssFilePath) == false) {
                                                //下载失败
                                                logger.error("[seed restart]file not exists :", wssFilePath);
                                                logger.info("[seed restart]start nod not use wss:", wssinfo);
                                                logMsg = utils.addLogStr(logMsg, "file not exists :" + wssFilePath);
                                            } else {
                                                //下载成功
                                                logger.info("[seed restart]file exists :", wssFilePath);
                                                logger.info("[seed restart]start nod use wss:", wssinfo);
                                                logMsg = utils.addLogStr(logMsg, "file exists :" + wssFilePath + ", start nod use wss:" + wssinfo);
                                                wsFileReady = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            //世界状态文件确认存在
                            if (wsFileReady == true) {

                                //清除state目录
                                WorldState.clearStateDir();
                                logger.info("[seed restart]clear state dir");
                                logMsg = utils.addLogStr(logMsg, "clear state dir");

                                logMsg = utils.addLogStr(logMsg, "start nod :"+wssinfo);

                                let cmd = "sync && cd " + utils.formatHomePath(chainConfig.configFileData.local.nodpath);
                                process.exec(cmd, async function (error, stdout, stderr, finish) {
                                    if (error !== null) {
                                        logger.error("exccmd error:" + cmd);
                                        logger.error('exec error: ' + error);

                                        logMsg = utils.addLogStr(logMsg,"error:"+cmd);
                                        param.status = 0;
                                    } else {
                                        logger.info("exccmd success:" + cmd);

                                        //启动nod
                                        result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), wssinfo, chainConfig.localTest, chainConfig.nodPort);
                                        if (result == true) {
                                            logger.info("[seed restart]nod start success");
                                            logMsg = utils.addLogStr(logMsg, "nod start success");
                                            param.status = 1;
                                        } else {
                                            logger.error("[seed restart]node start error");
                                            logMsg = utils.addLogStr(logMsg, "nod start error");
                                            param.status = 0;
                                        }

                                    }

                                    //调用接口完成重启
                                    param.result = logMsg;
                                    await finsihRestart(param);

                                });

                            }

                        }

                        //使用hard-replay方式启动,暂不允许该方式启动
                        if ( false ) {//(utils.isNotNull(localMaxBlockHeight) && wsFileReady == false) {
                            let startinfo = " --truncate-at-block "+localMaxBlockHeight+constants.CMD_HARDREPLAY_BLOCKS;
                            logger.info("[seed restart] localMaxBlockHeight("+localMaxBlockHeight+") is not null,use hard-replay to start nod: "+startinfo);
                            logMsg = utils.addLogStr(logMsg, "[seed restart] localMaxBlockHeight("+localMaxBlockHeight+") is not null,use hard-replay to start nod:"+startinfo);


                            let cmd = "sync && cd " + utils.formatHomePath(chainConfig.configFileData.local.nodpath);
                            process.exec(cmd, async function (error, stdout, stderr, finish) {
                                if (error !== null) {
                                    logger.error("exccmd error:" + cmd);
                                    logger.error('exec error: ' + error);

                                    logMsg = utils.addLogStr(logMsg,"error:"+cmd);
                                    param.status = 0;
                                } else {
                                    logger.info("exccmd success:" + cmd);

                                    //启动nod
                                    result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), startinfo, chainConfig.localTest, chainConfig.nodPort);
                                    if (result == true) {
                                        logger.info("[seed restart]nod start success");
                                        logMsg = utils.addLogStr(logMsg, "nod start success");
                                        param.status = 1;
                                    } else {
                                        logger.error("[seed restart]node start error");
                                        logMsg = utils.addLogStr(logMsg, "nod start error");
                                        param.status = 0;
                                    }

                                }

                                //调用接口完成重启
                                param.result = logMsg;
                                await finsihRestart(param);

                            });


                        } else {
                            //调用接口完成重启
                            param.result = logMsg;
                        }
                    }
                }
            }

        } else {
            //nod 启动成功，结束
            logger.info("nod start success");
            logMsg = utils.addLogStr(logMsg, "nod start success");
            param.status = 1;
            param.result = logMsg;
            await finsihRestart(param);
        }

        //出现其他无法启动情况，在结束时保证标志位恢复
        syncChainChanging = false;
        monitor.enableDeploy();
    } catch (e) {
        logger.error("restartSeed error,e:",e);
        //调用接口完成重启
        param.result = logMsg;
        await finsihRestart(param);
    }
}

/**
 * 重启nod-mongo节点
 * @returns {Promise<void>}
 */
async function restartMongo() {
    logger.info("start to restart nod(mongo)");

    //标志位设置
    syncChainChanging = true;
    monitor.disableDeploy();


    let param = [];
    let logMsg = "";

    try {

        param = await monitor.buildParam();
        param.chainName = chainConfig.localChainName;
        param.startTime = new Date().getTime();
        param.status = 0;

        logger.info("[mongo restart]stop nod start");
        logMsg = utils.addLogStr(logMsg, "[mongo restart]stop nod start");
        //停止nod
        await NodFuture.stop(120000, chainConfig.nodPort);
        sleep.msleep(1000);
        logger.info("[mongo restart]stop nod finish");
        logMsg = utils.addLogStr(logMsg, "[mongo restart]stop nod finish");

        //执行脚本获取mongo中最大的块高
        let mongoMaxBlock = null;
        let mongoPath = "~/mongodb";
        let mongoDBPath = "~/mongodb";

        if (utils.isNotNull(chainConfig.configFileData.local.mongoPath)) {
            mongoPath = chainConfig.configFileData.local.mongoPath;
        }

        if (utils.isNotNull(chainConfig.configFileData.local.mongoDBPath)) {
            mongoDBPath = chainConfig.configFileData.local.mongoDBPath;
        }

        let mongoMaxBlockObj = await mongoUtil.getLocalMongoMaxBlock(2400000,mongoPath,mongoDBPath);
        if (mongoMaxBlockObj.code != 0 ) {
            logger.error("[mongo restart]mongoMaxBlock error:",mongoMaxBlockObj);
            logMsg = utils.addLogStr(logMsg, "mongoMaxBlock error:",JSON.stringify(mongoMaxBlockObj));
        } else {
            logger.info("[mongo restart]mongoMaxBlock correct:",mongoMaxBlockObj);
            logMsg = utils.addLogStr(logMsg, "mongoMaxBlock correct:",JSON.stringify(mongoMaxBlockObj));

            mongoMaxBlock = mongoMaxBlockObj.block_num;

            logger.info("[mongo restart]mongo mongoMaxBlock :",mongoMaxBlock);
            logMsg = utils.addLogStr(logMsg, "mongo mongoMaxBlock :"+mongoMaxBlock);

            //停止worldstate的程序
            result = await WorldState.stop(120000);
            if (result) {
                logger.info("[mongo restart]worldstate is stopped");
                logMsg = utils.addLogStr(logMsg, "[mongo restart]worldstate is stopped");
            } else {
                logger.info("[mongo restart]worldstate is not stopped");
                logMsg = utils.addLogStr(logMsg, "[mongo restart]worldstate is not stopped");
            }

            //通过chainid拿到seedList
            logger.info("[mongo restart] cur chain_name:",chainConfig.chainName, " localChainName:",chainConfig.localChainName);
            let seedIpInfo = await chainApi.getChainSeedIPByGroup(chainConfig.localChainName, chainConfig);
            if (utils.isNull(seedIpInfo)) {
                logger.info("[mongo restart] getChainSeedIPByGroup serach seedIpInfo is null try serach getChainSeedIP");
                seedIpInfo = await chainApi.getChainSeedIP(chainConfig.localChainName, chainConfig);
            }
            logger.info("[mongo restart]get chainid(" + chainConfig.localChainName + ")'s seed ip info:", seedIpInfo);
            if (utils.isNull(seedIpInfo)) {
                loggerChainChanging.error("[mongo restart]seed ip info is null");
                logMsg = utils.addLogStr(logMsg, "seed ip info is null(chainName:" + chainConfig.localChainName + ")");
            } else {
                logger.info("[mongo restart]start world state");
                result = await WorldState.start(chainConfig.localChainName, seedIpInfo, 60000, utils.formatHomePath(chainConfig.configFileData.local.wsspath), chainConfig.localTest, chainConfig);
                if (result == false) {
                    logger.info("[mongo restart]start ws error");
                    logMsg = utils.addLogStr(logMsg, "start ws error");
                } else {
                    logger.info("[mongo restart]start ws success");
                    logMsg = utils.addLogStr(logMsg, "start ws success");

                    //通过ws获取本地最大块信息
                    let localMaxBlockHeight = await WorldState.getLocalBlockInfo();
                    logger.info("[mongo restart]localMaxBlockHeight is:", localMaxBlockHeight);
                    if (utils.isNull(localMaxBlockHeight)) {
                        logMsg = utils.addLogStr(logMsg, "localMaxBlockHeight is null");
                    } else {
                        logMsg = utils.addLogStr(logMsg, "localMaxBlockHeight is " + localMaxBlockHeight);

                        //ws文件ready
                        let wsFileReady = false;

                        //世界状态文件
                        let wssFilePath = "";
                        let wssinfo = "";

                        let minNum = utils.calcMin(localMaxBlockHeight,mongoMaxBlock);
                        logger.info("[mongo restart]minNum is ",minNum);
                        logMsg = utils.addLogStr(logMsg, "minNum is "+minNum);

                        //调用表数据找到需要下载的世界状态文件信息
                        let wsTableData = await chainApi.getTableAllData(chainConfig.config, contractConstants.FUTUREIO, chainConfig.localChainName, tableConstants.WORLDSTATE_HASH, "block_num");
                        let wsResList = chainUtil.getNearestWsInfoByBlockHeight(wsTableData, minNum);
                        if (utils.isNull(wsResList) || wsResList.length <= 0) {
                            logger.error("[mongo restart]get ws info by block height is null");
                            logMsg = utils.addLogStr(logMsg, "get ws info by block height is null");
                        } else {
                            logger.info("[mongo restart]get ws info list by block height is ", wsResList);
                            logMsg = utils.addLogStr(logMsg, "[mongo restart]get ws info list by block height is "+wsResList);
                            for(var i = 0; i < wsResList.length; i++) {
                                //世界状态文件
                                wssFilePath = pathConstants.WSS_LOCAL_DATA + chainConfig.configSub.chainId + "-" + wsResList[i].block_num + ".ws";
                                wssinfo = "--worldstate " + wssFilePath + " --truncate-at-block " + localMaxBlockHeight+constants.CMD_HARDREPLAY_BLOCKS;

                                //从本地查找ws文件
                                if (fs.existsSync(wssFilePath) == true) {
                                    logger.info("[seed restart]ws file exists in local:" + wssFilePath);
                                    logMsg = utils.addLogStr(logMsg, "[seed restart]ws file exists in local:"+wssFilePath+")");
                                    wsFileReady = true;
                                    break;
                                } else {
                                    //本地不存在世界状态文件，需要通过ws拉取
                                    logger.error("[seed restart]ws file not exists in local:" + wssFilePath);
                                    logMsg = utils.addLogStr(logMsg, "[seed restart]ws file not exists in local:\"+wssFilePath)");

                                    wssFilePath = pathConstants.WSS_DATA + chainConfig.configSub.chainId + "-" + wsResList[i].block_num + ".ws";
                                    wssinfo = "--worldstate " + wssFilePath + " --truncate-at-block " + localMaxBlockHeight+constants.CMD_HARDREPLAY_BLOCKS;

                                    //通过seed拉取世界状态
                                    result = await WorldState.syncWorldState(wsResList[i].hash, wsResList[i].block_num, wsResList[i].file_size, chainConfig.configSub.chainId);
                                    if (result == false) {
                                        logger.error("sync worldstate request failed,block_num:",wsResList[i].block_num);
                                        logMsg = utils.addLogStr(logMsg, "[seed restart]sync worldstate request failed");
                                    } else {
                                        logger.info("sync worldstate request success,block_num:",wsResList[i].block_num);
                                        logMsg = utils.addLogStr(logMsg, "[seed restart]sync worldstate request success");

                                        loggerChainChanging.info("polling worldstate sync status ..")
                                        sleep.msleep(1000);

                                        /**
                                         * 轮询检查同步世界状态情况
                                         */
                                        result = await WorldState.pollingkWSState(1000, 1200000);
                                        if (result == false) {
                                            logMsg = utils.addLogStr(logMsg, "require ws error");
                                            logger.error("require ws error：" + wssinfo);
                                        } else {
                                            logger.info("require ws success");
                                            logMsg = utils.addLogStr(logMsg, "require ws success");
                                            logger.info("wssinfo:" + wssinfo);

                                            //检查文件是否下载成功
                                            if (fs.existsSync(wssFilePath) == false) {
                                                //下载失败
                                                logger.error("[mongo restart]file not exists :", wssFilePath);
                                                logger.info("[mongo restart]start nod not use wss:", wssinfo);
                                                logMsg = utils.addLogStr(logMsg, "file not exists :" + wssFilePath);
                                            } else {
                                                //下载成功
                                                logger.info("[mongo restart]file exists :", wssFilePath);
                                                logger.info("[mongo restart]start nod use wss:", wssinfo);
                                                logMsg = utils.addLogStr(logMsg, "file exists :" + wssFilePath + ", start nod use wss:" + wssinfo);
                                                wsFileReady = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            //世界状态文件确认存在
                            if (wsFileReady == true) {

                                //清除state目录
                                WorldState.clearStateDir();
                                logger.info("[seed restart]clear state dir");
                                logMsg = utils.addLogStr(logMsg, "clear state dir");

                                logMsg = utils.addLogStr(logMsg, "start nod :"+wssinfo);

                                //更新nod配置，增加
                                let resUpdateConfig = NodFuture.updateMongoStartNum(mongoMaxBlock);
                                if (resUpdateConfig == false) {
                                    logger.error("updateMongoStartNum error");
                                    utils.addLogStr(logMsg, "updateMongoStartNum error");
                                    param.result = logMsg;
                                    await finsihRestart(param);
                                    return;
                                } else {
                                    logger.info("updateMongoStartNum ",mongoMaxBlock);
                                    utils.addLogStr(logMsg, "updateMongoStartNum "+mongoMaxBlock);


                                    let cmd = "sync && cd " + utils.formatHomePath(chainConfig.configFileData.local.nodpath);
                                    process.exec(cmd, async function (error, stdout, stderr, finish) {
                                        if (error !== null) {
                                            logger.error("exccmd error:" + cmd);
                                            logger.error('exec error: ' + error);

                                            logMsg = utils.addLogStr(logMsg,"error:"+cmd);
                                            param.status = 0;
                                        } else {
                                            logger.info("exccmd success:" + cmd);

                                            //启动nod
                                            result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), wssinfo, chainConfig.localTest, chainConfig.nodPort);
                                            if (result == true) {
                                                logger.info("[mongo restart]nod start success");
                                                logMsg = utils.addLogStr(logMsg, "nod start success");
                                                param.status = 1;
                                            } else {
                                                logger.error("[mongo restart]node start error");
                                                logMsg = utils.addLogStr(logMsg, "nod start error");
                                                param.status = 0;
                                            }

                                        }

                                        //调用接口完成重启
                                        param.result = logMsg;
                                        await finsihRestart(param);
                                    });

                                }
                            }

                        }

                        //使用hard-replay方式启动,暂不允许该方式启动
                        if ( false ) { //(utils.isNotNull(localMaxBlockHeight) && wsFileReady == false) {
                            let startinfo = " --truncate-at-block "+localMaxBlockHeight+constants.CMD_HARDREPLAY_BLOCKS;
                            logger.info("[mongo restart] localMaxBlockHeight("+localMaxBlockHeight+") is not null,use hard-replay to start nod: "+startinfo);
                            logMsg = utils.addLogStr(logMsg, "[mongo restart] localMaxBlockHeight("+localMaxBlockHeight+") is not null,use hard-replay to start nod:"+startinfo);

                            //更新nod配置，增加
                            let resUpdateConfig = NodFuture.updateMongoStartNum(mongoMaxBlock);
                            if (resUpdateConfig == false) {
                                logger.error("updateMongoStartNum error");
                                utils.addLogStr(logMsg, "updateMongoStartNum error");

                                //调用接口完成重启
                                param.result = logMsg;
                                await finsihRestart(param);
                            } else {

                                logger.info("updateMongoStartNum ",mongoMaxBlock);
                                utils.addLogStr(logMsg, "updateMongoStartNum "+mongoMaxBlock);


                                let cmd = "sync && cd " + utils.formatHomePath(chainConfig.configFileData.local.nodpath);
                                process.exec(cmd, async function (error, stdout, stderr, finish) {
                                    if (error !== null) {
                                        logger.error("exccmd error:" + cmd);
                                        logger.error('exec error: ' + error);

                                        logMsg = utils.addLogStr(logMsg,"error:"+cmd);
                                        param.status = 0;
                                    } else {
                                        logger.info("exccmd success:" + cmd);

                                        //启动nod
                                        result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), startinfo, chainConfig.localTest, chainConfig.nodPort);
                                        if (result == true) {
                                            logger.info("[mongo restart]nod start success");
                                            logMsg = utils.addLogStr(logMsg, "nod start success");
                                            param.status = 1;
                                        } else {
                                            logger.error("[mongo restart]node start error");
                                            logMsg = utils.addLogStr(logMsg, "nod start error");
                                            param.status = 0;
                                        }

                                    }

                                    //调用接口完成重启
                                    param.result = logMsg;
                                    await finsihRestart(param);

                                });
                            }
                        }
                    }
                }
            }


        }
        //出现其他无法启动情况，在结束时保证标志位恢复
        syncChainChanging = false;
        monitor.enableDeploy();
    } catch (e) {
        logger.error("restartMongo error,e:",e);

        //调用接口完成重启
        param.status = 0;
        param.result = logMsg;
        await finsihRestart(param);
    }


}

/**
 *
 * @param param
 * @returns {Promise<void>}
 */
async function finsihSwitchChain(param) {
    //结束设置结束flag
    syncChainChanging = false;
    monitor.enableDeploy();
    param.endTime = new Date().getTime();
    param = monitor.generateSign(param);
    await chainApi.addSwitchLog(monitor.getMonitorUrl(),param);
}

/**
 *
 * @returns {Promise<void>}
 */
async function finsihRestart(param) {

    //调用接口完成重启
    param.endTime = new Date().getTime();
    param.log = nodLogData;
    await chainApi.addRestartLog(monitor.getMonitorUrl(), param);

    //标志位恢复
    syncChainChanging = false;
    monitor.enableDeploy();

    logger.info("finish restart");
}

/**
 * 重启nod-矿工节点
 * @returns {Promise<void>}
 */
async function restartNodProducer() {

    //标志位设置
    syncChainChanging = true;
    monitor.disableDeploy();


    logger.info("start to restart nod(producer)");
    let param = [];
    let logMsg = "";
    try {

        let wssinfo = " ";
        let wssFilePath = " ";
        param = await monitor.buildParam();
        param.chainName = chainConfig.localChainName;
        param.startTime = new Date().getTime();
        //使用world state to recover
        if (chainConfig.configFileData.local.worldstate == true && chainConfig.isNoneProducer() == false) {

            logger.info("world state is on("+chainConfig.configFileData.local.worldstate+") && this nod is not none-producer("+chainConfig.configFileData.target["is-non-producing-node"]+") ,need  use ws to recover",);
            logMsg = utils.addLogStr(logMsg,"world state is on("+chainConfig.configFileData.local.worldstate+") && this nod is not none-producer("+chainConfig.configFileData.target["is-non-producing-node"]+") ,need  use ws to recover");

            //停止worldstate的程序
            if (chainConfig.configFileData.local.worldstate == true) {
                result = await WorldState.stop(120000);
                if (result) {
                    logger.info("worldstate is stopped");
                    logMsg = utils.addLogStr(logMsg,"worldstate is stopped");
                } else {
                    logger.info("worldstate is not stopped");
                    logMsg = utils.addLogStr(logMsg,"worldstate is not stopped");
                }
            }

            //通过chainid拿到seedList
            logger.info("[restartNodProducer] cur chain_name:",chainConfig.chainName, " localChainName:",chainConfig.localChainName);
            let seedIpInfo = await chainApi.getChainSeedIPByGroup(chainConfig.localChainName, chainConfig);
            if (utils.isNull(seedIpInfo)) {
                logger.info("[restartNodProducer] getChainSeedIPByGroup serach seedIpInfo is null try serach getChainSeedIP");
                seedIpInfo = await chainApi.getChainSeedIP(chainConfig.localChainName, chainConfig);
            }
            logger.info("get chainid(" + chainConfig.localChainName + ")'s seed ip info:", seedIpInfo);
            let wsStarted = true;
            if (utils.isNull(seedIpInfo)) {
                loggerChainChanging.error("seed ip info is null");
                logMsg = utils.addLogStr(logMsg,"seed ip info is null(chainName:"+chainConfig.localChainName+")");
            } else {
                logger.info("start world state");
                result = await WorldState.start(chainConfig.localChainName, seedIpInfo, 120000, utils.formatHomePath(chainConfig.configFileData.local.wsspath), chainConfig.localTest,chainConfig);
                if (result == true) {
                    logger.info("start ws success");
                    logger.info("world state is on , use world state to revocer");
                    logMsg = utils.addLogStr(logMsg,"start ws success");
                } else {
                    logger.info("start ws error");
                    logger.info("world state is off");
                    logMsg = utils.addLogStr(logMsg,"start ws error");
                    wsStarted = false;
                }
            }

            if (wsStarted == true) {
                //调用世界状态程序同步数据
                var worldstatedata = null;
                let maxBlockHeight = 0;
                let mainChainData = await chainApi.getTableAllData(chainConfig.config, contractConstants.FUTUREIO, chainConfig.localChainName, tableConstants.WORLDSTATE_HASH, "block_num");
                if (utils.isNotNull(mainChainData) && mainChainData.rows.length > 0) {
                    //worldstatedata = mainChainData.rows[mainChainData.rows.length - 1];
                    worldstatelist = chainUtil.getValidWorldStateList(mainChainData.rows);
                    logger.info("get worldstate data:", worldstatelist);
                    if (worldstatelist.length > 0) {
                        maxBlockHeight = worldstatelist[0].block_num;
                    }
                } else {
                    logger.error("can not get world state file,or data is null");
                    logMsg = utils.addLogStr(logMsg,"can not get world state file,or data is null");
                }

                //查看本地ws最大文件
                let localHashIsMax = false;
                if (utils.isNotNull(WorldState.status)) {
                    logger.info("local ws status:", WorldState.status);
                    logger.info("local ws max block heght(" + WorldState.status.block_height + "),mainchain max block height(" + maxBlockHeight + ")")

                    logMsg = utils.addLogStr(logMsg,"local ws max block heght(" + WorldState.status.block_height + "),mainchain max block height(" + maxBlockHeight + ")");
                    if ((WorldState.status.block_height + 5000) >= maxBlockHeight) {
                        logger.info("block height is equal, check ws file");
                        logMsg = utils.addLogStr(logMsg,"block height is equal, check ws file");
                        wssFilePath = pathConstants.WSS_LOCAL_DATA + chainConfig.configSub.chainId + "-" + WorldState.status.block_height + ".ws";
                        logger.info("file path:", wssFilePath);
                        if (fs.existsSync(wssFilePath)) {
                            logger.info("file path exists:", wssFilePath);
                            logMsg = utils.addLogStr(logMsg,"file path  exists:", wssFilePath);
                            wssinfo = "--worldstate " + pathConstants.WSS_LOCAL_DATA + chainConfig.configSub.chainId + "-" + WorldState.status.block_height + ".ws";
                            localHashIsMax = true;
                        } else {
                            logger.info("file path not exists:", wssFilePath);
                            logMsg = utils.addLogStr(logMsg,"file path not exists:", wssFilePath);

                        }
                    } else {
                        logger.info("block height is not equal,not use local ws file to start");
                        logMsg = utils.addLogStr(logMsg,"block height is not equal,not use local ws file to start");
                    }
                } else {
                    logger.info("local ws status is null");
                    logMsg = utils.addLogStr(logMsg,"local ws status is null");
                }

                //本地没有较新的，依次拉取最新的
                if (localHashIsMax == false && worldstatelist.length > 0) {
                    sleep.msleep(1000);
                    logger.info("start to require ws:");
                    let blockNum = 0;
                    for(var i = 0; i < worldstatelist.length; i++) {
                        let hash = worldstatelist[i].hash_v[0].hash;
                        blockNum = worldstatelist[i].block_num;
                        let filesize = worldstatelist[i].hash_v[0].file_size;
                        logger.info("start to require ws : (block num : " + blockNum + " " + "hash:" + hash);
                        result = await WorldState.syncWorldState(hash, blockNum, filesize, chainConfig.configSub.chainId);
                        if (result == true) {
                            logger.info("sync worldstate request success");
                        } else {
                            logger.info("sync worldstate request failed");
                        }

                        loggerChainChanging.info("polling worldstate sync status ..")

                        sleep.msleep(1000);

                        /**
                         * 轮询检查同步世界状态情况
                         */
                        wssFilePath = pathConstants.WSS_DATA + chainConfig.configSub.chainId + "-" + blockNum + ".ws";
                        wssinfo = "--worldstate " + pathConstants.WSS_DATA + chainConfig.configSub.chainId + "-" + blockNum + ".ws";

                        result = await WorldState.pollingkWSState(1000, 1200000);
                        if (result == false) {
                            logMsg = utils.addLogStr(logMsg,"require ws error");
                            logger.error("require ws error：" + wssinfo);
                            wssinfo = " ";
                            wssFilePath = " ";
                        } else {
                            logger.info("require ws success");
                            logger.info("wssinfo:" + wssinfo);
                            //check file exist
                            if (fs.existsSync(wssFilePath)) {
                                logger.info("file exists :", wssFilePath);
                                break;
                            } else {
                                logger.error("file not exists :", wssFilePath)
                            }
                        }
                    }
                    sleep.msleep(1000);

                    //判断配置是否需要拉块
                    if (chainConfig.configFileData.local.wsSyncBlock == true) {
                        logger.info("wsSyncBlock is true，need sync block");
                        /**
                         * 调用block
                         */
                        logger.info("start to sync block:(chainid:" + chainConfig.configSub.chainId + ",block num:" + blockNum);
                        result = await WorldState.syncBlocks(chainConfig.configSub.chainId, blockNum);
                        if (result == false) {
                            logger.info("sync block request error");
                        } else {
                            logger.info("sync block request success");
                        }

                        sleep.msleep(1000);

                        /**
                         * 轮询检查同步世界状态情况block
                         */
                        logger.info("pollingBlockState start...");
                        result = await WorldState.pollingBlockState(1000, 300000);
                        if (result == false) {
                            logger.info("require block error");
                        } else {
                            logger.info("require block success");
                        }

                        sleep.msleep(1000);

                    } else {
                        logger.info("wsSyncBlock is false，need not sync block");
                        sleep.msleep(3000);
                    }
                }

            }
        } else {

            logger.info("world state may be off("+chainConfig.configFileData.local.worldstate+") || this nod is none-producer("+chainConfig.configFileData.target["is-non-producing-node"]+") ,need not use ws to recover",);

            logMsg = utils.addLogStr(logMsg,"world state may be off("+chainConfig.configFileData.local.worldstate+") || this nod is none-producer("+chainConfig.configFileData.target["is-non-producing-node"]+") ,need not use ws to recover");
        }

        //启动nod
        await NodFuture.stop(120000,chainConfig.nodPort);
        let randomValue = Math.ceil(Math.random()*20) + 5;  //5-25s 随机区间启动
        sleep.msleep(1000 * randomValue);
        logger.info("clear Nod DB data before restart it.. start randomValue:", randomValue);
        logMsg = utils.addLogStr(logMsg,"clear Nod DB data");
        await NodFuture.removeData();

        // if (chainConfig.configFileData.local.worldstate == true) {
        //     await WorldState.clearDB();
        // }

        //check file exist
        if (fs.existsSync(wssFilePath)) {
            logger.info("file exists :", wssFilePath);
            logger.info("start nod use wss:", wssinfo);
            logMsg = utils.addLogStr(logMsg,"file exists :"+wssFilePath+", start nod use wss:"+wssinfo);
        } else {
            logger.error("file not exists :", wssFilePath);
            logger.info("start nod not use wss:", wssinfo);
            logMsg = utils.addLogStr(logMsg,"file not exists :"+wssFilePath+", start nod not use wss:");
            wssinfo = " "
        }


        let cmd = "sync && cd " + utils.formatHomePath(chainConfig.configFileData.local.nodpath);
        process.exec(cmd, async function (error, stdout, stderr, finish) {
            if (error !== null) {
                logger.error("exccmd error:" + cmd);
                logger.error('exec error: ' + error);

                logMsg = utils.addLogStr(logMsg,"error:"+cmd);
                param.status = 0;
            } else {
                logger.info("exccmd success:" + cmd);

                //启动nod
                result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), wssinfo, chainConfig.localTest,chainConfig.nodPort);
                if (result == true) {
                    logger.info("nod start success");
                    logMsg = utils.addLogStr(logMsg,"nod start success");
                } else {
                    logger.error("node start error");
                    logMsg = utils.addLogStr(logMsg,"nod start error");
                }

                param.status = 1;
            }

            param.result = logMsg;
            await finsihRestart(param);

        });
        //出现其他无法启动情况，在结束时保证标志位恢复
        syncChainChanging = false;
        monitor.enableDeploy();
    } catch (e) {
        param.status = 0;
        param.result = logMsg;
        await finsihRestart(param);
    }

}

/**
 * 是否是主链
 * @returns {Promise<boolean>}
 */
function isMainChain() {
    return chainNameConstants.MAIN_CHAIN_NAME == chainConfig.localChainName;
}

/**
 * 同步世界状态
 * @returns {Promise<void>}
 */
async function syncWorldState() {

    try {

        await WorldState.syncStatus();
        monitor.setHashInfo(WorldState.status.block_height, WorldState.status.hash_string)

        if (chainConfig.configFileData.local.worldstate == false) {
            logger.info("syncWorldState is disabled");
            return;
        }
        logger.info("syncWorldState start");

        if (syncChainData == true) {
            let vaildMaxWSNum = 0;
            try {
                //同步状态
                logger.info("WorldState.status:", WorldState.status);
                logger.info("WorldState.status chain_id:", WorldState.status.chain_id);
                if (utils.isNotNull(WorldState.status) && utils.isNotNull(WorldState.status.chain_id) && WorldState.status.chain_id != chainIdConstants.NONE_CHAIN) {
                    logger.info("WorldState.status not null");
                    //调用主链查询当前已同步的块高
                    //let mainChainData = await chainApi.getTableInfo(chainConfig.config, contractConstants.FUTUREIO, chainConfig.chainName, tableConstants.WORLDSTATE_HASH,1000,null,null,null);
                    let mainChainData = await chainApi.getTableAllData(chainConfig.config, contractConstants.FUTUREIO, chainConfig.localChainName, tableConstants.WORLDSTATE_HASH, "block_num");

                    logger.error("mainChainData:", mainChainData);
                    let needUpload = true;
                    if (utils.isNotNull(mainChainData) && mainChainData.rows.length > 0) {
                        logger.debug("mainChainData:", mainChainData);
                        let worldstatedata = chainUtil.getMaxValidWorldState(mainChainData.rows);
                        if (worldstatedata != null) {
                            vaildMaxWSNum = worldstatedata.block_num;
                            logger.info("main chain's world state (main chain block num :" + worldstatedata.block_num + " subchain node block num :" + WorldState.status.block_height + ")");
                            if (worldstatedata.block_num >= WorldState.status.block_height) {
                                logger.info("main chain's world state is newest,need not upload:(main chain block num :" + worldstatedata.block_num + " subchain node block num :" + WorldState.status.block_height + ")");
                                needUpload = false;
                            }
                        }
                    } else {
                        logger.info("main chain's world state is null,need upload");
                        needUpload = true;
                    }
                    //需要上传
                    if (needUpload) {
                        let params = {
                            subchain: chainConfig.localChainName,
                            blocknum: WorldState.status.block_height,
                            hash: WorldState.status.hash_string,
                            file_size: WorldState.status.file_size
                        }

                        logger.info("reportsubchainhash params:", params," committeelength:",chainConfig.myAccountAsCommitteeList.length);
                        for(let k =0; k < chainConfig.myAccountAsCommitteeList.length; k++ ) {
                            let result = await chainApi.contractInteract(chainConfig.config, contractConstants.FUTUREIO, "reportsubchainhash", params, chainConfig.myAccountAsCommitteeList[k], chainConfig.mySkAsAccountList[k]);
                            logger.info("upload ws hash to main chain producer:",chainConfig.myAccountAsCommitteeList[k]," result:" + result);
                        }
                    }
                } else {
                    logger.info("local world state is none ,need not upload");
                }

                /**
                 *
                 */
                if (vaildMaxWSNum > 0) {
                    logger.info("vaildMaxWSNum is " + vaildMaxWSNum + ", need set wss..");
                    await WorldState.setValidWs(vaildMaxWSNum);
                } else {
                    logger.info("vaildMaxWSNum is " + vaildMaxWSNum + ", need not set wss..");
                }

            } catch (e) {
                logger.error("syncWorldState error:", e);
            }
        } else {
            logger.info("syncWorldState not need:", syncChainData);
        }

        logger.info("syncWorldState end");

    } catch (e) {
        logger.error("syncWorldState error:", e);
    }
}

/**
 * 查询链上达成有效merkle最大块高
 * @returns {Promise<void>}
 */
async function getValidBlockNum() {
    try {
        let chainWssBlockData = await chainApi.getTableAllData(chainConfig.configSub, contractConstants.FUTUREIO, scopeConstants.SCOPE_WSS_HASH, tableConstants.WORLDSTATE_HASH, "block_num");
        if (utils.isNotNull(chainWssBlockData) && chainWssBlockData.rows.length > 0) {
            for (let i = chainWssBlockData.rows.length - 1; i >= 0; i--) {
                let obj = chainWssBlockData.rows[i];
                for (let t = 0; t < obj.hash_v.length; t++) {
                    if (obj.hash_v[t].valid == 1) {
                        return obj.block_num;
                    }
                }
            }
        }
    } catch (error) {
        logger.error("getValidBlockNum error :", error);
    }
    return 0;
}

/**
 * 读取配置调用合约
 * @returns {Promise<void>}
 */
async function readWssInvokeContract( blockNum ) {
    try {
        if( blockNum <= 100 ) {
            logger.info("readWssInvokeContract blockNum too small :",blockNum);
            return false;
        }
        if( voteBlockWssBlockNum == blockNum ) {
            logger.info("readWssInvokeContract blockNum is already vote blockmerkle :",blockNum);
        }
        let blockWssFilePath = chainConfig.chainId + "-" + blockNum + ".merkle";
        let fullFilePath = pathConstants.WSS_BLOCKMERKLE_PATH + blockWssFilePath;
        if (fs.existsSync(fullFilePath)) {
            logger.info("readWssInvokeContract file exists :",fullFilePath);
            let wshashData = JSON.parse(fs.readFileSync(fullFilePath, 'utf-8'));
            logger.debug("readWssInvokeContract file wshashData :",wshashData);
            if ( utils.isNotNull(wshashData) ) {
                if ( wshashData.isValid == true ) {
                    let params = {
                        blocknum: wshashData.block_num,
                        hash: wshashData.merkle
                    }
                    logger.info("reportblockwshash params:", params," committeelength:",chainConfig.myAccountAsCommitteeList.length);
                    for(let k =0; k < chainConfig.myAccountAsCommitteeList.length; k++ ) {
                        let result = await chainApi.contractInteract(chainConfig.configSub, contractConstants.FUTUREIO, "reportblockwshash", params, chainConfig.myAccountAsCommitteeList[k], chainConfig.mySkAsAccountList[k]);
                        logger.info("readWssInvokeContract upload block ws merkle chain producer:",chainConfig.myAccountAsCommitteeList[k]," result:" + result);
                        if( result != null ) {
                            voteBlockWssBlockNum = wshashData.block_num;
                        }
                    }
                }
            }
        } else {
            logger.error("readWssInvokeContract file not exists :",fullFilePath)
            return false;
        }
    } catch (error) {
        logger.error("readWssInvokeContract file not exists :",fullFilePath)
        return  false;
    }

    return true;
}
/**
 * 上报块merkle hash
 * @returns {Promise<void>}
 */
async function reportBlockWsHash() {

    try {
        //非出块节点不上报
        if ( chainConfig.isNoneProducer() == true ) {
            return;
        }
        logger.info("reportBlockWsHash start,serachBlockMerkleVoteCnt:",serachBlockMerkleVoteCnt);
        if ( serachBlockMerkleVoteCnt >= 3 ) {
            serachBlockMerkleVoteCnt = 0;
            //查询链上已投票的最新有效块
            let maxValidBlockNum = await getValidBlockNum();
            //查询链上需要投票的块高
            let blockMaxNum = await chainApi.getChainMaxBlockNum( chainConfig.configSub );
            let invokeMerkleBlock = blockMaxNum - blockMaxNum%100;
            if ( maxValidBlockNum != invokeMerkleBlock ) {
                logger.info("reportBlockWsHash merkle vote block maxValidBlockNum:",maxValidBlockNum," should vote blockMaxNum:",blockMaxNum);
                await readWssInvokeContract( invokeMerkleBlock );
                if( maxValidBlockNum > 100 && (maxValidBlockNum + 100) != invokeMerkleBlock ) {//this action almost not happened
                    logger.error("reportBlockWsHash maxValidBlockNum and blockMaxNum should subtract 100, maxValidBlockNum:",maxValidBlockNum," should vote blockMaxNum:",blockMaxNum);
                    await readWssInvokeContract( maxValidBlockNum + 100 );
                }
            }//如果相等不需要投票
            logger.info("reportBlockWsHash end maxValidBlockNum:",maxValidBlockNum," invokeMerkleBlock:",invokeMerkleBlock);
        }
        serachBlockMerkleVoteCnt++;
    } catch (e) {
        logger.error("reportBlockWsHash error:", e);
    }
}

/**
 * 设置检查睡眠时间戳
 */
async function setCheckSleepTimestamp( currentTime ) {
    try {
        logger.info("checkSleepStatusTimer setCheckSleepTimestamp start currentTime:", currentTime);
        let fullFilePath = pathConstants.LAST_CHECK_SLEEP_PATH;
        let obj = {
            timestamp: currentTime
        }
        fs.writeFileSync(fullFilePath, JSON.stringify(obj));
        logger.info("checkSleepStatusTimer setCheckSleepTimestamp end");
    } catch (error) {
        logger.info("checkSleepStatusTimer setCheckSleepTimestamp error:", error);
    }
}

/**
 * 获取状态检查睡眠时间戳
 */
async function getCheckSleepTimestamp() {
    try {
        logger.info("checkSleepStatusTimer getCheckSleepTimestamp LAST_CHECK_SLEEP_PATH:", pathConstants.LAST_CHECK_SLEEP_PATH);
        let fullFilePath = pathConstants.LAST_CHECK_SLEEP_PATH;
        if (fs.existsSync(fullFilePath)) {
            let sleepTimeData = JSON.parse(fs.readFileSync(fullFilePath, 'utf-8'));
            logger.info("checkSleepStatusTimer getCheckSleepTimestamp sleepTimeData :",sleepTimeData);
            if ( utils.isNotNull(sleepTimeData) && utils.isNotNull(sleepTimeData.timestamp) ) {
                return sleepTimeData.timestamp;
            }
        }
    } catch (error) {
        logger.info("checkSleepStatusTimer getCheckSleepTimestamp error:", error);
    }
    return null;
}

/**
 * 检查服务器是否是睡眠状态
 */
async function checkSleepStatusTimer() {
    try {
        const currentTime = new Date().getTime();
        let lastCheckSleepStatusTime = await getCheckSleepTimestamp();
        await setCheckSleepTimestamp( currentTime );
        if( utils.isNull( lastCheckSleepStatusTime ) ) {
            logger.info("checkSleepStatusTimer getCheckSleepTimestamp lastCheckSleepStatusTime :",lastCheckSleepStatusTime);
            return;
        }
        const exceedSleepTime = lastCheckSleepStatusTime + chainConfig.configFileData.local.maxServerSleepTimeMs;
        logger.info("checkSleepStatusTimer start currentTime:", currentTime, " exceedSleepTime:", exceedSleepTime);
        if( exceedSleepTime < currentTime ) {
            //重启node
            logger.info("checkSleepStatusTimer checked sleep status need restart nod currentTime:", currentTime);
            clearRestartCount();
            await restartNod();
            logger.info("checkSleepStatusTimer nod restart end..");
            //重启管家
            let cmd = "pm2 restart sideChainService";
            logger.info("checkSleepStatusTimer need to restart futuremng..");
            process.exec(cmd, async function (error, stdout, stderr, finish,cmd) {
                if (error !== null) {
                    logger.error('checkSleepStatusTimer pm2 restart sideChainService exec error: ' + error);
                } else {
                    logger.info("checkSleepStatusTimer exec success :",cmd);
                }
            });
        }
        logger.info("checkSleepStatusTimer end");
    } catch (error) {
        logger.info("checkSleepStatusTimer error:", error);
    }
}

module.exports = {
    syncBlock,
    syncChainInfo,
    syncWorldState,
    clearCache,
    syncCommitee,
    checkNodProcess,
    reportBlockWsHash,
    checkSleepStatusTimer,
    producerHeartBeat,
}
