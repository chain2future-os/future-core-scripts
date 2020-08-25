var chain = require("./chain/chain")
var chainSyncService = require("./chain/chainSyncService")
var monitor = require("./chain/monitor")
var chainConfig = require("./chain/chainConfig")
var syncNewChainService = require("./chain/syncNewChain")
var logger = require("./config/logConfig").getLogger("SideChainService");
const schedule = require('node-schedule');
var sleep = require("sleep")
var utils = require('./common/util/utils')

//定时配置
var singleJobSchedule = "*/10 * * * * *";

//清除pm2 日志(每2小时）
var logJobSchedule = "0 0 */2 * * *";

//清除链信息缓存(每2小时）
var clearCacheSchedule = "0 30 */2 * * *";

//上传ram信息
var ramJobSchedule = "0 0 3 * * *";

//logrotate调度（每1小时）
var logrotateSchedule = "0 24 */1 * * *";

/**
 * 管家程序入口
 * @returns {Promise<void>}
 */
async function startEntry() {

    logger.info("Futuremng start to work:");


    logger.info("waiting sync config data....");
    //等待配置信息同步完成
    await chainConfig.syncConfig();
    let count = 0;
    let res = chainConfig.isReady();
    while (res.result == false) {
        logger.error("chainConfig.isReady error:",res.msg);
        count++;
        sleep.msleep(1000 * 1);
        await chainConfig.syncConfig();
        logger.info("config is not ready ,wait to next check...("+count+")");
        monitor.setErrorStartup(res.msg);
        if (count >= 10) {
            count =0;
            logger.info("config is not ready,do monitor check");
            await monitor.checkIn();
            sleep.msleep(1000 * 1);
            await chainConfig.syncConfig();
        }
        res = chainConfig.isReady();
    }
    logger.info("sync config success");

    //定时同步时间
    var syncBlockSchedule = utils.isNotNull(chainConfig.configFileData.local.blockSyncCycle) ?  chainConfig.configFileData.local.blockSyncCycle : singleJobSchedule;
    logger.info("syncBlockSchedule ",syncBlockSchedule);
    var chainSyncCycleSchedule = utils.isNotNull(chainConfig.configFileData.local.chainSyncCycle) ?  chainConfig.configFileData.local.chainSyncCycle : singleJobSchedule;
    logger.info("chainSyncCycleSchedule ",chainSyncCycleSchedule);
    var heartbeatCycleSchedule = utils.isNotNull(chainConfig.configFileData.local.heartbeatCycle) ?  chainConfig.configFileData.local.heartbeatCycle : "*/13 * * * * *";
    logger.info("heartbeatCycleSchedule ",heartbeatCycleSchedule);
    var chainSyncWorldState = utils.isNotNull(chainConfig.configFileData.local.worldstateSyncCycle) ?  chainConfig.configFileData.local.worldstateSyncCycle : singleJobSchedule;
    logger.info("worldstateSyncCycleSchedule ",chainSyncWorldState);

    var monitorSchedule = utils.isNotNull(chainConfig.configFileData.local.monitorSyncCycle) ?  chainConfig.configFileData.local.monitorSyncCycle : singleJobSchedule;
    logger.info("monitorSchedule ",monitorSchedule);

    var pm2logSyncCycle = utils.isNotNull(chainConfig.configFileData.local.pm2logSyncCycle) ?  chainConfig.configFileData.local.pm2logSyncCycle : logJobSchedule;
    logger.info("pm2logSyncCycle ",pm2logSyncCycle);

    var clearCacheSyncCycle = utils.isNotNull(chainConfig.configFileData.local.clearCacheSchedule) ?  chainConfig.configFileData.local.clearCacheSchedule : clearCacheSchedule;
    logger.info("clearCacheSchedule ",clearCacheSchedule);

    var uploadUgasSyncCycle = utils.isNotNull(chainConfig.configFileData.local.uploadUgasSyncCycle) ?  chainConfig.configFileData.local.uploadUgasSyncCycle : "0 */10 * * * *";
    logger.info("uploadUgasSyncCycle ",uploadUgasSyncCycle);
    var uploadHbOfflineSyncCycle = utils.isNotNull(chainConfig.configFileData.local.uploadHbOfflineSyncCycle) ?  chainConfig.configFileData.local.uploadHbOfflineSyncCycle : "0 */9 * * * *";
    logger.info("uploadHbOfflineSyncCycle ",uploadHbOfflineSyncCycle);
    var uploadBlockSyncCycle = utils.isNotNull(chainConfig.configFileData.local.uploadBlockSyncCycle) ?  chainConfig.configFileData.local.uploadBlockSyncCycle : "3 */5 * * * *";
    logger.info("uploadBlockSyncCycle ",uploadBlockSyncCycle);
    var uploadClaimRecordSyncCycle = utils.isNotNull(chainConfig.configFileData.local.uploadClaimRecordSyncCycle) ?  chainConfig.configFileData.local.uploadClaimRecordSyncCycle : "3 1 9 * * *";
    logger.info("uploadClaimRecordSyncCycle ",uploadClaimRecordSyncCycle);

    var syncBlockServiceCycle = utils.isNotNull(chainConfig.configFileData.local.syncBlockService) ?  chainConfig.configFileData.local.syncBlockService : "12 */1 * * * *";
    logger.info("sync block service: ",syncBlockServiceCycle);

    var syncNewChainCycle = utils.isNotNull(chainConfig.configFileData.local.syncNewChain) ?  chainConfig.configFileData.local.syncNewChain : "10 */10 * * * *";
    logger.info("syncNewChainCycle:",syncNewChainCycle, " isSyncNewChain:", chainConfig.configFileData.local.isSyncNewChain);

    var checkSleepStatusCycle = utils.isNotNull(chainConfig.configFileData.local.checkSleepStatusCycle) ?  chainConfig.configFileData.local.checkSleepStatusCycle : "0 */5 * * * *";
    logger.info("checkSleepStatusCycle:",checkSleepStatusCycle);

    //新链检查
    logger.info("syncNewChainCycle is_sync :",chainConfig.configFileData.local.isSyncNewChain," syncNewChainCycle:",syncNewChainCycle);
    if (chainConfig.configFileData.local.isSyncNewChain == true) {
        const j = schedule.scheduleJob(syncNewChainCycle, async function () {
                await syncNewChainService.start();
        });
    }

    //先做一次链信息同步
    logger.info("do sync chain info :")
    await chain.syncChainInfo();
    logger.info("do sync chain info end ")

    //链信息同步-委员会同步
    logger.info("start chain style sync :",chainSyncCycleSchedule)
    schedule.scheduleJob(chainSyncCycleSchedule, async function () {
        //链同步，本地维护员信息同步
         await chain.syncChainInfo();
    });

    //心跳打卡检测
    logger.info("start chain heartbeat check schedule:",heartbeatCycleSchedule)
    schedule.scheduleJob(heartbeatCycleSchedule, async function () {
         await chain.producerHeartBeat();
    });

    //同步块，资源，用户-10s
    logger.info("start syncCommitee,block sync:",syncBlockSchedule)

    //委员会同步
    schedule.scheduleJob(syncBlockSchedule, async function () {
            await chain.syncCommitee();
    });

    //块同步
    schedule.scheduleJob(syncBlockSchedule, async function () {
            await chain.syncBlock();
    });

    //世界状态同步
    logger.info("start world state sync:",chainSyncWorldState)
    schedule.scheduleJob(chainSyncWorldState, async function () {
        await chain.syncWorldState();
        await chain.reportBlockWsHash();
    });

    //monitor同步
    logger.info("monitor sync:",monitorSchedule);
    schedule.scheduleJob(monitorSchedule, async function () {
        await monitor.checkIn();
    });

    //pm2 log清除
    logger.info("pm2 log sync:",pm2logSyncCycle);
    schedule.scheduleJob(pm2logSyncCycle, async function () {
        await monitor.pm2LogFlush();
    });

    logger.info("clearCacheSyncCycle sync:",clearCacheSyncCycle);
    schedule.scheduleJob(clearCacheSyncCycle, async function () {
        await chain.clearCache();
    });

    logger.info("uploadRamUsage enabled flag: ",chainConfig.configFileData.local.uploadRam);
    if (chainConfig.configFileData.local.uploadRam == true) {
        logger.info("upload ram info:",ramJobSchedule);
        schedule.scheduleJob(ramJobSchedule,async function () {
            await monitor.uploadRamUsage();
        });
    }

    logger.info("uploadUgasToMonitor enabled flag: ",chainConfig.configFileData.local.uploadUgas);
    if (chainConfig.configFileData.local.uploadUgas == true) {
        logger.info("upload ugas info:",uploadUgasSyncCycle);
        schedule.scheduleJob(uploadUgasSyncCycle,async function () {
            await monitor.uploadUgasToMonitor();
        });
    }

    logger.info("uploadHbOfflineToMonitor enabled flag: ",chainConfig.configFileData.local.uploadHbOffline);
    if (chainConfig.configFileData.local.uploadHbOffline == true) {
        logger.info("upload HbOffline info:",uploadHbOfflineSyncCycle);
        schedule.scheduleJob(uploadHbOfflineSyncCycle,async function () {
            await monitor.uploadHbOfflineToMonitor();
        });
    }

    logger.info("uploadBlockToMonitor enabled flag: ",chainConfig.configFileData.local.uploadBlock);
    if (chainConfig.configFileData.local.uploadBlock == true) {
        logger.info("upload block info:",uploadBlockSyncCycle);
        schedule.scheduleJob(uploadBlockSyncCycle,async function () {
            await monitor.uploadBlockToMonitor();
        })
    }

     logger.info("uploadClaimRecordToMonitor enabled flag: ",chainConfig.configFileData.local.uploadClaimReward);
    if (chainConfig.configFileData.local.uploadClaimReward == true) {
        logger.info("uploadClaimRecordSyncCycle:",uploadClaimRecordSyncCycle);
        schedule.scheduleJob(uploadClaimRecordSyncCycle,async function () {
            await monitor.uploadClaimRecordToMonitor();
        })
    }

    logger.info("sync block service:",syncBlockServiceCycle);
    schedule.scheduleJob(syncBlockServiceCycle,async function () {
        await chainSyncService.start();
    })
    await chainSyncService.start();


    logger.info("logrotate info:",logrotateSchedule);
    schedule.scheduleJob(logrotateSchedule,async function () {
        await monitor.logrotate();
    })

    if (utils.isNull(chainConfig.configFileData.local.maxServerSleepTimeMs)) {
        chainConfig.configFileData.local.maxServerSleepTimeMs = 10 * 60 * 1000; //最大允许睡眠十分钟
    }
    logger.info("start checkSleepStatus isCheckSleepStatus:",chainConfig.configFileData.local.isCheckSleepStatus," checkSleepStatusCycle:",checkSleepStatusCycle, " maxServerSleepTimeMs:",chainConfig.configFileData.local.maxServerSleepTimeMs);
    if (chainConfig.configFileData.local.isCheckSleepStatus == true) {
        await chain.checkSleepStatusTimer();
        schedule.scheduleJob(checkSleepStatusCycle,async function () {
            await chain.checkSleepStatusTimer();
        })
    }
}

startEntry();

