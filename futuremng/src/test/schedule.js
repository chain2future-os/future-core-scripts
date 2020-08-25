var WorldState = require('../worldstate/worldstate');
var NodFuture = require('../nodfuture/nodfuture');
var utils = require('../common/util/utils');
var async = require('async');
var sleep = require('sleep')
var chainApi = require('../chain/chainApi')
var chainConfig = require('../chain/chainConfig')
var logger = require("../config/logConfig").getLogger("schedule")

async function changing(chainId) {

    //停止nod程序
    let result = await NodFuture.stop(2000);
    if (result) {
        logger.info("nod is stopped");
    } else {
        logger.info("nod is not stopped");
    }

    //停止worldstate的程序
    result = await WorldState.stop(2000);
    if (result) {
        logger.info("worldstate is stopped");
    } else {
        logger.info("worldstate is not stopped");
    }

    //删除block和shared_memory.bin数据
    await NodFuture.removeData();
    logger.info("remove block data and shared_memory.bin");

    //清除世界状态数据
    await WorldState.clearDB();
    logger.info("remove worldstate data files");

    //通过chainid拿到seedList
    var seedIpInfo = await chainApi.getChainSeedIP(chainId, chainConfig);
    logger.info("get chainid(" + chainId + ")'s seed ip info:", seedIpInfo);
    if (utils.isNull(seedIpInfo)) {
        logger.error("seed ip info is null");
        return;
    }

    //设置worldstate的config.ini
    result = WorldState.updateConfig(chainId.seedIpInfo);
    if (result == true) {
        logger.info("update world state config ini success");
    } else {
        logger.error("update world state config ini error");
    }

    //调用世界状态程序同步数据
    logger.info("call worldstate to sync data....")
    sleep.msleep(1000);
    logger.info("call worldstate to sync data success")

    //修改nod程序配置信息
    result = await NodFuture.updateConfig(seedIpInfo,false,await chainApi.getSubchanEndPoint(chainId));
    if (result == true) {
        logger.info("update nod config file success")
    } else {
        logger.error("update nod config file error")
    }

    //启动nod
    result = await NodFuture.start(2000);
    if (result == true) {
        logger.info("nod start success")
    } else {
        logger.error("node start error");
    }

}


changing();
