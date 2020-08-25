var logger = require("../config/logConfig").getLogger("chainSyncService");
var chainConfig = require("./chainConfig")
var chainApi = require("./chainApi")
var constants = require("../common/constant/constants")
var chainNameConstants = require("../common/constant/constants").chainNameConstants
var contractConstants = require("../common/constant/constants").contractConstants
var pathConstants = require("../common/constant/constants").pathConstants
var utils = require("../common/util/utils")
var chainUtil = require("./util/chainUtil");
var monitor = require("./monitor")
var CacheObj = require("../common/cache/cacheObj");

/**
 * 块高缓存
 * @type {CacheObj}
 */
var blockCache = new CacheObj(true, pathConstants.SYNC_SERVICES_PATH);

/**
 * trx cache
 * @type {CacheObj}
 */
var trxCache = new CacheObj(false, null);

/**
 * 已执行块高
 * @type {CacheObj}
 */
var blockExeCache = new CacheObj(false, null);

/**
 * hash缓存过期时间（5分钟）
 * @type {number}
 */
var HASH_EXPIRE_TIME_MS = 1000 * 60 * 5;

//单次同步最大的块数
var syncServiceBlockNum = 20;

//单次同步最大的失败块数
var syncFailBlockNum = 20;

/**
 * 失败列表
 * @type {Array}
 */
var failedMainTranIndex = 0;
var failedSubchainTranIndex=0;


/**
 * start entry
 * @returns {Promise<void>}
 */
async function start() {
    logger.info("chainSyncService start...");

    if (chainConfig.configFileData.local.uploadSyncService != true) {
        logger.error("uploadSyncService is not enabled");
        return;
    }

    try {



        if (chainConfig.isMainChain() == true) {
            logger.info("chainSyncService need not work in main chain");
        } else {

            //获取子链已经处理过的块高
            let subchainSyncBlock = await getProcessedBlock(chainConfig.localChainName,chainNameConstants.MAIN_CHAIN_NAME);
            logger.info("subchainSyncBlock: ",subchainSyncBlock);


            //获取主链已经处理过的块高
            let mainchainSyncBlock = await getProcessedBlock(chainNameConstants.MAIN_CHAIN_NAME,chainConfig.localChainName);
            logger.info("mainchainSyncBlock: ",mainchainSyncBlock);

            /**
             * 判断是否为空
             */
            if (subchainSyncBlock < 0 || mainchainSyncBlock < 0) {
                logger.error("subchainSyncBlock("+subchainSyncBlock+") or mainchainSyncBlock("+mainchainSyncBlock+") is null");
            } else {

                //block sync
                logger.info("subchainSyncBlock("+subchainSyncBlock+") or mainchainSyncBlock("+mainchainSyncBlock+") is right");

                //同步confrim block
                await syncConfirmBlock();

                //子链块
                let newBlockIndex = await inspectBlockHeader(parseInt(subchainSyncBlock),false,chainConfig.localChainName,chainNameConstants.MAIN_CHAIN_NAME);
                await updateProcessedBlock(chainConfig.localChainName,chainNameConstants.MAIN_CHAIN_NAME,newBlockIndex);

                //错误列表执行
                reExecuteFailList(chainConfig.localChainName,chainNameConstants.MAIN_CHAIN_NAME);

                //主链块
                newBlockIndex = await inspectBlockHeader(parseInt(mainchainSyncBlock),true,chainNameConstants.MAIN_CHAIN_NAME,chainConfig.localChainName);
                await updateProcessedBlock(chainNameConstants.MAIN_CHAIN_NAME,chainConfig.localChainName,newBlockIndex);

                //错误列表执行
                reExecuteFailList(chainNameConstants.MAIN_CHAIN_NAME,chainConfig.localChainName);
            }

        }

    } catch (e) {
        logger.error("chainSyncService exec error:",e);
    }

    logger.info("chainSyncService end...");
}

/**
 * 获取已经处理的最大块高
 * @returns {Promise<void>}
 */
async function getProcessedBlock(baseChain,targetChain) {

    let blockNum = -1;
    logger.info("start to find chain("+baseChain+")'s process block in chain("+targetChain+")");
    try {
        var key = baseChain+"-"+targetChain;

        let value = blockCache.get(key);
        if (utils.isNull(value)) {
            logger.error("start to find chain("+baseChain+")'s process block in chain("+targetChain+")，find it in monitor...");
            let param = {
                "baseChain": baseChain,
                "targetChain": targetChain,
                "confirmBlock" : "-1"
            }
            let res = await chainApi.getSyncBlock(monitor.getMonitorUrl(),monitor.generateSign(param));
            if (utils.isNotNull(res.data.confirmBlock)) {
                blockNum = parseInt(res.data.confirmBlock);
            }
        } else {
            blockNum = parseInt(value);
        }

    } catch (e) {
        logger.error("getProcessedBlock error:",e);
    }

    return blockNum;
}

/**
 *
 * @param baseChain
 * @param tagetChain
 * @returns {Promise<void>}
 */
async function reExecuteFailList(baseChain, targetChain) {
    try {

        let pageBaseIndex = 0;
        let isMainchain = false;
        if (baseChain == chainNameConstants.MAIN_CHAIN_NAME) {
            isMainchain = true;
            pageBaseIndex = failedMainTranIndex;
        } else {
            pageBaseIndex = failedSubchainTranIndex;
        }
        logger.info("start to reExecute failed list(basechain: "+baseChain+" targetChain: "+targetChain+")");
        let param = {
            baseChain : baseChain,
            targetChain : targetChain,
            pageIndex : pageBaseIndex,
            pageSize : syncFailBlockNum,
            status : 0,
        }
        let res = await chainApi.getFailedTranList(monitor.getMonitorUrl(),monitor.generateSign(param));
        let failList = res.data.list;
        let totalCount = res.data.total;
        let padeIndex = res.data.pageIndex;
        let totalPage = res.data.totalPage;
        logger.info("failed list(basechain: "+baseChain+" targetChain: "+targetChain+") list lenght:",failList.length);

        if (failList.length >= 0) {
            let executedTranList = "";
            let cacheCount =0;
            for (let t=0; t<failList.length;t++) {
                let tran = failList[t];
                let tranId = tran.tranId;
                let blockHeight = tran.blockHeight;
                let executed = await checkTranExecuted(tranId, blockHeight, isMainchain);
                if (executed  == true) {
                    if (executedTranList == "") {
                        executedTranList = tranId;
                    }  else {
                        executedTranList = executedTranList + ","+tranId;
                    }
                    cacheCount++;
                } else {
                    //需要重新执行的交易信息
                    let trans = [];
                    let tran = {
                        trx : {
                            id : tranId
                        },
                    }
                    trans.push(tran);
                    let res = await  processTrans(trans,blockHeight,isMainchain);
                }
            }

            if (executedTranList != "") {
                let param = {tranIdList:executedTranList};
                let res = await chainApi.finishFailedTranList(monitor.getMonitorUrl(),monitor.generateSign(param));
                logger.info("finishFailedTranList result:",res);
                //如果上传monitor失败，默认cachecount为0
                if (res.code != 0) {
                    cacheCount = 0;
                }
            }

            if (totalPage == 0 && failList.length == 0) {
                logger.info("chain("+baseChain+") totalPage and faillist ==0 ,set to 0");
                pageBaseIndex = 0;
            }  else {
                //如果超过一半都执行了，不需要跳，否则跳
                if (cacheCount > failList.length / 2) {
                    logger.info("chain(" + baseChain + ") pageindex(" + pageBaseIndex + ") execute failed list > 1/2,need not move to next page index");
                } else {
                    logger.info("chain(" + baseChain + ") pageindex(" + pageBaseIndex + ") execute failed list <= 1/2,need move to next page index");
                    //move to next
                    if (pageBaseIndex < totalPage - 1) {
                        pageBaseIndex++;
                    } else {
                        pageBaseIndex = 0;
                    }

                    logger.info("chain(" + baseChain + ") new pageindex is (" + pageBaseIndex + ")");
                }
            }

            //更新pageindex
            if (isMainchain) {
                failedMainTranIndex = pageBaseIndex;
            } else {
                failedSubchainTranIndex = pageBaseIndex;
            }
        }

    } catch (e) {
        logger.error("reExecuteFailList error:",e);
    }
}

/**
 * 更新处理的最大块高
 * @returns {Promise<void>}
 */
async function updateProcessedBlock(baseChain,targetChain,blockNum) {

    //数据校验
    if (blockNum < 0) {
        logger.error("Can't update chain("+baseChain+")'s process block in chain("+targetChain+") by blockNum:",blockNum);
        return;
    }

    let previousBlockNum = -1;
    logger.info("start to update chain("+baseChain+")'s process block in chain("+targetChain+")");
    try {
        var key = baseChain+"-"+targetChain;

        let value = blockCache.get(key);
        if (utils.isNull(value)) {
            logger.error("start to find chain("+baseChain+")'s process block in chain("+targetChain+")，find it in monitor...");
            let param = {
                "baseChain": baseChain,
                "targetChain": targetChain,
                "confirmBlock" : "-1"
            }
            try {
                let res = await chainApi.getSyncBlock(monitor.getMonitorUrl(),monitor.generateSign(param));
                if (utils.isNotNull(res.data.confirmBlock)) {
                    previousBlockNum = res.data.confirmBlock;
                }
            } catch (e) {
                logger.error("chainApi.getSyncBlock error:",e);
            }

        } else {
            previousBlockNum = parseInt(value);
        }

        logger.info("chain("+baseChain+")'s process block in chain("+targetChain+") previous confrim block is :"+previousBlockNum);

        if (blockNum > previousBlockNum) {
            logger.info("update chain("+baseChain+")'s process block in chain("+targetChain+") to  :"+blockNum);

            /**
             * update
             */
            blockCache.put(key,blockNum,-1);
            //更新monitor
            let res = await chainApi.updateSyncBlock(monitor.getMonitorUrl(),monitor.generateSign({
                "baseChain": baseChain,
                "targetChain": targetChain,
                "confirmBlock" : blockNum.toString()
            }));
        }

    } catch (e) {
        logger.error("getProcessedBlock error:",e);
    }

    return blockNum;
}

/**
 * 检查块
 * @param startBlockNum
 * @param isMainchain
 * @param subchainName
 * @returns {Promise<void>}
 */
async function inspectBlockHeader(startBlockNum, isMainchain, chainName,targetChain) {

    let blockIndex = -1;
    let successBlock = -1;

    try {

        //单次最多同步多少个块
        let blockSyncMaxNum = chainConfig.getLocalConfigInfo("syncServiceBlockNum", syncServiceBlockNum);

        //获取该链在目标链已同步的块
        let confirmBlock = isMainchain == true ? monitor.getConfirmBlockMaster() : monitor.getConfirmBlockLocal();

        //当前块高必须 < 已确认的块高
        if (startBlockNum >= confirmBlock) {
            logger.info("chain(" + chainName + ") startblock(" + startBlockNum + ") >= confrimBlock(" + confirmBlock + "), need not work");
            return;
        }

        //块高区间
        var traceBlcokCount = confirmBlock - startBlockNum;
        let endBlockNum = confirmBlock;
        if (traceBlcokCount >= blockSyncMaxNum) {
            endBlockNum = startBlockNum + blockSyncMaxNum;
        }

        logger.info("check chain("+chainName+") trans between(" + startBlockNum + "-" + endBlockNum + ")");

        blockIndex = startBlockNum + 1;

        /**
         * 遍历每一个块内的所有交易
         */
        while (blockIndex <= endBlockNum) {
            let blockObj = null;
            //主链块
            if (isMainchain == true) {
                blockObj = await chainApi.getBlockInfoData(chainConfig.config.httpEndpoint, (blockIndex).toString());
            } else {
                //子链块
                blockObj = await chainApi.getBlockInfoData(chainConfig.getLocalHttpEndpoint(), (blockIndex).toString());
            }

            //块数据
            if (blockObj == null) {
                logger.error("chain(" + chainName + ")'s block(" + blockIndex + ") is null, need break");
                break;
            }

            //获取块中的所有交易
            logger.debug("blockObj : ", blockObj);
            let trans = blockObj.transactions;
            logger.info("chain(" + chainName + ") block(" + blockIndex + ") trans count: ", trans.length);

            //过滤交易中需要的交易
            let finalTrans = await filterTrans(trans,chainName,targetChain);
            logger.info("chain(" + chainName + ") block(" + blockIndex + ") filterTrans count: ", finalTrans.length);

            //处理所有交易
            let exeResult = await processTrans(finalTrans,blockIndex,isMainchain);

            if (exeResult == true) {
                logger.info("chain(" + chainName + ") block(" + blockIndex + ") exec tran success");
                successBlock = blockIndex;
            } else {
                logger.error("chain(" + chainName + ") block(" + blockIndex + ") exec tran failed");
                break;
            }

            //累加
            blockIndex = blockIndex + 1;
        }

        //更新sync block数据
        logger.info("chain(" + chainName + ") finish sync block(" + successBlock + ")");

    } catch (e) {
        logger.error("inspectBlockHeader error:",e);
    }

    return successBlock;
}

/**
 * 同步确认块高的信息
 * @returns {Promise<void>}
 */
async function syncConfirmBlock() {
    try {
        //子链
        let subchainBlockNumResult = await chainApi.getSubchainBlockNum(chainConfig.config, chainConfig.localChainName);
        let confirmed_block = subchainBlockNumResult.confirmed_block;
        logger.error("[sync block]confirmed_block:",getHasConfirmBlock(confirmed_block));
        monitor.setConfirmBlockLocal(getHasConfirmBlock(confirmed_block));

        //主链
        let masterBlockNumResult = await chainApi.getMasterBlockNum(chainConfig.nodPort);
        logger.debug("master chain max block num:", masterBlockNumResult);

        //设置已同步主链的块高信息
        confirmed_block = masterBlockNumResult.confirmed_block;
        logger.error("[sync master block]confirmed_block:",getHasConfirmBlock(confirmed_block));
        monitor.setConfirmBlockMaster(getHasConfirmBlock(confirmed_block));
    } catch (e) {
        logger.error("syncConfirmBlock error:",e);
    }
}

/**
 *
 * @returns {Promise<void>}
 */
async function processTrans(trans,blockHeight,isMainchain) {

    let executeResult = true;
    try {
        //执行
        if (trans.length == 0) {
            executeResult = true;
        } else {

            /**
             * 统计数量
             * @type {number}
             */
            let successCount = 0;

            let faileCount = 0;


            let totalTranLength = trans.length;
            //遍历所有交易进行执行
            for (let t = 0; t < totalTranLength; t++) {
                let tranId = trans[t].trx.id;
                logger.info("tranId:", tranId);

                //检查交易是否已经执行
                let executed = await checkTranExecuted(tranId, blockHeight, isMainchain);

                //只要有一个执行失败，就是未执行
                if (executed == false) {
                    executeResult = false;
                    faileCount++;
                } else {
                    successCount ++;
                }

                //交易未执行，继续执行
                if (executed == false) {
                    //执行交易
                    logger.info("getMerkleProof(blockheight:" + blockHeight + ",trxid:" + tranId+ ",isMainchain:" + isMainchain);

                    //获取merkleProof
                    let merkleProof = null;
                    if (isMainchain == false) {
                        merkleProof = await chainApi.getMerkleProof(chainConfig.configSub, blockHeight, tranId);
                    } else {
                        merkleProof = await chainApi.getMerkleProof(chainConfig.config, blockHeight, tranId);
                    }
                    if (utils.isNotNull(merkleProof)) {
                        let tx_bytes_array = chainUtil.transferTrxReceiptBytesToArray(merkleProof.trx_receipt_bytes);

                        //投子链的块头到主链中
                        if (isMainchain == false) {
                            let param = {
                                chain_name: chainConfig.localChainName, block_number: blockHeight,
                                merkle_proofs: merkleProof.merkle_proof, tx_bytes: tx_bytes_array
                            }

                            let res = await chainApi.contractInteract(chainConfig.config, contractConstants.FUTUREIO, constants.actionConstants.SYNC_LIGHTCLIENT_TRAN, param, chainConfig.myAccountAsCommitteeList[0], chainConfig.mySkAsAccountList[0]);
                            logger.info("tranid(" + tranId + "),res:", res);
                        } else {
                            //投主链的块头到子链中
                            let param = {
                                chain_name: chainNameConstants.MAIN_CHAIN_NAME_TRANSFER, block_number: blockHeight,
                                merkle_proofs: merkleProof.merkle_proof, tx_bytes: tx_bytes_array
                            }

                            let res = await chainApi.contractInteract(chainConfig.configSub, contractConstants.FUTUREIO, constants.actionConstants.SYNC_LIGHTCLIENT_TRAN, param, chainConfig.myAccountAsCommitteeList[0], chainConfig.mySkAsAccountList[0]);
                            logger.info("tranid(" + tranId + "),res:", res);
                        }
                    } else {
                        logger.error("merkleProof is null tranid("+tranId+")");
                    }
                }

            }

            //如果交易中有成功的，那把不成功的加入到错误队列中,如果没有成功的，执行失败
            if (successCount <= 0 && utils.isNull(blockExeCache.get(blockHeight))) {
                logger.info("(blockheight:" + blockHeight + " success count is 0 and cache is null , block execcute failed");
                blockExeCache.put(blockHeight,"1",-1);
                return false;
            } else {

                //删除缓存
                blockCache.delete(blockHeight);

                if (faileCount <=0) {
                    logger.info("(blockheight:" + blockHeight + " failed count is 0 , block execcute success");
                    return true;

                } else {
                    //将所有执行失败的交易放入cache中
                    let uploadMonitor = true;

                    for (let t = 0; t < totalTranLength; t++) {
                        let tran = trans[t];
                        let tranId = trans[t].trx.id;
                        logger.debug("tranId:", tranId);

                        //检查交易是否已经执行
                        let executed = await checkTranExecuted(tranId, blockHeight, isMainchain);
                        if (executed == false) {
                            //如果没执行成，加入monitor
                            let uploadRes = await uploadTranToMonitor(tranId,blockHeight,isMainchain);
                            if (uploadRes == false) {
                                uploadMonitor = false;
                            }
                        }
                    }

                    //只有该块的没有成功的交易都加入到monitor成功了，才能跳过
                    if (uploadMonitor == false) {
                        logger.error("(blockheight:" + blockHeight + " partial success count > 0 , but upload to monitor failed,block execcute failed");
                        return false;
                    }  else {
                        logger.info("(blockheight:" + blockHeight + " partial success count > 0 , block execcute success");
                    }
                }

                return true;
            }
        }

    } catch (e) {
        logger.error("processTrans error:",e);
        executeResult = false;
    }

    return executeResult;
}

/**
 *
 * @param tranId
 * @param blockHeight
 * @returns {Promise<void>}
 */
async function uploadTranToMonitor(tranId,blockHeight,isMainchain) {

    let resFlag = false;

    try {
        let obj = {
            tranId: tranId,
            blockHeight: blockHeight,
            exeCount: 0,
        }

        //放入不同的错误cache中
        if (isMainchain == true) {
            obj.baseChain = chainNameConstants.MAIN_CHAIN_NAME;
            obj.targetChain = chainConfig.localChainName;
        } else {
            obj.targetChain = chainNameConstants.MAIN_CHAIN_NAME;
            obj.baseChain = chainConfig.localChainName;
        }

        let res = await chainApi.uploadFailTran(monitor.getMonitorUrl(), monitor.generateSign(obj));
        logger.info("uploadTranToMonitor res:", res);
        if (res.code == 0) {
            resFlag = true;
        }
    } catch (e) {
        logger.error("uploadTranToMonitor error:",e);
    }

    return resFlag;
}



/**
 * 检查交易是否执行成功
 * @param tranId
 * @returns {Promise<boolean>}
 */
async function checkTranExecuted(tranId,blockHeight,isMainChain) {
    let flag = false;
    try {
        //检查交易是否在缓存中
        if (utils.isNotNull(trxCache.get(tranId))) {
            logger.debug("tran("+tranId+") is in cache")
            return true;
        } else {
            logger.info("tran("+tranId+") is not in cache");

            //检查
            let blockHeightInfo = null;

            //主链的块在子链上查
            if (isMainChain == true) {
                blockHeightInfo = await chainApi.getBlockHeaderInfo(chainConfig.getLocalHttpEndpoint(),chainNameConstants.MAIN_CHAIN_NAME_TRANSFER,blockHeight);
            } else {
                //子链的块在主链上查
                blockHeightInfo = await chainApi.getBlockHeaderInfo(chainConfig.config.httpEndpoint,chainConfig.localChainName,blockHeight);
            }

            logger.debug("blockHeightInfo("+blockHeight+"):",blockHeightInfo);
            let checkHashIsready = chainUtil.checkHashIsready(blockHeightInfo,tranId);
            if (checkHashIsready == true) {
                logger.debug("tran("+tranId+") is in trx table");
                flag = true;
                trxCache.put(tranId,"1",HASH_EXPIRE_TIME_MS);
            } else {
                logger.info("tran("+tranId+") is not in trx table");
            }
        }

    } catch (e) {
        logger.error("checkTranExecuted error:",e);
    }

    return flag;
}


/**
 *
 * @param trans
 * @returns {Promise<void>}
 */
async function filterTrans(trans, chainName,targetChainName) {
    let filterTrans = [];
    try {
        if (trans.length > 0) {

            //用户同步
            let userTrans = chainUtil.getSyncUserTransFromTrans(trans, targetChainName);
            if (userTrans.length > 0) {
                userTrans.forEach(function (item, index) {
                    filterTrans.push(item);
                })
            }

            //账户权限同步
            let accPermTrans = await chainUtil.getSyncAccPermFromTrans(trans, chainConfig.nodPort, targetChainName);
            if (accPermTrans.length > 0) {
                accPermTrans.forEach(function (item, index) {
                    filterTrans.push(item);
                })
            }

            //资源同步
            let resourceTrans = chainUtil.getSyncResTransFromTrans(trans, targetChainName);
            if (resourceTrans.length > 0) {
                resourceTrans.forEach(function (item, index) {
                    filterTrans.push(item);
                })
            }

            //委员会同步
            // let committeeTrans = chainUtil.getMoveProdRTransFromTrans(trans, targetChainName);
            // if (committeeTrans.length > 0) {
            //     committeeTrans.forEach(function (item, index) {
            //         filterTrans.push(item);
            //     })
            // }

            //ugas同步
            let ugasTrans = chainUtil.getUgasTransFromTrans(trans, targetChainName);
            if (ugasTrans.length > 0) {
                ugasTrans.forEach(function (item, index) {
                    filterTrans.push(item);
                })
            }

        }

    } catch (e) {
        logger.error("filterTrans error:", e);
        return trans;
    }

    return filterTrans;

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

module.exports = {
    start,
    getProcessedBlock,
    updateProcessedBlock,
}
