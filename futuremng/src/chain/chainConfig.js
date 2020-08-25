const {U3} = require('u3.js');
const fs = require('fs');
const ini = require('ini');
const {createU3} = U3;

/**
 * 日志信息
 */
var logger = require("../config/logConfig").getLogger("ChainConfig");
var logUtil = require("../common/util/logUtil")
var constant = require("../common/constant/constants")
var chainNameConstants = require("../common/constant/constants").chainNameConstants
var pathConstants = require("../common/constant/constants").pathConstants
var utils = require("../common/util/utils");
var hashUtil = require("../common/util/hashUtil");
var chainApi = require("./chainApi")
var sleep = require("sleep")
var chainUtil = require("./util/chainUtil")


/**
 * 主侧链相关配置
 */
class ChainConfig {

}

//seep节点配置
ChainConfig.seedIpConfig = [];

//group配置
ChainConfig.groupConfig = "";

//配置文件信息
ChainConfig.configPath = pathConstants.MNG_CONFIG+"config.ini"

//localtest
ChainConfig.localTest = false;

//chain_name- realtime chain name this user belong to
ChainConfig.chainName = "";

//local chainName of this chain
ChainConfig.localChainName = "";

//chain_id
ChainConfig.chainId = "";
//genesisTime
ChainConfig.genesisTime = "";
//genesisPK
ChainConfig.genesisPK = "";
//节点登录的委员会用户信息
ChainConfig.myAccountAsCommitteeList = [];
//委员会私钥
ChainConfig.mySkAsCommitteeList = [];

//账号私钥
ChainConfig.mySkAsAccountList = [];

//主链出一块的时间间隔（默认10000ms）
ChainConfig.mainChainBlockDuration = 10000;

//子链出一块的时间间隔（默认10000ms）
ChainConfig.subChainBlockDuration = 10000;

ChainConfig.nodPort = "8888";




//主链配置
ChainConfig.config = {
    httpEndpoint: "",
    httpEndpoint_history: "",
    keyProvider: [], // WIF string or array of keys..

    chainId: '', // 32 byte (64 char) hex string
    // chainId: '2616bfbc21e11d60d10cb798f00893c2befba10e2338b7277bb3865d2e658f58', // 32 byte (64 char) hex string
    expireInSeconds: 60,
    broadcast: true,
    sign: true,

    debug: false,
    verbose: false,
    logger: {
        level: "error",
        log: logUtil.log,
        error: logUtil.error,
        debug: logUtil.debug
    },
    binaryen: require('binaryen'),
    symbol: 'FGAS',
    seedHttpList:[]
};

//子链配置
ChainConfig.configSub = {
    httpEndpoint: '',
    httpEndpoint_history: '',
    keyProvider: [], // WIF string or array of keys..

    chainId: "", // 32 byte (64 char) hex string
    // chainId: '2616bfbc21e11d60d10cb798f00893c2befba10e2338b7277bb3865d2e658f58', // 32 byte (64 char) hex string
    expireInSeconds: 60,
    broadcast: true,
    sign: true,

    debug: false,
    verbose: false,
    logger: {
        level: "error",
        log: logUtil.log,
        error: logUtil.error,
        debug: logUtil.debug
    },
    binaryen: require('binaryen'),
    symbol: 'FGAS',
    seedHttpList:[]
};

//子链配置
ChainConfig.configTemp = {
    httpEndpoint: '',
    httpEndpoint_history: '',
    keyProvider: [], // WIF string or array of keys..

    chainId: "", // 32 byte (64 char) hex string
    // chainId: '2616bfbc21e11d60d10cb798f00893c2befba10e2338b7277bb3865d2e658f58', // 32 byte (64 char) hex string
    expireInSeconds: 60,
    broadcast: true,
    sign: true,

    debug: false,
    verbose: false,
    logger: {
        log: logUtil.log,
        error: logUtil.error,
        debug: logUtil.debug
    },
    binaryen: require('binaryen'),
    symbol: 'FGAS',
};

/**
 * 主链和子链的u3对象
 */
ChainConfig.u3 = {};
ChainConfig.u3Sub = {};

/**
 * config 配置信息
 * @type {{}}
 */
ChainConfig.configFileData = {};

//配置同步
ChainConfig.syncConfig = async function () {

    try {
        logger.info("start sync config info");

        /**
         * 读取管家程序自己的config文件来读取
         */
        chainUtil.checkFileExist(this.configPath);

        var configIniLocal;
        try {
            configIniLocal = ini.parse(fs.readFileSync(this.configPath, constant.encodingConstants.UTF8));
        } catch (e) {
            logger.error("read futuremng config error",e);
            logger.info("start futuremng use default config ");
            configIniLocal = { prefix: 'http://',
                path: utils.formatHomePath('~/.local/share/futureio/nodfuture/config/config.ini'),
                nodpath: utils.formatHomePath('~'),
                wsspath: utils.formatHomePath('~'),
                mngpath: utils.formatHomePath('~/futuremng/src'),
                randToolsPath: utils.formatHomePath('~/voterand/scripts/rand'),
                localtest: false,
                worldstate: true,
                wsSyncBlock: false,
                monitor: true,
                enableRestart: true,
                seedFileUpdate: true,
                nodLogPath: '/log',
                blockSyncCycle: '*/10 * * * * *',
                chainSyncCycle: '*/60 * * * * *',
                worldstateSyncCycle: '*/60 * * * * *',
                monitorSyncCycle: '*/60 * * * * *' };
        }
        this.configFileData.local = configIniLocal;
        logger.info('configIniLocal=', configIniLocal);


        //读取nodfuture程序中的config.ini
        var configIniTarget
        try {
            configIniTarget = ini.parse(fs.readFileSync(utils.formatHomePath(configIniLocal.path), constant.encodingConstants.UTF8));
        } catch (e) {
            logger.error("read nod config eroor:",e);
            configIniTarget = {
                'monitor-server-endpoint': 'http://172.16.10.4:8078',
                'my-account-as-committee': constant.UNKNOWN_USER,
                'my-sk-as-committee': '111',
                'my-sk-as-account': '111',
                'my-bls-sk': '111',
                'chain-name': 'unknow'
            }
        }

        logger.info('configIniTarget(nodfuture)=', configIniTarget);
        this.configFileData.target = configIniTarget;

        logger.debug("this.configFileData data:", this.configFileData);

        /**
         * 获取配置中localtest配置
         */
        if (utils.isNotNull(configIniLocal["localtest"])) {
            this.localTest = configIniLocal["localtest"];
        }

        logger.info("env: (localtest:" + this.localTest + ")");

        /**
         * 通过nodfuture的配置信息获取主子链的用户信息
         */
        this.myAccountAsCommitteeList = configIniTarget["my-account-as-committee"].split(",");
        this.mySkAsCommitteeList = configIniTarget["my-sk-as-committee"].split(",");
        this.mySkAsAccountList = configIniTarget["my-sk-as-account"].split(",");

        logger.info("config this.myAccountAsCommitteeList: ", this.myAccountAsCommitteeList);
        logger.info("config this.mySkAsCommitteeList: ", this.mySkAsCommitteeList);
        logger.info("config this.mySkAsAccountList: ", this.mySkAsAccountList);

        try {

            this.localChainName = this.configFileData.target["chain-name"];
            logger.info("get chainName form config : ",this.localChainName);

            this.printNodInfo();

            /**
             * check seed config is not null
             */
            if (this.seedIpConfig.length == 0) {
                logger.error("seed info is null,reload again");
                await this.syncSeedIpConfig();
                if (this.seedIpConfig.length ==0) {
                    logger.error("seed info is still null");
                    return;
                }
            }

            /**
             * check group config in null
             * @type {Array}
             */
            if (utils.isNull(this.groupConfig) == true) {
                logger.error("groupConfig is null");
                return;
            }

            this.config.seedHttpList = await  chainApi.getChainHttpListByGroup(constant.chainNameConstants.MAIN_CHAIN_NAME,this);
            let randomSeed = this.randomSeed("0",this.myAccountAsCommitteeList[0],this.config.seedHttpList);
            logger.info("random mainchain seed :",randomSeed);
            if (utils.isNotNull(randomSeed)) {
                this.config.httpEndpoint = randomSeed;
            }

            this.configSub.seedHttpList= await chainApi.getChainHttpListByGroup(this.localChainName,this);
            randomSeed = this.randomSeed(this.localChainName,this.myAccountAsCommitteeList[0],this.configSub.seedHttpList);
            logger.info("random subchain seed :",randomSeed);
            if (utils.isNotNull(randomSeed)) {
                this.configSub.httpEndpoint = randomSeed;
            }

            this.config.chainId = await chainApi.getChainIdByAllSeed(this.config,this.config.seedHttpList);
            logger.info("config.chainId=", this.config.chainId);
            this.configSub.chainId = await chainApi.getChainIdByAllSeed(this.configSub,this.configSub.seedHttpList);
            logger.info("configSub.chainId=", this.configSub.chainId);

            mainChainBlockDuration = await chainApi.getChainBlockDuration(this.config);
            if (utils.isNotNull(mainChainBlockDuration)) {
                this.mainChainBlockDuration = mainChainBlockDuration;
            }
            logger.info("mainChainBlockDuration:",this.mainChainBlockDuration);
            subChainBlockDuration = await chainApi.getChainBlockDuration(this.configSub);
            logger.info("subChainBlockDuration:",this.subChainBlockDuration);
            if (utils.isNotNull(subChainBlockDuration)) {
                this.subChainBlockDuration = subChainBlockDuration;
            }
            logger.info("subChainBlockDuration:",this.subChainBlockDuration);

            logger.info("this.config:",this.config);
            logger.info("this.configsub:",this.configSub);
        } catch (e) {
            logger.error("target node crashed, check main node or sub node", utils.logNetworkError(e))
        }

        logger.debug("init u3 and u3Sub from config");
        this.u3 = createU3({...this.config, sign: true, broadcast: true});
        this.u3Sub = createU3({...this.configSub, sign: true, broadcast: true});

        logger.info("finish sync config info");

        return true;
    } catch
        (e) {
        logger.error("sync chain config error: ", e);
    }

    return false;
}

/**
 *
 * @param chainId
 * @param user
 * @param seedList
 * @returns {*}
 */
ChainConfig.randomSeed = function(chainName,user,seedList) {
    let str = chainName+"-"+user;
    let length = seedList.length;
    if (length <= 0) {
        return null;
    }

    if (length == 1) {
        return seedList[0];
    }

    let md5 = hashUtil.calcMd5(str);
    var firstChar = md5.toString().substr(0,1);
    let num =  firstChar.charCodeAt()%length;

    return seedList[num];
}

/**
 * 检查链的配置已经初始化成功了
 */
ChainConfig.isReady = function () {

    let res = {
        result : false,
        msg : ""
    }


    //校验主链的id
    // if (!utils.isAllNotNull(this.config.chainId)) {
    //     logger.error("chainconfig main chainId  is null");
    //     return false;
    // }

    //用户信息为空
    if (!utils.isAllNotNull(this.myAccountAsCommitteeList[0], this.mySkAsCommitteeList[0]) || this.myAccountAsCommitteeList[0] == constant.UNKNOWN_USER) {
        logger.error("chainconfig user account is null,please check config.ini file is ready.....");
        res.msg = "chainconfig user account is null,please check config.ini file is ready.....";
        return res;
    }

    /**
     * u3 object
     */
    if (!utils.isAllNotNull(this.u3, this.u3Sub)) {
        logger.error("chainconfig u3 && u3Sub is not ready");
        res.msg = "chainconfig u3 && u3Sub is not ready";
        return res;
    }

    //链信息查询
    if (this.localChainName == null) {
        logger.error("chainName can't be null:"+this.configSub.localChainName);
        res.msg = "chainName can't be null:"+this.configSub.localChainName;
        return res;
    }

    // logger.error("seed info length can't be null:",this.seedIpConfig.length);

    //seed为空
    if (utils.isNull(this.seedIpConfig) || this.seedIpConfig.length <= 0 || this.seedIpConfig.toString().length <= 20) {
        logger.error("seed info can't be null:",this.seedIpConfig);
        res.msg = "seed info can't be null:";
        return res;
    }

    //group为空
    if (utils.isNull(this.groupConfig)) {
        logger.error("group info can't be null:",this.groupConfig);
        res.msg = "group info can't be null:";
        return res;
    }

    // if (this.configSub.chainId == null) {
    //     logger.error("(this.configSub.chainId can't be null:"+this.configSub.chainId);
    //     return false;
    // }

    res.result = true;
    return res;
}

/**
 * 轮询保证配置已经同步了
 * @returns {Promise<void>}
 */
ChainConfig.waitSyncConfig = async function () {
    await this.syncConfig();
    while (!this.isReady()) {
        sleep.msleep(1000 * 10);
        await this.syncConfig();
        logger.info("config is not ready ,wait to next check...")
    }
}

//同步seedip config
ChainConfig.syncSeedIpConfig = function () {
    try {
        var filepath = pathConstants.MNG_CONFIG+"seedconfig.json";
        //logger.info("seed ip config :", filepath);
        chainUtil.checkFileExist(filepath)
        var data = fs.readFileSync(filepath, constant.encodingConstants.UTF8);
        if (utils.isNotNull(data)) {
            data = chainApi.formartDataFromMonitor(data);
            this.seedIpConfig = data;
            logger.debug("seedIpConfig:", JSON.stringify(this.seedIpConfig));
        }

        //sync group
        let groupFilepath = pathConstants.MNG_CONFIG+constant.filenameConstants.GROUP_FILE;
        let fileExist = chainUtil.checkFileExist(groupFilepath);
        if (fileExist == false) {
            logger.error("groupData file is not exist");
        } else {
            let groupData = fs.readFileSync(groupFilepath, constant.encodingConstants.UTF8);
            if (utils.isNotNull(groupData)) {
                groupData = chainApi.formartDataFromMonitor(groupData);
                this.groupConfig = groupData;
                logger.debug("groupData:", JSON.stringify(this.groupConfig));
            }
        }
    } catch (e) {
        logger.error("syncSeedIpConfig error", e);
    }

}

//目前在正确的子链上
ChainConfig.isInRightChain = function () {

    logger.info("this,chainid:"+this.chainId+" this.configSub.chainId:"+this.configSub.chainId," localChainName:",this.localChainName);
    //主链未同步到我属于子链的创世块
    if (constant.chainIdConstants.NONE_CHAIN == this.chainId || utils.isNull(this.chainId)) {
        return true;
    }

    //子链未获取到chainid，比较chainName
    if (utils.isNull(this.configSub.chainId)) {
        logger.error("subchain chainis is none : compare chain name:");
        if (this.localChainName == this.chainName) {
            logger.error("chain name(local : "+this.localChainName+", target: "+this.chainName+" ) is equal,i am in right chain");
            return true;
        } else {
            logger.error("chain name(local : "+this.localChainName+", target: "+this.chainName+" ) is not equal, i am in wrong chain");
        }

    }

    if (this.chainId == this.configSub.chainId) {
        return true;
    }

    return false;

}

//判断是出块节点
ChainConfig.isProducer = function () {
    return !this.isNoneProducer();
}

//判断是非出块节点
ChainConfig.isNoneProducer = function () {
    //logger.error(this.configFileData.target);
    logger.info("is-non-producing-node:", this.configFileData.target["is-non-producing-node"]);

    if (this.configFileData.target["is-non-producing-node"] == 1) {
        return true;
    }

    return false;
}

//判断是mongo节点
ChainConfig.isMongo = function () {
    //logger.error(this.configFileData.target);
    logger.info("mongodb-uri:", this.configFileData.target["mongodb-uri"]);

    if (utils.isNotNull(this.configFileData.target["mongodb-uri"])) {
        return true;
    }

    return false;
}

//判断是seed节点
ChainConfig.isSeed = function () {
    //logger.error(this.configFileData.target);
    if (this.isNoneProducer() && !this.isMongo()) {
        return true;
    }

    return false;
}


/**
 * 判断主链
 * @returns {boolean}
 */
ChainConfig.isMainChain = function() {
    return chainNameConstants.MAIN_CHAIN_NAME == this.localChainName;
}



ChainConfig.syncSeedIpConfig();

ChainConfig.clearChainInfo = function() {
    this.localChainName = null;
}

ChainConfig.getLocalHttpEndpoint = function() {
    return "http://127.0.0.1:"+this.nodPort;
}

/**
 *
 * @param key
 * @param defaultValue
 * @returns {*}
 */
ChainConfig.getLocalConfigInfo = function(key,defaultValue) {
    if (utils.isNotNull(this.configFileData.local[key])) {
        return this.configFileData.local[key];
    }

    return defaultValue;
}

/**
 * 打印节点信息
 */
ChainConfig.printNodInfo = function() {
    if (this.isProducer()) {
        logger.info(this.myAccountAsCommitteeList+" is a producer");
    }

    if (this.isSeed()) {
        logger.info(this.myAccountAsCommitteeList+" is a seed");
    }

    if (this.isMongo()) {
        logger.info(this.myAccountAsCommitteeList+" is a mongo");
    }
}


module.exports = ChainConfig
