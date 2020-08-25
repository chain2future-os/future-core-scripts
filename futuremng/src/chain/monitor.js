const fs = require('fs');
var logger = require("../config/logConfig").getLogger("Monitor");
var chainConfig = require("./chainConfig")
var chainApi = require("./chainApi")
var constants = require("../common/constant/constants")
var cacheKeyConstants = require("../common/constant/constants").cacheKeyConstants
var filenameConstants = require("../common/constant/constants").filenameConstants
var iniConstants = require("../common/constant/constants").iniConstants
var pathConstants = require("../common/constant/constants").pathConstants
var algorithmConstants = require("../common/constant/constants").algorithmConstants
var statusConstants = require("../common/constant/constants").statusConstants
var utils = require("../common/util/utils")
var CacheObj = require("../common/cache/cacheObj");
var hashUtil = require("../common/util/hashUtil")
var ShellCmd = require("../common/util/shellCmd")
var NodFuture = require("../nodfuture/nodfuture")
var sleep = require("sleep")
var process = require('child_process');
var WorldState = require("../worldstate/worldstate")
var os = require("os")
var chainUtil = require("./util/chainUtil")
const http = require('http');
var mkdirp = require('mkdirp')
var path = require('path')
var futureEncryptUtil = require("../common/util/futureEncryptUtil")


var hashCache = new CacheObj(false, null);
/**
 * hash缓存过期时间（1分钟）
 * @type {number}
 */
var HASH_EXPIRE_TIME_MS = 1000 * 60;

var deploySyncFlag = false;

var seedCount = 10;

var logCount = 1000;

var enableRestart = 1;

//使用投票同步用户和资源
var enableSyncUserRes = 0;

//使用块同步块和资源
var enableSyncUserResByBlock = 1;

var enableSyncUgas = 1;

var syncBlockHeaderMaxTranNum = 20;

var head_block_num = 0;

//ws hash相关信息
var ws_block_height = 0;
var ws_hash = 0;

//已同步主链的块高
var confirmBlockMaster = 0;

//已同步当前链的块高
var confirmBlockLocal=0;

var totalmem = 0;
var freemem = 0;

var errorStartUpMsg = ""

//文件下载顺序
var downloadUrlIndex = 0;

//sync service
var enableSyncService = 0;

var p2pcpp = false;


/**
 * 通过命令行获取内存用量
 */
function getMemFromCmd() {
    try {
        let cmd = "free -m  |grep Mem";
        //其它命令
        process.exec(cmd, async function (error, stdout, stderr, finish) {
            if (error) {
                logger.error("clearLogData error:",error);
            } else {
                logger.info("getMemFromCmd success:",stdout);
                let array = chainUtil.transferFreeMemToArray(stdout);
                if (array.length > 2) {
                    logger.debug("totalmem:",array[0]);
                    logger.debug("usedmem:",array[1]);
                    logger.debug("freemem:",array[0]-array[1]);
                    totalmem = array[0];
                    freemem = array[0]-array[1];
                }

            }
        });

    } catch (e) {
        logger.error("getMemFromCmd error:",e);
    }
}

/**
 * 获取os info
 */
function getOsInfo() {
    let osInfo = {loadAvg :"",uptime : 0,totalmem:0,freemem:0,system:"",cpus:[],errorStartUpMsg:{}};
    try {
        getMemFromCmd();
        osInfo.uptime = os.uptime();
        osInfo.loadAvg = os.loadavg();
        if (totalmem > 0 && freemem > 0) {
            osInfo.totalmem = totalmem;
            osInfo.freemem = freemem;
        } else {
            osInfo.totalmem = os.totalmem();
            osInfo.freemem = os.freemem();
        }
        osInfo.system = os.type()+" "+os.release();
        let cpus = [];
        let cpuArray = os.cpus();
        for (let i=0;i<cpuArray.length;i++) {
            //logger.error("cpu info:",cpuArray[i]);
            let cpuObj = {
                num: i + 1,
                speed: cpuArray[i].speed,
                user: cpuArray[i].times.user,
                nice:  cpuArray[i].times.nice,
                sys:  cpuArray[i].times.sys,
                idle:  cpuArray[i].times.idle,
                irq:  cpuArray[i].times.irq
            };
            cpus.push(cpuObj);
        }
        osInfo.cpus = cpus;

        osInfo.errorStartUpMsg = errorStartUpMsg;
    } catch (e) {
        logger.error("getOsInfo error")
    }

    return osInfo;

}

/**
 *
 * @returns {string}
 */
async function getNodVersion() {
    let hashFile = hashCache.get(cacheKeyConstants.NOD_FILE_KEY);
    if (utils.isNull(hashFile)) {
        logger.debug("cache not hit :" + cacheKeyConstants.NOD_FILE_KEY);
        let nodFilePath = utils.formatHomePath(chainConfig.configFileData.local.nodpath) + "/" + filenameConstants.NOD_EXE_FILE;
        hashFile = hashUtil.calcHash(nodFilePath, algorithmConstants.SHA1);
        if (utils.isNotNull(hashFile)) {
            hashCache.put(cacheKeyConstants.NOD_FILE_KEY, hashFile, HASH_EXPIRE_TIME_MS);
            logger.debug("cache info :", hashCache.getAll());
        }
    } else {
        logger.debug("cache hit :" + cacheKeyConstants.NOD_FILE_KEY, hashFile);
    }
    return hashFile;
}

/**
 *
 * @returns {Promise<*>}
 */
async function getServerVersion() {
    let version = hashCache.get(cacheKeyConstants.SERVER_VERSOIN_KEY);
    if (utils.isNull(version)) {
        version = await chainApi.getServerVersion(chainConfig.nodPort);
        if (utils.isNotNull(version)) {
            hashCache.put(cacheKeyConstants.SERVER_VERSOIN_KEY, version, HASH_EXPIRE_TIME_MS);
        }
    }

    return version;
}

/**
 *
 * @returns {string}
 */
async function getMngVersion() {
    let hashFile = hashCache.get(cacheKeyConstants.MNG_FILE_KEY);
    if (utils.isNull(hashFile)) {
        logger.debug("cache not hit :" + cacheKeyConstants.MNG_FILE_KEY);
        let nodFilePath = utils.formatHomePath(chainConfig.configFileData.local.mngpath) + "/" + filenameConstants.MNG_FILE;
        hashFile = hashUtil.calcHash(nodFilePath, algorithmConstants.SHA1);
        if (utils.isNotNull(hashFile)) {
            hashCache.put(cacheKeyConstants.MNG_FILE_KEY, hashFile, HASH_EXPIRE_TIME_MS);
        }
    } else {
        logger.debug("cache hit :" + cacheKeyConstants.MNG_FILE_KEY, hashFile);
    }
    return hashFile;
}

/**
 *
 * @returns {string}
 */
async function getWsVersion() {
    let hashFile = hashCache.get(cacheKeyConstants.WS_FILE_KEY);
    if (utils.isNull(hashFile)) {
        logger.debug("cache not hit :" + cacheKeyConstants.WS_FILE_KEY);
        let wsFilePath = utils.formatHomePath(chainConfig.configFileData.local.wsspath) + "/" + filenameConstants.WS_EXE_FILE;
        hashFile = hashUtil.calcHash(wsFilePath, algorithmConstants.SHA1);
        if (utils.isNotNull(wsFilePath)) {
            hashCache.put(cacheKeyConstants.WS_FILE_KEY, hashFile, HASH_EXPIRE_TIME_MS);
        }
    } else {
        logger.debug("cache hit :" + cacheKeyConstants.WS_FILE_KEY, hashFile);
    }
    return hashFile;
}

/**
 * 获取 rand 执行文件的目录
 * @returns {*}
 */
function getRandFilePath() {
    if (utils.isNotNull(chainConfig.configFileData.local.randpath)) {
        return utils.formatHomePath(chainConfig.configFileData.local.randpath);
    }

    return utils.formatHomePath("~/voterand/migrations");
}

/**
 *
 * @returns {string}
 */
function getSeedFilePath() {
    return pathConstants.MNG_CONFIG+"seedconfig.json";
}

/**
 *
 * @returns {string}
 */
function getGroupFilePath() {
    return pathConstants.MNG_CONFIG+"group.json";
}

/**
 *
 * @returns {string}
 */
async function getRandVersion() {
    let hashFile = hashCache.get(cacheKeyConstants.RAND_FILE_KEY);
    if (utils.isNull(hashFile)) {
        logger.debug("cache not hit :" + cacheKeyConstants.RAND_FILE_KEY);
        let randFilePath = getRandFilePath() + "/" + filenameConstants.RAND_FILE;
        hashFile = hashUtil.calcHash(randFilePath, algorithmConstants.SHA1);
        if (utils.isNotNull(hashFile)) {
            hashCache.put(cacheKeyConstants.RAND_FILE_KEY, hashFile, HASH_EXPIRE_TIME_MS);
        }
    } else {
        logger.debug("cache hit :" + cacheKeyConstants.RAND_FILE_KEY, hashFile);
    }
    return hashFile;
}

/**
 *
 * @returns {string}
 */
async function getSeedConfigVersion() {
    let hashFile = hashCache.get(cacheKeyConstants.SEED_CONFIG_KEY);
    if (utils.isNull(hashFile)) {
        logger.debug("cache not hit :" + cacheKeyConstants.SEED_CONFIG_KEY);
        hashFile = hashUtil.calcHash(getSeedFilePath(), algorithmConstants.SHA1);
        if (utils.isNotNull(hashFile)) {
            hashCache.put(cacheKeyConstants.SEED_CONFIG_KEY, hashFile, HASH_EXPIRE_TIME_MS);
        }
    } else {
        logger.debug("cache hit :" + cacheKeyConstants.SEED_CONFIG_KEY, hashFile);
    }
    return hashFile;
}

async function getGroupConfigVersion() {
    let hashFile = hashCache.get(cacheKeyConstants.GROUP_CONFIG_KEY);
    if (utils.isNull(hashFile)) {
        logger.debug("cache not hit :" + cacheKeyConstants.GROUP_CONFIG_KEY);
        hashFile = hashUtil.calcHash(getGroupFilePath(), algorithmConstants.SHA1);
        if (utils.isNotNull(hashFile)) {
            hashCache.put(cacheKeyConstants.GROUP_CONFIG_KEY, hashFile, HASH_EXPIRE_TIME_MS);
        }
    } else {
        logger.debug("cache hit :" + cacheKeyConstants.GROUP_CONFIG_KEY, hashFile);
    }
    return hashFile;
}

/**
 *
 * @returns {*}
 */
function getMonitorUrl() {
    logger.debug("monitor url:",chainConfig.configFileData.target[iniConstants.MONITOR_SERVER_ENDPOINT]);
    return chainConfig.configFileData.target[iniConstants.MONITOR_SERVER_ENDPOINT];
}

/**
 *
 * @returns {boolean}
 */
function checkNeedSync() {
    if (chainConfig.configFileData.local[iniConstants.MONITOR] == false) {
        return false;
    }

    return true;
}

/**
 *
 * @returns {Promise<{mngVersion, ipLocal: (*|string), chainId: string, ipPublic: *, nodVersion, user: string, isProducer: number}>}
 */
async function buildParam( committeeIndex = 0 ) {

    let publicip = await utils.getPublicIp();
    logger.debug("extern ip:" + publicip);
    var user = "unkown";
    if (utils.isNotNull(chainConfig.myAccountAsCommitteeList[committeeIndex])) {
        user = chainConfig.myAccountAsCommitteeList[committeeIndex];
    }
    var nodFileHash = await getNodVersion();
    if (utils.isNull(nodFileHash)) {
        logger.error("nod file hash error");
        nodFileHash = "error";
    }

    var mngFileHash = await getMngVersion();
    if (utils.isNull(mngFileHash)) {
        logger.error("mng file hash error");
        mngFileHash = "error";
    }

    var wsFileHash = await getWsVersion();
    if (utils.isNull(wsFileHash)) {
        logger.error("ws file hash error");
        wsFileHash = "error";
    }

    var randFileHash = await getRandVersion();
    if (utils.isNull(randFileHash)) {
        logger.error("randFileHash hash error");
        randFileHash = "error";
    }

    var seedFileHash = await getSeedConfigVersion();
    if (utils.isNull(seedFileHash)) {
        logger.error("seedFileHash hash error");
        seedFileHash = "error";
    }


    var groupFileHash = await getGroupConfigVersion();
    if (utils.isNull(groupFileHash)) {
        logger.error("groupFileHash hash error");
        groupFileHash = "error";
    }

    var isProducer = 1;
    if (chainConfig.isNoneProducer()) {
        isProducer = 0;
    }

    let enableRestartRes = 1;
    if (enableRestart == 0 && chainConfig.configFileData.local["enableRestart"]==false) {
        enableRestartRes = 0;
    }

    let serverVersion = await getServerVersion();
    logger.debug("serverVersion:",serverVersion);

    let subsidiaryAccount = "";
    if (committeeIndex == 0 && chainConfig.myAccountAsCommitteeList.length > 1) {
        for (var index = 1; index < chainConfig.myAccountAsCommitteeList.length; index++) {
            subsidiaryAccount += chainConfig.myAccountAsCommitteeList[index];
            if (index != chainConfig.myAccountAsCommitteeList.length - 1) {
                subsidiaryAccount += ",";
            }
        }
    }

    chainUtil.checkProcess("p2pcpp", "/root/p2pcpp", function (result) {
        p2pcpp = result;
    });

    var extMsg = {
        "enableRestart": enableRestartRes,
        "enableSyncUserRes": enableSyncUserRes,
        "enableSyncUgas" : enableSyncUgas,
        "enableSyncUserResByBlock":enableSyncUserResByBlock,
        "syncBlockHeaderMaxTranNum":syncBlockHeaderMaxTranNum,
        "headBlockNum":head_block_num,
        "wsBlockHeight":ws_block_height,
        "wsHash":ws_hash,
        "wsFileHash" : wsFileHash,
        "randFileHash":randFileHash,
        "serverVersion":serverVersion,
        "seedFileHash":seedFileHash,
        "groupFileHash":groupFileHash,
        "subsidiaryAccount":subsidiaryAccount,
        "p2pcpp":p2pcpp,
    }
    var param = {
        "chainId": chainConfig.localChainName,
        "ipLocal": utils.getLocalIPAdress(),
        "ipPublic": publicip,
        "user": user,
        "nodVersion": nodFileHash,
        "mngVersion": mngFileHash,
        "isProducer": isProducer,
        "time": new Date().getTime(),
        "ext" : JSON.stringify(extMsg),
        "os" :"{}"
    };

    return param;
}

/**
 * check in
 * @returns {Promise<void>}
 */
async function checkIn() {
    try {
        clearLogData();

        if (checkNeedSync() == false) {
            return
        }

        let osInfo = getOsInfo();
        //logger.error("osinfo:",osInfo);

        logger.info("monitor checkin start,length:",chainConfig.myAccountAsCommitteeList.length);
        for(let k = 0; k < chainConfig.myAccountAsCommitteeList.length; k++ ) {
            let param = await buildParam( k );

            param.os = JSON.stringify(osInfo);

            param = generateSign(param);

            await chainApi.monitorCheckIn(getMonitorUrl(), param);
        }

        logger.info("monitor checkin end");

        await getDeployFile();

        if (chainConfig.configFileData.local.seedFileUpdate == true) {
            await syncSeedInfo();
        }
    } catch (e) {
        logger.error("checkIn error,", e);
    }
}

/**
 *
 * @returns {Promise<void>}
 */
async function syncSeedInfo() {

    if (checkNeedSync() == false) {
        return
    }

    logger.info("syncSeedInfo start,seedCount:"+seedCount);

    if (seedCount < 10) {
        seedCount++;
        return;
    }

    //reset
    seedCount = 1;

    let param = await buildParam();
    param = generateSign(param);
    let deployInfo = await chainApi.getSeedInfo(getMonitorUrl(), param);
    if (utils.isNotNull(deployInfo) && chainApi.verifySign(deployInfo) == true) {
        let data = deployInfo.data;
        logger.debug("seed data list:",data);
        if (utils.isNullList(data) || data.length == 0) {
            logger.error("seed info is null or invalid, need not update");
        } else {
            if (JSON.stringify(data) == JSON.stringify(chainConfig.seedIpConfig)) {
                logger.info("seed info is equal, need not update");
            } else {
                var filepath = pathConstants.MNG_CONFIG + "seedconfig.json";
                chainConfig.seedIpConfig = data;

                fs.writeFile(filepath, futureEncryptUtil.encodeFuture(JSON.stringify(data)), {flag: 'w'}, function (err) {
                    if (err) {
                        logger.error("write seed config file error:");
                    } else {
                        logger.info("write seed config file success:");
                    }
                });
            }
        }
    }  else {
        logger.error("syncSeedInfo sign error");
    }

    logger.info("getGroupInfo start");
    /**
     * 获取group
     */
    let groupInfo = await chainApi.getGroupInfo(getMonitorUrl(), param);
    if (utils.isNotNull(groupInfo) && chainApi.verifySign(groupInfo) == true) {
        let groupList = groupInfo.data.groupList;

        var filepath = pathConstants.MNG_CONFIG+filenameConstants.GROUP_FILE;

        if (JSON.stringify(groupList) == JSON.stringify(chainConfig.groupConfig)) {
            logger.info("group info is equal, need not update");
            return;
        }

        chainConfig.groupConfig = groupList;

        fs.writeFile(filepath, futureEncryptUtil.encodeFuture(JSON.stringify(groupList)), {flag: 'w'}, function (err) {
            if(err) {
                logger.error("write group config file error:");
            } else {
                logger.info("write group config file success:");
            }
        });

    }


}

/**
 * deploy filehh
 * @returns {Promise<void>}
 */
async function getDeployFile() {

    if (checkNeedSync() == false) {
        return
    }

    // if (chain.isChainChanging() == true) {
    //     return;
    // }

    if (deploySyncFlag == true) {
        return;
    }


    logger.info("getDeployFile start");
    let param = await buildParam();
    param = generateSign(param);
    let deployInfo = await chainApi.checkDeployFile(getMonitorUrl(), param);

    //logger.info("get deploy info:", deployInfo);

    if (chainApi.verifySign(deployInfo) == false) {
        logger.error("get deploy(check sign) error:");
    }

    /**
     *
     */
    if (utils.isNotNull(deployInfo.data)) {
        //logger.info("receive deploy info:", deployInfo.data);
        //TODO check sign
        if (signCheck(deployInfo.data) == true) {
            //文件部署
            if (deployInfo.data.type == 0) {
                await fileDeploy(deployInfo.data.deployBatch);
            }

            //命令部署
            if (deployInfo.data.type == 1) {
                await cmdDeploy(deployInfo.data.deployBatch);
            }

        } else {
            logger.error("invalid file update,undo");
        }
    }
}

async function cmdDeploy(deployBatch) {
    deploySyncFlag = true;
    try {
        var deployCmd = JSON.parse(deployBatch.deployInfo);
        logger.debug("deployCmd:", deployCmd);

        logger.info("start to deploy cmd (" + deployCmd.name +  ")");
        logger.info("start to exe cmd (" + deployCmd.content +  ")");

        //系统命令
        let systemCmd = false;

        //设置重启-1
        if (deployCmd.content == constants.cmdConstants.ENABLE_RESTART) {
            enableRestart = 1;
            systemCmd = true;
        }

        //设置重启-0
        if (deployCmd.content == constants.cmdConstants.DISABLE_RESTART) {
            enableRestart = 0;
            systemCmd = true;
        }

        //开启同步用户和资源-1
        if (deployCmd.content == constants.cmdConstants.ENABLE_SYNC_USER_RES) {
            enableSyncUserRes = 1;
            systemCmd = true;
        }

        //关闭同步用户和资源-1
        if (deployCmd.content == constants.cmdConstants.DISABLE_SYNC_USER_RES) {
            enableSyncUserRes = 0;
            systemCmd = true;
        }

        //开启通过块高同步用户和资源-1
        if (deployCmd.content == constants.cmdConstants.ENABLE_SYNC_USER_RES_BY_BLOCK) {
            enableSyncUserResByBlock = 1;
            systemCmd = true;
        }

        //关闭通过块高同步用户和资源-1
        if (deployCmd.content == constants.cmdConstants.DISABLE_SYNC_USER_RES_BY_BLOCK) {
            enableSyncUserResByBlock = 0;
            systemCmd = true;
        }

        //开启同步ugas-1
        if (deployCmd.content == constants.cmdConstants.ENABLE_SYNC_FGAS) {
            enableSyncUgas = 1;
            systemCmd = true;
        }

        //关闭同步ugas-0
        if (deployCmd.content == constants.cmdConstants.DISABLE_SYNC_FGAS) {
            enableSyncUgas = 0;
            systemCmd = true;
        }


        //开启矿机节点同步服务
        if (deployCmd.content == constants.cmdConstants.ENABLE_SYNC_SERIVE) {
            enableSyncService = 1;
            systemCmd = true;
        }

        //关闭矿机节点同步服务
        if (deployCmd.content == constants.cmdConstants.DISABLE_SYNC_SERIVE) {
            enableSyncService = 0;
            systemCmd = true;
        }

        if (deployCmd.content == constants.cmdConstants.SET_SYNC_BLOCK_MAX_COUNT) {
            syncBlockHeaderMaxTranNum = deployCmd.arg;
            systemCmd = true;
        }


        //增加nod配置并重新启动
        if (deployCmd.content == constants.cmdConstants.ADD_NOD_CONFIG) {

            let param = await buildParam();
            param.batchId = deployBatch.id;

            let logMsg = "";

            let configList = JSON.parse(deployCmd.arg);

            logger.info("ADD_NOD_CONFIG log,data:", configList);

            let hasReady = NodFuture.checkConfigInfo(configList);
            if (hasReady) {
                logger.info("add config has already existed");
                param.status = statusConstants.EXCEPTION;
                param.ext = "add config has already existed";
                param = generateSign(param);
                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                enableDeploy();
                return;
            } else {
                logger.info("add config has not already existed,need update info");
                logMsg = utils.addLogStr(logMsg, "add config has not already existed,need update info");

                try {
                    let stopFlag = await NodFuture.stop(600000,chainConfig.nodPort);
                    if (stopFlag == true) {
                        logMsg = utils.addLogStr(logMsg, "stop nod success");
                        let updateConfigFlag = NodFuture.addConfigInfo(configList);
                        if (updateConfigFlag == true) {
                            logMsg = utils.addLogStr(logMsg, "update nod config success");
                            logger.info("start to sleep 10s to confirm nod is stopped");
                            sleep.msleep(10000);
                            logger.info("start to sleep 10s to confirm nod is stopped");
                            let result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), " ", chainConfig.localTest,chainConfig.nodPort);
                            if (result == true) {
                                logMsg = utils.addLogStr(logMsg, "start nod  success");
                                //成功
                                param.status = statusConstants.SUCCESS;
                                param.ext = logMsg;
                                param = generateSign(param);
                                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                                enableDeploy();
                                return;
                            } else {
                                logMsg = utils.addLogStr(logMsg, "start nod error");
                            }

                        } else {
                            logMsg = utils.addLogStr(logMsg, "update config error");
                        }

                    } else {
                        logMsg = utils.addLogStr(logMsg, "stop nod error");
                    }

                } catch (e) {
                    logger.error("add nod config error,", e);
                }

                //失败
                param.status = statusConstants.EXCEPTION;
                param.ext = logMsg;
                param = generateSign(param);
                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                enableDeploy();
                return;
            }

            return;
        }

        //重启nod
        if (deployCmd.content == constants.cmdConstants.RESTART_NOD) {

            let param = await buildParam();
            param.batchId = deployBatch.id;
            let logMsg = "";
            try {
                let stopFlag = await NodFuture.stop(600000, chainConfig.nodPort);
                if (stopFlag == true) {
                    logMsg = utils.addLogStr(logMsg, "stop nod success");
                    logger.info("start to sleep 10s to confirm nod is stopped");
                    sleep.msleep(10000);
                    logger.info("start to sleep 10s to confirm nod is stopped");
                    let result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), " ", chainConfig.localTest, chainConfig.nodPort);
                    if (result == true) {
                        logMsg = utils.addLogStr(logMsg, "start nod  success");
                        //成功
                        param.status = statusConstants.SUCCESS;
                        param.ext = logMsg;
                        param = generateSign(param);
                        await chainApi.finsihDeployFile(getMonitorUrl(), param);
                        enableDeploy();
                        return;
                    } else {
                        logMsg = utils.addLogStr(logMsg, "start nod error");
                    }

                } else {
                    logMsg = utils.addLogStr(logMsg, "stop nod error");
                }
            } catch (e) {
                logger.error("cmd restart nod error", e);
            }

            //失败
            param.status = statusConstants.EXCEPTION;
            param.ext = logMsg;
            param = generateSign(param);
            await chainApi.finsihDeployFile(getMonitorUrl(), param);
            enableDeploy();

            return;
        }


        //修改monitor信息
        if (deployCmd.content == constants.cmdConstants.UPDATE_MONITOR) {

            let param = await buildParam();
            param.batchId = deployBatch.id;

            let logMsg = "";

            let monitorUrl = deployCmd.arg;
            logger.info("need to update monitor url :",monitorUrl)

            let configList = [];
            configList.push("monitor-server-endpoint = "+monitorUrl)

            logger.info("ADD_NOD_CONFIG log,data:", configList);


            let hasReady = NodFuture.checkConfigInfo(configList);
            if (hasReady) {
                logger.info("monitor url has already existed");
                param.status = statusConstants.EXCEPTION;
                param.ext = "monitor url has already existed";
                param = generateSign(param);
                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                enableDeploy();
                return;
            } else {
                logger.info("monitor url has not already existed,need update info");
                logMsg = utils.addLogStr(logMsg, "monitor url has not already existed,need update info");

                try {
                    let stopFlag = await NodFuture.stop(60000,chainConfig.nodPort);
                    if (stopFlag == true) {
                        logMsg = utils.addLogStr(logMsg, "stop nod success");
                        let updateConfigFlag = NodFuture.updateConfigInfo(configList);
                        if (updateConfigFlag == true) {
                            logMsg = utils.addLogStr(logMsg, "update nod config success");
                            logger.info("start to sleep 10s to confirm nod is stopped");
                            sleep.msleep(10000);
                            logger.info("start to sleep 10s to confirm nod is stopped");
                            let result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), " ", chainConfig.localTest,chainConfig.nodPort);
                            if (result == true) {
                                logMsg = utils.addLogStr(logMsg, "start nod  success");
                                //成功
                                param.status = statusConstants.SUCCESS;
                                param.ext = logMsg;
                                param = generateSign(param);
                                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                                enableDeploy();
                                await restartMng();
                                return;
                            } else {
                                logMsg = utils.addLogStr(logMsg, "start nod error");
                            }

                        } else {
                            logMsg = utils.addLogStr(logMsg, "update config error");
                        }

                    } else {
                        logMsg = utils.addLogStr(logMsg, "stop nod error");
                    }

                } catch (e) {
                    logger.error("add nod config error,", e);
                }

                //失败
                param.status = statusConstants.EXCEPTION;
                param.ext = logMsg;
                param = generateSign(param);
                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                enableDeploy();
                await restartMng();
                return;
            }

            return;
        }

        if (systemCmd == true) {
            let param = await buildParam();
            param.batchId = deployBatch.id;
            param.status = statusConstants.SUCCESS;
            param.ext = "success";
            param = generateSign(param);
            await chainApi.finsihDeployFile(getMonitorUrl(), param);
            enableDeploy();
            return;
        }

        //其它命令
        process.exec(deployCmd.content, async function (error, stdout, stderr, finish) {

            let param = await buildParam();
            param.batchId = deployBatch.id;
            logger.info("finsih deploy param:",param);
            if (error !== null) {
                logger.error('exec error: ' + error);
                param.status = statusConstants.EXCEPTION;
                param.ext = error.toString();
                param = generateSign(param);
                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                enableDeploy();
            } else {
                logger.info("exec success :",stdout);
                param.status = statusConstants.SUCCESS;
                if (utils.isNotNull(stdout) && stdout != undefined) {
                    param.ext = stdout.toString();
                }
                param = generateSign(param);
                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                enableDeploy();
            }

        });

    } catch (e) {
        logger.error("cmd deplpy error,",e);
        deploySyncFlag = false;
    }


}

/**
 *
 * @returns {boolean}
 */
function signCheck() {
    return true;
}

/**
 *
 * @param filename
 * @returns {Promise<string>}
 */
async function getLocalHash(filename) {

    //nod 本地 hash
    if (filenameConstants.NOD_EXE_FILE == filename) {
        return await getNodVersion();
    }

    if (filenameConstants.MNG_FILE == filename) {
        return await getMngVersion();
    }

    if (filenameConstants.WS_EXE_FILE == filename) {
        return await getWsVersion();
    }

    if (filenameConstants.RAND_FILE == filename) {
        return await getRandVersion();
    }

    return "";
}



function getTargetPath(filename) {
    //nod 本地 hash
    if (filenameConstants.NOD_EXE_FILE == filename) {
        return utils.formatHomePath(chainConfig.configFileData.local.nodpath) + "/" + filename;
    }

    if (filenameConstants.MNG_FILE == filename) {
        return utils.formatHomePath(chainConfig.configFileData.local.mngpath) + "/" + filename;
    }

    if (filenameConstants.WS_EXE_FILE == filename) {
        return utils.formatHomePath(chainConfig.configFileData.local.wsspath) + "/" + filename;
    }

    if (filenameConstants.RAND_FILE == filename) {
        return getRandFilePath() + "/" + filename;
    }

    return "";
}

/**
 *
 * @param deployInfo
 * @returns {*}
 */
function getDownloadUrlList(deployInfo) {
    let list = [];
    list.push(deployInfo.url);
    try {

        if (utils.isNull(deployInfo.urlList)) {
            return list;
        }

        let urlList = JSON.parse(deployInfo.urlList);
        if (utils.isNotNull(urlList) && urlList.length > 0) {
            return urlList;
        }

    } catch (e) {
        logger.error("getUrlList error:",e);
    }

    return list;
}

async function fileDeploy(deployBatch) {
    deploySyncFlag = true;

    try {
        var deployFile = JSON.parse(deployBatch.deployInfo);
        logger.debug("deployFile:", deployFile);

        logger.info("start to deploy file (" + deployFile.filename + ")");

        let localHash = await getLocalHash(deployFile.filename);
        let urlList = getDownloadUrlList(deployFile);
        logger.info("find download list:",urlList);
        if (localHash == deployFile.hash) {
            downloadUrlIndex = 0;
            logger.info("localfile hash(" + localHash + ") is equal deploy hash(" + deployFile.hash + ") ,need not download");
            deploySyncFlag = false;

            let param = await buildParam();
            param.status = statusConstants.SUCCESS;
            param.batchId = deployBatch.id;
            param = generateSign(param);
            logger.info("finsih deploy param:",param);
            await chainApi.finsihDeployFile(getMonitorUrl(), param);
            return;
        } else {
            logger.info("localfile hash(" + localHash + ") is not  equal deploy hash(" + deployFile.hash + ") ,need download");
        }

        let localpath = getDownloadFilePath(deployFile.filename, deployFile.hash);



        if (fs.existsSync(localpath)) {
            logger.info("file has already downloaded:" + localpath);

            if (filenameConstants.NOD_EXE_FILE == deployFile.filename) {
                await fileProcessNod(deployFile, localpath);
            }

            if (filenameConstants.MNG_FILE == deployFile.filename) {
                await fileProcessMng(deployFile, localpath);
            }

            if (filenameConstants.WS_EXE_FILE == deployFile.filename) {
                await fileProcessWs(deployFile, localpath);
            }

            if (filenameConstants.RAND_FILE == deployFile.filename) {
                await fileProcessRand(deployFile, localpath);
            }

        } else {
            logger.info("file is not ready, need to downloaded:" + localpath);

            if (downloadUrlIndex >= urlList.length) {
                deploySyncFlag = false;
                downloadUrlIndex=0;
                let param = await buildParam();
                param.status = statusConstants.EXCEPTION;
                param.batchId = deployBatch.id;
                logger.info("finsih deploy param:", param);
                param.ext = "timeout";
                param = generateSign(param);
                await chainApi.finsihDeployFile(getMonitorUrl(), param);
                return;
            }
            let downloadUrl = urlList[downloadUrlIndex];

            let parseInfo = chainUtil.parseUrlInfo(downloadUrl);
            var options = {
                host: parseInfo.host,
                port: parseInfo.port,
                path: parseInfo.path,
                method: 'GET',
            };

            logger.info("start to download url(" + downloadUrl + "),count:" + downloadUrlIndex + " options:", options);
            logger.info("download path:",path.dirname(localpath));

            mkdirp(path.dirname(localpath), function (err) {
                if (err) {
                    logger.error(("create path error:",path.dirname(localpath)));
                } else {
                    logger.info(("create path success:",path.dirname(localpath)));
                }
            })

            sleep.msleep(2000);

            //文件下载
            var file = fs.createWriteStream(localpath);

            //下载超时时间
            var timeoutDownload = 300000;

            //超时abort请求
            var timeout_wrapper = function (req) {
                return async function () {
                    try {
                        // do some logging, cleaning, etc. depending on req
                        logger.error("timeout to abort:", downloadUrl);
                        req.abort();
                    } catch (e) {
                        logger.error("abort error:", e);
                    }

                    if (downloadUrlIndex == urlList.length -1) {
                        logger.error("index("+downloadUrlIndex+") is to end("+(urlList.length-1)+"),need upload");
                        downloadUrlIndex=0;
                        let param = await buildParam();
                        param.status = statusConstants.EXCEPTION;
                        param.batchId = deployBatch.id;
                        logger.info("finsih deploy param:", param);
                        param.ext = "timeout";
                        param = generateSign(param);
                        await chainApi.finsihDeployFile(getMonitorUrl(), param);
                    } else {
                        logger.error("index("+downloadUrlIndex+") is not to end("+(urlList.length-1)+"),wait to next");
                    }
                };
            };

            //发起请求
            var request = http.get(options, function (res) {
                res.on('data', function (data) {
                    try {
                        //logger.info("download data");
                        file.write(data);
                        // reset timeout
                        // clearTimeout(timeout);
                        // timeout = setTimeout(fn, timeoutDownload);
                    } catch (e) {
                        logger.error("abort error:", e);
                    }
                }).on('end', function () {
                    try {
                        downloadUrlIndex++;
                        logger.info("download end");
                        deploySyncFlag = false;
                        // clear timeout
                        clearTimeout(timeout);
                        file.end();
                        console.log(localpath + ' downloaded ');
                        //cb(null, file.path);
                    } catch (e) {
                        logger.error("abort error:", e);
                        deploySyncFlag = false;
                    }
                }).on('error', async function (err) {
                    try {
                        logger.info("download error");
                        downloadUrlIndex++;
                        deploySyncFlag = false;
                        // clear timeout
                        clearTimeout(timeout);
                        console.log("Got error: " + err.message);
                        //cb(err, null);
                    } catch (e) {
                        logger.error("abort error:", e);
                        deploySyncFlag = false;
                    }

                    if (downloadUrlIndex == urlList.length -1) {
                        logger.error("index("+downloadUrlIndex+") is to end("+(urlList.length-1)+"),need upload");
                        downloadUrlIndex=0;
                        let param = await buildParam();
                        param.status = statusConstants.EXCEPTION;
                        param.batchId = deployBatch.id;
                        logger.info("finsih deploy param:", param);
                        param.ext = "error";
                        param = generateSign(param);
                        await chainApi.finsihDeployFile(getMonitorUrl(), param);
                    } else {
                        logger.error("index("+downloadUrlIndex+") is not to end("+(urlList.length-1)+"),wait to next");
                    }
                });
            });

            // generate timeout handler
            var fn = timeout_wrapper(request);

            // set initial timeout
            var timeout = setTimeout(fn, timeoutDownload);

        }

    } catch (e) {
        logger.error("fileDeploy error", e);
        deploySyncFlag = false;
    }
}

/**
 *
 * @returns {Promise<void>}
 */
async function restartMng() {
    let cmd = "pm2 restart sideChainService";
    logger.info("need to restart futuremng..");
    process.exec(cmd, async function (error, stdout, stderr, finish,cmd) {
        if (error !== null) {
            logger.error('exec error: ' + error);
            enableDeploy();
        } else {
            logger.info("exec success :",cmd);
            enableDeploy();
        }
    });
}

/**
 *
 * @param deployFile
 * @param localpath
 * @returns {Promise<void>}
 */
async function fileProcessMng(deployFile, localpath) {

    try {
        let hash = hashUtil.calcHash(localpath, algorithmConstants.SHA1);
        if (hash == deployFile.hash) {
            logger.info("download file(" + hash + ") equals server info(" + deployFile.hash + ")");
            logger.info("start to update mng file");
            let targetPath = getTargetPath(deployFile.filename);
            logger.info("need to update target path :" + targetPath);

            var cmd = "cp " + localpath + " " + targetPath + " -f";
            process.exec(cmd, async function (error, stdout, stderr, finish) {
                if (error !== null) {
                    logger.error('exec error: ' + error);
                    enableDeploy();
                } else {
                    logger.info("exec success :",cmd);
                    cmd = "pm2 restart sideChainService";
                    process.exec(cmd, async function (error, stdout, stderr, finish,cmd) {
                        if (error !== null) {
                            logger.error('exec error: ' + error);
                            enableDeploy();
                        } else {
                            logger.info("exec success :",cmd);
                            enableDeploy();
                        }
                    });

                }

            });
        } else {
            enableDeploy()
        }
    } catch (e) {
        logger.error("fileProcessMng error,",e);
        enableDeploy()
    }

}


/**
 *
 * @param deployFile
 * @param localpath
 * @returns {Promise<void>}
 */
async function fileProcessRand(deployFile, localpath) {

    try {
        let hash = hashUtil.calcHash(localpath, algorithmConstants.SHA1);
        if (hash == deployFile.hash) {
            logger.info("download file(" + hash + ") equals server info(" + deployFile.hash + ")");
            logger.info("start to update mng file");
            let targetPath = getTargetPath(deployFile.filename);
            logger.info("need to update target path :" + targetPath);

            var cmd = "cp " + localpath + " " + targetPath + " -f";
            process.exec(cmd, async function (error, stdout, stderr, finish) {
                if (error !== null) {
                    logger.error('exec error: ' + error);
                    enableDeploy();
                } else {
                    logger.info("exec success :",cmd);
                    cmd = "pm2 restart votingRandService";
                    process.exec(cmd, async function (error, stdout, stderr, finish,cmd) {
                        if (error !== null) {
                            logger.error('exec error: ' + error);
                            enableDeploy();
                        } else {
                            logger.info("exec success :",cmd);
                            enableDeploy();
                        }
                    });

                }

            });
        } else {
            enableDeploy()
        }
    } catch (e) {
        logger.error("fileProcessRand error,",e);
        enableDeploy()
    }

}

/**
 *
 * @param deployFile
 * @param localpath
 * @returns {Promise<void>}
 */
async function fileProcessNod(deployFile, localpath) {
    try {
        let hash = hashUtil.calcHash(localpath, algorithmConstants.SHA1);
        if (hash == deployFile.hash) {
            logger.info("download file(" + hash + ") equals server info(" + deployFile.hash + ")");
            logger.info("start to stop nod before update file");
            sleep.msleep(1000);
            result = await NodFuture.stop(1200000,chainConfig.nodPort);
            if (result == true) {
                logger.info("nod stop successfully,start to update file");
                let targetPath = getTargetPath(deployFile.filename);
                logger.info("need to update target path :" + targetPath);
                result = await NodFuture.stop(120000,chainConfig.nodPort);
                logger.info("start to sleep 10s to confirm nod is stopped");
                sleep.msleep(10000);
                logger.info("finish sleep 10s to confirm nod is stopped");
                if (result == true) {
                    let cmd = "cp " + localpath + " " + targetPath + " -f";
                    process.exec(cmd, async function (error, stdout, stderr, finish) {
                        if (error !== null) {
                            logger.error('exec error: ' + error);
                            enableDeploy();
                        } else {
                            hashCache.clear();
                            logger.info("exe success: " + cmd);
                            cmd = "chmod a+x " + targetPath;
                            process.exec(cmd, async function (error, stdout, stderr, finish) {
                                if (error !== null) {
                                    logger.error('exec error: ' + error);
                                    enableDeploy();
                                } else {

                                    //刷盘
                                    cmd = "sync && cd " + utils.formatHomePath(chainConfig.configFileData.local.nodpath);
                                    process.exec(cmd, async function (error, stdout, stderr, finish) {

                                        if (error !== null) {
                                            logger.error('exec error: ' + error);
                                            enableDeploy();
                                        } else {
                                            logger.info("exccmd success:" + cmd);
                                            result = await NodFuture.start(120000, utils.formatHomePath(chainConfig.configFileData.local.nodpath), " ", chainConfig.localTest,chainConfig.nodPort);
                                            if (result == true) {
                                                logger.info("nod start success")
                                            } else {
                                                logger.error("node start error");
                                            }
                                            enableDeploy();
                                        }

                                    });

                                }
                            });
                        }
                    });
                }
            } else {
                logger.error("nod stop failed,can't update file");
                enableDeploy()
            }

        } else {
            logger.error("download file(" + hash + ") not equals server info(" + deployFile.hash + "),need remove download file");
            await ShellCmd.execCmd("rm " + localpath);
            sleep.msleep(3000);
            enableDeploy()
        }

    } catch (e) {
        logger.error("fileProcessNod error:", e);
        enableDeploy()
    }


}

/**
 * 更新世界状态问价
 * @param deployFile
 * @param localpath
 * @returns {Promise<void>}
 */
async function fileProcessWs(deployFile, localpath) {
    try {
        let hash = hashUtil.calcHash(localpath, algorithmConstants.SHA1);
        if (hash == deployFile.hash) {
            logger.info("download file(" + hash + ") equals server info(" + deployFile.hash + ")");
            logger.info("start to stop ws before update file");
            sleep.msleep(1000);
            result = await WorldState.stop(120000);
            if (result == true) {
                logger.info("ws stop successfully,start to update file");
                let targetPath = getTargetPath(deployFile.filename);
                logger.info("need to update target path :" + targetPath);
                result = await WorldState.stop(120000);
                logger.info("start to sleep 5s to confirm ws is stopped");
                sleep.msleep(5000);
                logger.info("finish sleep 5s to confirm ws is stopped");
                if (result == true) {
                    let cmd = "cp " + localpath + " " + targetPath + " -f";
                    process.exec(cmd, async function (error, stdout, stderr, finish) {
                        if (error !== null) {
                            logger.error('exec error: ' + error);
                            enableDeploy();
                        } else {
                            hashCache.clear();
                            logger.info("exe success: " + cmd);
                            cmd = "chmod a+x " + targetPath;
                            process.exec(cmd, async function (error, stdout, stderr, finish) {
                                if (error !== null) {
                                    logger.error('exec error: ' + error);
                                    enableDeploy();
                                } else {
                                    logger.info("exccmd success:" + cmd);
                                    result = await WorldState.startWithoutUpdate(120000, utils.formatHomePath(chainConfig.configFileData.local.wsspath), chainConfig.localTest);
                                    if (result == true) {
                                        logger.info("ws start success")
                                    } else {
                                        logger.error("node start error");
                                    }
                                    enableDeploy();
                                }
                            });
                        }
                    });
                }
            } else {
                logger.error("nod stop failed,can't update file");
                enableDeploy()
            }

        } else {
            logger.error("download file(" + hash + ") not equals server info(" + deployFile.hash + "),need remove download file");
            await ShellCmd.execCmd("rm " + localpath);
            sleep.msleep(3000);
            enableDeploy()
        }

    } catch (e) {
        logger.error("fileProcessNod error:", e);
        enableDeploy()
    }


}


/**
 *
 * @param type
 * @param filename
 * @param hash
 * @returns {string}
 */
function getDownloadFilePath(filename, hash) {
    let filePath = pathConstants.FILE_DOWNLOAD_PATH + hash + "/" + filename;
    return filePath;
}

function isDeploying() {
    return deploySyncFlag;
}

function disableDeploy() {
    deploySyncFlag = true;
}

function enableDeploy() {
    deploySyncFlag = false;
}


function generateSign(param) {

    if (utils.isNull(param)) {
        param = {};
    }

    var keys = Object.keys(param).sort();
    logger.debug("param keys sort",keys);
    let res = "";
    for (let t=0;t<keys.length;t++) {
        if (t ==0) {
            res = keys[t]+"="+param[keys[t]];
        } else {
            res = res+"&"+keys[t]+"="+param[keys[t]];
        }
    }

    //add sk
    res = res+"&key="+ constants.PRIVATE_KEY;

    logger.debug("param res:",res);

    let sign = hashUtil.calcMd5(res);
    logger.debug("param sign:",sign);
    param.sign = sign;
    delete param["key"];
    logger.debug("param:",param);
    return param;
}

/**
 *
 * @returns {boolean}
 */
function needCheckNod() {
    if (enableRestart == 1) {
        return true;
    }

    return false;
}

/**
 *
 * @returns {boolean}
 */
function needSyncUserRes() {
    if (enableSyncUserRes == 1) {
        return true;
    }

    return false;
}


/**
 *
 * @returns {boolean}
 */
function needSyncUserResByBlock() {
    if (enableSyncUserResByBlock == 1) {
        return true;
    }

    return false;
}

/**
 *
 * @returns {boolean}
 */
function needSyncUgas() {
    if (enableSyncUgas == 1) {
        return true;
    }

    return false;
}

async function pm2LogFlush() {
    logger.info("pm2LogFlush");
    await ShellCmd.execCmd("pm2 flush");
}

/**
 *
 * @returns {number}
 */
function getSyncBlockHeaderMaxTranNum() {
    return syncBlockHeaderMaxTranNum;
}

function setHeadBlockNum(num) {
    head_block_num = num;
}

function setHashInfo(block,hash) {
    ws_block_height = block;
    ws_hash = hash;
}

function getConfirmBlockMaster() {
    return confirmBlockMaster;
}

function getConfirmBlockLocal() {
    return confirmBlockLocal;
}

function clearConfirmBlock() {
    confirmBlockMaster = -1;
    confirmBlockLocal = -1;
}

function setConfirmBlockMaster(blockNum) {
    confirmBlockMaster = blockNum;
}

function setConfirmBlockLocal(blockNum) {
    confirmBlockLocal = blockNum;
}

/**
 * 清除日志
 */
function clearLogData() {

    if (logCount < 1000) {
        logger.info("clearLogData(logCount:"+logCount+") is not ready");
        logCount ++;
        return;
    }

    logCount = 0;

    try {
        let cmd = "find "+utils.formatHomePath(chainConfig.configFileData.local.nodLogPath)+" -mindepth 1 -mtime +5 -delete";

        logger.info("clearLogData start:",cmd);
        //其它命令
        process.exec(cmd, async function (error, stdout, stderr, finish) {
            if (error) {
                logger.error("clearLogData error:",error);
            } else {
                logger.info("clearLogData success:");
            }

        });

    } catch (e) {
        logger.error("clearLogData error:",e);
    }

    logger.info("clearLogData end:");
}

/**
 * 上传ram 信息
 * @returns {Promise<void>}
 */
async function uploadRamUsage() {
    logger.info("uploadRamUsage start");

    try {
        let cmd = "ls -ltrt "+utils.formatHomePath("~/.local/share/futureio/wssfuture/data/worldstate/")+" | grep .ws | tail -n 1 | awk '{print $NF}'";
        process.exec(cmd, async function (error, stdout, stderr, finish) {
            if (error) {
                logger.error("uploadRamUsage error:",error);
            } else {
                logger.info("uploadRamUsage success:",stdout);
                let wsFile = stdout;
                logger.info("uploadRamUsage ws file is:",wsFile);
                let calcCmd = utils.formatHomePath("~/workspace/future-core/build/tools/ws2json")+" -o /tmp/ -t -j --in "+utils.formatHomePath("~/.local/share/futureio/wssfuture/data/worldstate/")+wsFile;
                logger.info("calcCmd:",calcCmd);
                let targetFile = "/tmp/account_info.txt"
                let rmTargetFileCmd = "rm /tmp/account_info.txt";
                process.exec(rmTargetFileCmd, async function (error, stdout, stderr, finish) {
                    process.exec(calcCmd, async function (error, stdout, stderr, finish) {
                        if (error) {
                            logger.error(calcCmd+" error:",error);
                        } else {
                            try {
                                logger.info(calcCmd + " success:");
                                logger.info("start to load account_info.txt:", targetFile);
                                if (fs.existsSync(targetFile)) {
                                    logger.info("account_info.txt is found in dir:", targetFile);
                                    let accountInfoJson = JSON.parse(fs.readFileSync(targetFile, "UTF-8"));
                                    //logger.info("accountInfoJson:",accountInfoJson);
                                    let sum = accountInfoJson.length;
                                    logger.info("accountInfoJson sum:", sum);
                                    let maxSum = 10;
                                    let array = [];
                                    for (let i=0;i<accountInfoJson.length;i++) {
                                        let obj = accountInfoJson[i];
                                        array.push(obj);
                                        if ((i % maxSum == 0 && i > 0) || i >= accountInfoJson.length-1) {
                                            logger.info("array("+i+"):",array);
                                            let rs = await chainApi.ramUsageCheckIn(getMonitorUrl(),generateSign({
                                                chainName : chainConfig.localChainName,
                                                chainId: chainConfig.chainId,
                                                dataJson : JSON.stringify(array)
                                            }));
                                            logger.info("ramUsageCheckIn rs:",rs);
                                            array = [];
                                        }
                                    }
                                } else {
                                    logger.error("account_info.txt is not found in dir:", targetFile);
                                }

                            } catch (e) {
                                logger.error("uploadRamUsage error,",e);
                            }

                        }
                    });
                });
            }

        });



    } catch (e) {
        logger.error("uploadRamUsage error,",e);
    }


}


/**
 *
 * @returns {Promise<void>}s
 */
async function logrotate() {
    logger.info("logrotate start");
    try {

        if (chainUtil.randomRato(0.2) == false) {
            logger.info("logrotate random failed");
            return;
        } else {
            logger.info("logrotate random success");
        }

        let conf = "/etc/logrotate.d/future-logrotate.conf";

        if (fs.existsSync(conf)) {
            fs.unlinkSync(conf);
        }

        let echoCmd = "echo \"/log/*.log\\n { size 500M\\n copytruncate\\n rotate 10\\n  maxage 100\\n }\\n\" >> " + conf;
        let logrotate = "logrotate " + conf;

        process.exec(echoCmd, async function (error, stdout, stderr, finish) {
            if (error) {
                logger.error("echoCmd(" + echoCmd + ") error:", error);
            } else {
                logger.info("echoCmd(" + echoCmd + ") success:");
            }

            process.exec(logrotate, async function (error, stdout, stderr, finish) {

                if (error) {
                    logger.error("logrotateCmd(" + logrotate + ") error:", error);
                } else {
                    logger.info("logrotateCmd(" + logrotate + ") success:");
                }

            });

        });

    } catch (e) {
        logger.error("logrotate error:", e);
    }

    logger.info("logrotate end");
}

/**
 * 设置启动错误信息
 * @param msg
 */
function setErrorStartup(msg) {
    errorStartUpMsg = msg;
}



/**
 * 上传ugas
 * @returns {Promise<void>}
 */
async function uploadUgasToMonitor() {
    logger.info("uploadUgasToMonitor start");
    try {
        var timestamp = new Date().getTime();
        logger.info("uploadUgasToMonitor timestamp:", timestamp);

        //获取发行信息
        try {
            let resIssue = await chainApi.getCurrencyStats(chainConfig.getLocalHttpEndpoint());
            logger.info("res Issue res:", resIssue.FGAS);
            let param = {
                chainName: chainConfig.localChainName,
                maxSupply: resIssue.FGAS.max_supply.replace(" FGAS", ""),
                supply: resIssue.FGAS.supply.replace(" FGAS", ""),
                issuer: resIssue.FGAS.issuer,
            }
            let resUpload = await chainApi.uploadCurrency(getMonitorUrl(), generateSign(param))
        } catch (e) {
            logger.error("getCurrencyStats error:", e);
        }

        //如果是主链的话上传对应子链的几个转账case
        if (chainConfig.isMainChain()) {
            let array = [];
            let res = await chainApi.getTableAllData(chainConfig.configSub, "futio.bank", "futio.bank", "chainbalance", "chain_name");
            logger.info("chainbalance info:", res);
            for (let i = 0; i < res.rows.length; i++) {
                array.push({chainName: res.rows[i].chain_name, balance: res.rows[i].balance.replace(" FGAS", "")});
            }
            logger.info("chainbalance data:",array);
            let param = {
                baseChainName : constants.chainNameConstants.MAIN_CHAIN_NAME,
                strList :JSON.stringify(array),
            }
            let rs = await chainApi.uploadChainBalance(getMonitorUrl(),generateSign(param));
            logger.info("uploadChainBalance rs:", rs);
        }

        let res = await chainApi.getTableAllScopeData(chainConfig.configSub, "futio.token", null, "accounts", "scope");
        //logger.info("ugas account:",res.rows);
        logger.info(res.rows.length);
        let list = [];
        //单次上传用户信息数
        let count = 200;
        for (let i = 0; i < res.rows.length; i++) {
            try {
                //logger.info("i("+i+") :",res.rows[i].scope);
                let table = await chainApi.getTableInfo(chainConfig.configSub.httpEndpoint, "futio.token", res.rows[i].scope, "accounts", 10);
                //logger.info("res table",table);
                list.push({a: res.rows[i].scope, m: table.rows[0].balance.replace(" FGAS", "")});

                if (list.length > 0 && list.length % count == 0) {
                    let param = {
                        chainName: chainConfig.localChainName,
                        list: JSON.stringify(list),
                        tag: timestamp
                    }

                    let rs = await chainApi.uploadugas(getMonitorUrl(), generateSign(param));
                    logger.info("uploadugas rs:", rs);
                    list = [];
                }
            } catch (e) {
                logger.error("uploadUgasToMonitor single error:", e)
            }
        }

        let param = {
            chainName: chainConfig.localChainName,
            list: JSON.stringify(list),
            tag: timestamp,
            end: 1
        }

        let rs = await chainApi.uploadugas(getMonitorUrl(), generateSign(param));
        logger.info("uploadugas rs:", rs);

    } catch (e) {
        logger.error("uploadUgasToMonitor error:", e);
    }


    logger.info("uploadUgasToMonitor end");
}

/**
 * 上传矿工未打卡离线节点
 * @returns {Promise<void>}
 */
async function uploadHbOfflineToMonitor() {
    logger.info("uploadHbOfflineToMonitor start");
    try {
        var timestamp = new Date().getTime();
        //使用管家来上传该信息
        let array = [];
        let distabObj = await chainApi.getTableAllDataEx(chainConfig.config, "futureio", "futureio", "disableprods", "owner");
        let res = distabObj.res;
        if( distabObj.err != null ) {
            logger.error("uploadHbOfflineToMonitor get disableprods error not upload,distabObj.err:",distabObj.err);
            return;
        }
        logger.debug("uploadHbOfflineToMonitor disableprods info:", res);
        let cons_staked_value = 42000;
        if ( utils.isNotNull(chainConfig.configFileData.local.stakedthreshold) && parseInt(chainConfig.configFileData.local.stakedthreshold) > 0 ){
            cons_staked_value = parseInt(chainConfig.configFileData.local.stakedthreshold);
        }
        let should_committee_prod_map = new Map();
        for (let i = 0; i < res.rows.length; i++) {
            if ( parseInt(res.rows[i].total_cons_staked)/10000 >= cons_staked_value  ) {
                should_committee_prod_map.set( res.rows[i].owner, parseInt(res.rows[i].total_cons_staked)/10000 );
            }
        }
        logger.info("uploadHbOfflineToMonitor should_committee_prod_map data:",should_committee_prod_map);
        let brieftabObj = await chainApi.getTableAllDataEx(chainConfig.config, "futureio", "futureio", "briefprod", "owner");
        let briefprodRes = brieftabObj.res;
        if( brieftabObj.err != null ) {
            logger.error("uploadHbOfflineToMonitor get briefprodRes error not upload,brieftabObj.err:",brieftabObj.err);
            return;
        }
        logger.debug("uploadHbOfflineToMonitor briefprodRes info:", briefprodRes);
        for (let i = 0; i < briefprodRes.rows.length; i++) {
            if ( parseInt(briefprodRes.rows[i].in_disable) == 1 && should_committee_prod_map.has(briefprodRes.rows[i].owner) && briefprodRes.rows[i].location == chainConfig.localChainName ) {
                array.push({a: briefprodRes.rows[i].owner, m: should_committee_prod_map.get(briefprodRes.rows[i].owner)});
            }
        }

        let param = {
            chainName: chainConfig.localChainName,
            list: JSON.stringify(array),
            tag: timestamp,
            end: 1
        }
        let rs = await chainApi.uploadHbOfflineProd(getMonitorUrl(),generateSign(param));
        logger.info("uploadHbOfflineToMonitor rs:", rs," array:",array);

    } catch (e) {
        logger.error("uploadHbOfflineToMonitor error:", e);
    }
    logger.info("uploadHbOfflineToMonitor end");
}


/**
 * 上传块头信息
 * @returns {Promise<void>}
 */
async function uploadBlockToMonitor() {
    logger.info("uploadBlockToMonitor start");
    try {
        var timestamp = new Date().getTime();
        logger.info("uploadBlockToMonitor timestamp:", timestamp);

        //获取该链最大block
        let param = {
            chainName : chainConfig.localChainName
        }


        let baseBlock = 0;
        let headBlockNum = 0;
        let maxBlockNum = 200;

        let tranArray = [];

        let res = await chainApi.getMaxBlock(getMonitorUrl(),generateSign(param));
        headBlockNum = await chainApi.getHeadBlockNum(chainConfig.nodPort);
        if (utils.isNull(res.data.blockNum) || utils.isNull(headBlockNum)) {
            logger.error("base block is null("+baseBlock+") or headBlockNum is null("+headBlockNum+")");
        } else {
            baseBlock = res.data.blockNum;
            logger.info("get max block num is :",baseBlock);
            logger.info("get head block num is :",headBlockNum);
            let distanceNum = headBlockNum - baseBlock;
            logger.info("distanceNum is :",distanceNum);
            if (distanceNum >= maxBlockNum) {
                distanceNum = maxBlockNum;
            }

            let startBlock = baseBlock+1;
            let endBlock = baseBlock+distanceNum;

            logger.info("start to upload block("+startBlock+"-"+endBlock+")");

            let i = startBlock;
            let blockList = [];
            while (i<=endBlock) {
                let blockInfo = await chainApi.getBlockInfoData(chainConfig.getLocalHttpEndpoint(),i);
                let time = blockInfo.timestamp.toString().substr(0,10)+" "+blockInfo.timestamp.toString().substr(11,8);
                i++;
                let blockObj = {
                    chainName : chainConfig.localChainName,
                    proposer:blockInfo.proposer,
                    previous:blockInfo.previous,
                    block_num:blockInfo.block_num,
                    hash:blockInfo.id,
                    trxNum:blockInfo.transactions.length,
                    timestamp:time,
                }

                logger.debug("blockObj :",blockObj);
                blockList.push(blockObj);

                //找出块中有的特殊交易，并准备发送到
                let tranList = chainUtil.getAlertTranFromBlock(blockInfo,chainConfig.localChainName);
                if (tranList.length > 0) {
                    logger.debug("tranList :", tranList);
                    tranList.forEach(value => {
                        tranArray.push(value);
                    })

                }
            }

            logger.debug("blockList :",blockList);


            logger.info("tranArray length:",tranArray.length);
            //logger.info("tranArray :",tranArray);


            //上传问题交易
            let tranRes = false;
            if (tranArray.length > 0) {
                let paramTran = {
                    list: JSON.stringify(tranArray)
                }

                let resTran = await chainApi.uploadAlertTran(getMonitorUrl(), generateSign(paramTran));
                logger.info("resTran:",resTran);
                if (resTran.code == 0) {
                    tranRes = true;
                }
            } else {
                tranRes = true;
            }

            //上传块
            if (tranRes) {
                let param = {
                    chainName: chainConfig.localChainName,
                    list: JSON.stringify(blockList)
                }
                let resBlock = await chainApi.uploadBlockLIst(getMonitorUrl(), generateSign(param));
                logger.info("upload block res:", resBlock);
            }
        }

    } catch (e) {
        logger.error("uploadBlockToMonitor error:", e);
    }


    logger.info("uploadBlockToMonitor end");
}


/**
 * 上传claim reward信息
 * @returns {Promise<void>}
 */
async function uploadClaimRecordToMonitor() {
    logger.info("uploadClaimRecordToMonitor start");
    try {
        let baseDir = chainConfig.configFileData.local.claimDir;
        let claimDay = chainConfig.configFileData.local.claimDay;
        if (utils.isNull(claimDay)) {
            claimDay = utils.getTodayString();
        }

        let filenpath = baseDir +"/"+claimDay+"_record.json";
        logger.info("record json path :",filenpath);
        if (fs.existsSync(filenpath) == false) {
            logger.error("json file not exits:"+filenpath);
            return;
        }

        logger.info("json file exits:"+filenpath);

        let recordObjStr = fs.readFileSync(filenpath, constants.encodingConstants.UTF8);
        let recordObj = JSON.parse(recordObjStr);
        let dataList = recordObj.data;
        logger.info("claim file time:"+recordObj.time+" producerList:"+dataList.length);



        let maxCount = 100;
        let list = [];
        for (let i=0;i<dataList.length;i++) {

            if (i % maxCount == 0  ) {
                list = [];
            }

            let dataObj = dataList[i];
            list.push(dataObj);

            if (list.length  == maxCount || i == dataList.length -1) {
                let param = {
                    time : recordObj.time,
                    list : JSON.stringify(list)
                }

                logger.info("param:",param);
                let res = await chainApi.uploadClaimRecord(getMonitorUrl(),generateSign(param));
            }

        }

    } catch (e) {
        logger.error("uploadClaimRecordToMonitor error", e);
    }
}

/**
 * 是否开启同步服务
 * @returns {boolean}
 */
function needSyncService() {
    if (enableSyncService == 1) {
        return true;
    }

    return false;
}



module.exports = {
    checkIn,
    isDeploying,
    disableDeploy,
    enableDeploy,
    buildParam,
    getMonitorUrl,
    generateSign,
    needCheckNod,
    needSyncUserRes,
    pm2LogFlush,
    needSyncUgas,
    needSyncUserResByBlock,
    getSyncBlockHeaderMaxTranNum,
    setHeadBlockNum,
    setHashInfo,
    getConfirmBlockLocal,
    getConfirmBlockMaster,
    setConfirmBlockLocal,
    setConfirmBlockMaster,
    clearConfirmBlock,
    checkNeedSync,
    uploadRamUsage,
    logrotate,
    setErrorStartup,
    uploadUgasToMonitor,
    uploadHbOfflineToMonitor,
    uploadBlockToMonitor,
    uploadClaimRecordToMonitor,
    needSyncService,
}
