var logger = require("../../config/logConfig").getLogger("ChainUtil")
var utils = require('../../common/util/utils')
const fs = require('fs');
var process = require('child_process');
var constants = require('../../common/constant/constants')
var contractConstants = require('../../common/constant/constants').contractConstants
var chainNameConstants = require('../../common/constant/constants').chainNameConstants
var actionConstants = require('../../common/constant/constants').actionConstants
var chainApi = require("../chainApi")
var rand = require('random-lib')
var url = require('url');

/**
 * 创世时间格式化
 * @param time
 * @returns {*|void|string|never}
 */
function formatGensisTime(time) {
    //return time.replace("T"," ");
    return time;
}

/**
 * filepath check exist
 * @param filepath
 * @returns {boolean}
 */
function checkFileExist(filepath) {
    if (fs.existsSync(filepath)) {
        logger.info("filepath exists:", filepath)
        return true;
    }
    logger.error("filepath not exist:", filepath);
    return false;
}

/**
 *
 * @param startBlockNum
 * @param endBlockNum
 * @param blockDuration(unit:second)
 */
function calcBlockDuration(startBlockNum, endBlockNum, blockDuration) {

    if (endBlockNum <= startBlockNum) {
        return 0;
    }

    try {

        let deltaBlockNum = endBlockNum - startBlockNum;
        logger.debug("deltaBlockNum: ", deltaBlockNum);

        let time = deltaBlockNum * blockDuration;
        logger.debug("deltaTime: ", time);

        return time;

    } catch (e) {
        logger.error("calcBlockDuration error,", e)
    }

    return 0;
}

/**
 * 获取ugas同步的交易通过交易列表
 * @param transList
 * @param chainName
 * @returns {Array}
 */
function getUgasTransFromTrans(transList,chainName) {
    let trans = [];
    try {
        if (transList.length > 0) {
            for (let i=0;i<transList.length;i++) {
                let tranInfo = transList[i];
                if (tranInfo.status == "executed") {
                    try {
                        logger.debug("traninfo trx :", tranInfo.trx);
                        logger.debug("traninfo trx actions :", tranInfo.trx.transaction.actions);
                        let actions = tranInfo.trx.transaction.actions;
                        for (let t = 0; t < actions.length; t++) {
                            let action = actions[t];
                            if (action.account == contractConstants.FUTIO_TOKEN && action.name == actionConstants.TRANSFER && action.data.to == contractConstants.FUTIO_BANK && action.data.memo == chainName) {
                                logger.debug("find useful action:", action);
                                logger.debug("find useful tran:", tranInfo);
                                trans.push(tranInfo);
                                break;
                            }
                        }
                    } catch (e) {
                        logger.error("getUgasTransFromTrans error", e);
                    }
                }
            }
        }


    } catch (e) {
        logger.error("getUgasTransFromTrans error",e);
    }

    return trans;
}

/**
 * 通过块信息获取用户授权的交易列表
 * @param blockInfo
 * @param chainInfo
 * @returns {Array}
 */
function getSyncUserTransFromTrans(transList,chainName) {
    let trans = [];
    try {
        if (transList.length > 0) {
            for (let i=0;i<transList.length;i++) {
                let tranInfo = transList[i];
                try {
                    if (tranInfo.status == "executed") {
                        logger.debug("traninfo trx :", tranInfo.trx);
                        logger.debug("traninfo trx actions :", tranInfo.trx.transaction.actions);
                        let actions = tranInfo.trx.transaction.actions;
                        for (let t = 0; t < actions.length; t++) {
                            let action = actions[t];
                            if (action.account == contractConstants.FUTUREIO && action.name == actionConstants.EMPOWER_USER && action.data.chain_name == chainName) {
                                logger.debug("[Sync User]find useful action:", action);
                                logger.debug("find useful tran:", tranInfo);
                                trans.push(tranInfo);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.error("getSyncUserTransFromBlock error",e);
                }
            }
        }


    } catch (e) {
        logger.error("getSyncUserTransFromTrans error", e);
    }

    return trans;
}

/**
 *
 * 获取交易中账户权限更新相关的信息
 * @param transList
 * @returns {Array}
 */
async function getSyncAccPermFromTrans( transList, nodePort, targetChainName ) {
    let trans = [];
    try {
        if (transList.length > 0) {
            for (let i=0;i<transList.length;i++) {
                try {
                    let tranInfo = transList[i];
                    if (tranInfo.status == "executed") {
                        logger.debug("traninfo trx :", tranInfo.trx," targetChainName:",targetChainName);
                        logger.debug("traninfo trx actions :", tranInfo.trx.transaction.actions);
                        let actions = tranInfo.trx.transaction.actions;
                        for (let t = 0; t < actions.length; t++) {
                            let action = actions[t];
                            if ( action.account == contractConstants.FUTUREIO
                                &&( action.name == actionConstants.UPDATE_AUTH || action.name == actionConstants.DELETE_AUTH )
                                &&( targetChainName != chainNameConstants.MAIN_CHAIN_NAME ) ) {
                                let account_name = await chainApi.getAccount( nodePort, action.data.account);
                                if ( !utils.isNull( account_name ) ) {
                                    logger.debug("find useful action:", action);
                                    logger.debug("find useful tran:", tranInfo);
                                    trans.push(tranInfo);
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    logger.error("getSyncAccPermFromTrans error",e);
                }
            }
        }


    } catch (e) {
        logger.error("getSyncAccPermFromTrans error",e);
    }

    return trans;
}

/*
**
* 获取交易中和资源相关的信息
* @param blockInfo
* @param chainInfo
* @returns {Array}
*/
function getSyncResTransFromTrans(transList,chainName) {
    let trans = [];
    try {
        if (transList.length > 0) {
            for (let i=0;i<transList.length;i++) {
                try {
                    let tranInfo = transList[i];
                    if (tranInfo.status == "executed") {
                        logger.debug("traninfo trx :", tranInfo.trx);
                        logger.debug("traninfo trx actions :", tranInfo.trx.transaction.actions);
                        let actions = tranInfo.trx.transaction.actions;
                        for (let t = 0; t < actions.length; t++) {
                            let action = actions[t];
                            if ((action.account == contractConstants.FUTUREIO || action.account == contractConstants.FUTIO_RES)
                                && (action.name == actionConstants.RESOURCE_LEASE || action.name == actionConstants.RESOURCE_TRANSFER)
                                && action.data.location == chainName
                                && action.data.location != chainNameConstants.MAIN_CHAIN_NAME) {
                                logger.info("find useful actionname:", action.name);
                                trans.push(tranInfo);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.error("getSyncResTransFromBlock error",e);
                }
            }
        }


    } catch (e) {
        logger.error("getSyncResTransFromBlock error",e);
    }

    return trans;
}


/**
 *
 * @param blockInfo
 * @param chainName
 * @returns {Array}
 */
function getMoveProdRTransFromBlockHeader(blockInfo,chainName) {
    let trans = [];
    try {
        let transList = blockInfo.transactions;
        if (transList.length > 0) {
            for (let i=0;i<transList.length;i++) {
                try {
                    let tranInfo = transList[i];
                    if (tranInfo.status == "executed") {
                        logger.debug("traninfo trx :", tranInfo.trx);
                        logger.debug("traninfo trx actions :", tranInfo.trx.transaction.actions);
                        let actions = tranInfo.trx.transaction.actions;
                        for (let t = 0; t < actions.length; t++) {
                            let action = actions[t];
                            if (action.account == contractConstants.FUTUREIO && action.name == actionConstants.MOVE_PROD && (action.data.to_chain == chainName || action.data.from_chain == chainName)) {
                                //logger.info("find useful action:", action);
                                logger.info("find useful tran:", tranInfo);
                                trans.push(tranInfo);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.error("getMoveProdRTransFromBlockHeader error",e);
                }
            }
        }


    } catch (e) {
        logger.error("getMoveProdRTransFromBlockHeader error",e);
    }

    return trans;
}


/**
 *
 * @param transList
 * @param chainName
 * @returns {Array}
 */
function getMoveProdRTransFromTrans(transList,chainName) {
    let trans = [];
    try {
        if (transList.length > 0) {
            for (let i=0;i<transList.length;i++) {
                try {
                    let tranInfo = transList[i];
                    if (tranInfo.status == "executed") {
                        logger.debug("traninfo trx :", tranInfo.trx);
                        logger.debug("traninfo trx actions :", tranInfo.trx.transaction.actions);
                        let actions = tranInfo.trx.transaction.actions;
                        for (let t = 0; t < actions.length; t++) {
                            let action = actions[t];
                            if (action.account == contractConstants.FUTUREIO && action.name == actionConstants.MOVE_PROD && (action.data.to_chain == chainName || action.data.from_chain == chainName)) {
                                //logger.info("find useful action:", action);
                                logger.info("find useful tran:", tranInfo);
                                trans.push(tranInfo);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.error("getMoveProdRTransFromTrans error",e);
                }
            }
        }


    } catch (e) {
        logger.error("getMoveProdRTransFromBlockHeader error",e);
    }

    return trans;
}


function transferTrxReceiptBytesToArray(bytes) {

    let array = [];
    try {
        if (bytes.length % 2 == 0) {
            let count = bytes.length / 2;
            let i = 0;
            while (i<count) {
                let str = bytes.substr(i*2,2);
                var num=parseInt(str,16);
                array.push(num);
                i++;
            }
        }

    } catch (e) {
        logger.error("transferTrxReceiptBytesToArray error,",e);
    }

    return array;

}

function transferFreeMemToArray(memStr) {

    let array = [];
    var ValidChars = "0123456789";
    try {
        let number = "";
        for (let i=0;i<memStr.length;i++) {
            let n = memStr[i].trim();
            if (ValidChars.indexOf(n) == -1 || n.length <=0) {
                if (number.length > 0) {
                    array.push(number);
                }
                number = "";
            } else {
                number = number +n;
            }
        }

    } catch (e) {
        logger.error("transferFreeMemToArray error:",e);
    }

    return array;
}

/**
 * 随机概率
 * @param setRatio
 * @returns {boolean}
 */
function randomRato(setRatio) {
    if (setRatio >= 1) {
        return true
    }
    let result = rand.intsSync({min: 1, max: 100, num: 1});
    if (result <= setRatio * 100) {
        return true;
    }

    return false;
}

/**
 *
 * @param url
 * @returns {{proxy: string, path: string, port: number, host: string}}
 */
function parseUrlInfo(downloadurl) {
    let parseInfo = {
        proxy : "http",
        host :"",
        port:80,
        path:""
    }

    try {
        parseInfo.path = url.parse(downloadurl).pathname;
        let host = url.parse(downloadurl).host;
        if (host.indexOf(":") != -1) {
            var array=host.split(":");
            parseInfo.host=array[0];
            parseInfo.port = array[1];
        } else {
            parseInfo.host = host;
        }

        if (downloadurl.indexOf("https") != -1) {
            parseInfo.proxy = "https";
        }
    } catch (e) {
        logger.error("parseUrlInfo error:",e);
    }

    return parseInfo;
}

/**
 * 从ws表里获取一个与块高最接近的世界状态文件信息
 */
function getNearestWsInfoByBlockHeight(data, blockHeight) {
    let wsinfolist = [];
    try {

        if (utils.isNull(data)) {
            return wsinfolist;
        }

        let rows = data.rows;

        if (utils.isNull(rows) || utils.isNullList(rows)) {
            return wsinfolist;
        }

        logger.info("getNearestWsInfoByBlockHeight rows:",data.rows);

        for (var i = rows.length - 1; i >= 0; i--) {
            let obj = rows[i];
            if (utils.isNullList(obj.hash_v) == false) {
                logger.debug("getNearestWsInfoByBlockHeight obj:",obj);
                for (var t = 0; t < obj.hash_v.length; t++) {
                    if (obj.hash_v[t].valid == 1 && obj.block_num <= blockHeight) {
                        let result = {};
                        result.block_num = obj.block_num;
                        result.hash = obj.hash_v[t].hash;
                        result.file_size = obj.hash_v[t].file_size;
                        wsinfolist.push(result);
                        if(wsinfolist.length >= 5) {
                            return wsinfolist;
                        }
                    }
                }
            }

        }

    } catch (e) {
        logger.error("getNearestWsInfoByBlockHeight error:", e);
    }

    return wsinfolist;
}


/**
 * 获取块里所有需要报警的交易信息
 * @param blockObj
 */
function getAlertTranFromBlock(blockInfo, chainName) {
    let trans = [];
    try {
        let transList = blockInfo.transactions;
        if (transList.length > 0) {
            for (let i = 0; i < transList.length; i++) {
                try {
                    let tranInfo = transList[i];
                    if (tranInfo.status == "executed") {
                        logger.debug("traninfo trx :", tranInfo.trx);
                        logger.debug("traninfo trx actions :", tranInfo.trx.transaction.actions);

                        let actions = tranInfo.trx.transaction.actions;

                        for (let t = 0; t < actions.length; t++) {
                            let action = actions[t];
                            //转账交易
                            if (action.account == contractConstants.FUTIO_TOKEN && action.name == actionConstants.TRANSFER) {

                                let transferCount = 0;
                                let fromAccount = "";
                                let toAccount = "";
                                let memo = "";

                                if (utils.isNotNull(action.data.quantity)) {
                                    transferCount = parseInt(action.data.quantity.replace(" FGAS", ""));
                                    fromAccount = action.data.from;
                                    toAccount = action.data.to;
                                    memo = action.data.memo;
                                }

                                //logger.error("blockid("+blockInfo.block_num+")tranid(" + tranInfo.trx.id + ") has transfer trans,count("+transferCount+")");

                                if (transferCount >= constants.TRANSFER_ALERT_COUNT) {
                                    let remark = {
                                        from: fromAccount,
                                        to: toAccount,
                                        memo: memo,
                                        num: transferCount.toString()
                                    }
                                    logger.error("tranid(" + tranInfo.trx.id + ") transfer ugas num(" + transferCount + ") >=" + constants.TRANSFER_ALERT_COUNT);
                                    let tranObj = buildAlertTranObj(chainName, blockInfo.block_num, tranInfo.trx.id, contractConstants.FUTIO_TOKEN, actionConstants.TRANSFER, toAccount, JSON.stringify(remark), constants.alertTranTypeConstants.BIG_AMOUNT_TRANSFER);
                                    trans.push(tranObj);
                                }
                            }

                            //setCode和setabi操作
                            if (action.account == contractConstants.FUTUREIO && (action.name == actionConstants.SETCODE || action.name == actionConstants.SETAPI)) {
                                let operateAccount = action.data.account;
                                if (isSystemAccount(operateAccount) == true) {
                                    logger.info("find set abi / set code blockNum(" + blockInfo.block_num + ") account(" + operateAccount + ") is  system account");
                                    //add to tran array
                                    let tranObj = buildAlertTranObj(chainName, blockInfo.block_num, tranInfo.trx.id, action.account, action.name, operateAccount, "{}", constants.alertTranTypeConstants.SET_CODE_OR_API);
                                    trans.push(tranObj);
                                } else {
                                    logger.info("find set abi / set code blockNum(" + blockInfo.block_num + ") account(" + operateAccount + ") is not system account");
                                }
                            }

                            //regproducer/delegatecons/undelegatecons
                            if (action.account == contractConstants.FUTUREIO && (action.name == actionConstants.REG_PRODUCER || action.name == actionConstants.DELEGATE_CONS || action.name == actionConstants.UN_DELEGATE_CONS)) {

                                let operateAccount = "";
                                let remark = "";

                                if (action.name == actionConstants.REG_PRODUCER) {
                                    operateAccount = action.data.producer;
                                }

                                if (action.name == actionConstants.DELEGATE_CONS) {
                                    operateAccount = action.data.receiver;

                                    remark = JSON.stringify({
                                        from: action.data.from,
                                        receiver: action.data.receiver,
                                        stake_cons_quantity: action.data.stake_cons_quantity,
                                    });
                                }


                                if (action.name == actionConstants.UN_DELEGATE_CONS) {
                                    operateAccount = action.data.receiver;

                                    remark = JSON.stringify({
                                        from: action.data.from,
                                        receiver: action.data.receiver,
                                    });
                                }

                                logger.info("set producer related blockNum(" + blockInfo.block_num + ") action(" + action.name + ")");
                                //add to tran array
                                let tranObj = buildAlertTranObj(chainName, blockInfo.block_num, tranInfo.trx.id, action.account, action.name, operateAccount, remark, constants.alertTranTypeConstants.PRODUCER_INFO);
                                trans.push(tranObj);
                            }

                            //updateauth/deleteauth/linkauth/unlinkauth
                            if (action.account == contractConstants.FUTUREIO && (action.name == actionConstants.UPDATE_AUTH || action.name == actionConstants.DELETE_AUTH || action.name == actionConstants.LINK_AUTH || action.name == actionConstants.UNLINK_AUTH)) {
                                let operateAccount = action.data.account;
                                if (isSystemAccount(operateAccount) == true) {
                                    logger.info("find auth change blockNum(" + blockInfo.block_num + ") account(" + operateAccount + ") is  system account");
                                    //add to tran array
                                    let tranObj = buildAlertTranObj(chainName, blockInfo.block_num, tranInfo.trx.id, action.account, action.name, operateAccount, "{}", constants.alertTranTypeConstants.AUTH_INFO);
                                    trans.push(tranObj);
                                } else {
                                    logger.info("ind auth change blockNum(" + blockInfo.block_num + ") account(" + operateAccount + ") is not system account");
                                }

                            }
                        }

                    }
                } catch (e) {
                    logger.error("getMoveProdRTransFromBlockHeader error", e);
                }
            }
        }


    } catch (e) {
        logger.error("getMoveProdRTransFromBlockHeader error", e);
    }

    return trans;
}


/**
 * 创建tran提醒对象
 * @param chainName
 * @param blockId
 * @param tranId
 * @param contractName
 * @param actionName
 * @param targetAccount
 * @param remark
 * @returns {{blockId: *, tranId: *, chainName: *, contractName: *, targetAccount: *, remark: *, actionName: *}}
 */
function buildAlertTranObj(chainName, blockId, tranId, contractName, actionName, targetAccount, remark,alertType) {
    let alertObj = {
        chainName: chainName,
        blockNum: blockId,
        tranId: tranId,
        contractName: contractName,
        actionName: actionName,
        targetAccount: targetAccount,
        remark: remark,
        alertType : alertType,
    }

    return alertObj;
}

/**
 * 是否是系统账号
 * @param account
 * @returns {boolean}
 */
function isSystemAccount(account) {
    if (utils.isNull(account)) {
        return false;
    }

    /**
     * futureio
     */
    if (account == constants.contractConstants.FUTUREIO) {
        return true;
    }

    /**
     * futio. 打头的系统账号
     */
    if (account.indexOf(constants.accountConstants.FUTIO_SYSTEM) == 0) {
        return true;
    }

    return false;
}

/**
 *
 * @param blockHeightInfo
 * @param tranId
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

function getMaxValidWorldState(rows) {
    let result = {block_num : -1, hash_v : []};
    try {
        if (utils.isNullList(rows)) {
            return null;
        } else {
            for (var i = rows.length - 1; i >= 0; i--) {
                let obj = rows[i];
                if (utils.isNullList(obj.hash_v) == false) {
                    for (var t = 0; t < obj.hash_v.length; t++) {
                        if (obj.hash_v[t].valid == 1) {
                            result.block_num = obj.block_num;
                            result.hash_v.push(obj.hash_v[t]);
                            return result;
                        }
                    }

                }

            }

        }

    } catch (e) {
        logger.error("getMaxValidWorldState error:",e);
    }
    return null;
}

async function checkProcess(processKeyword, processPath, callback) {
    let command = "ps axu | grep " + processKeyword;
    logger.info("processKeyword : " + processKeyword + ", processPath : " + processPath);
    if (utils.isNull(processPath)) {
        processPath = processKeyword;
    }
    process.exec(command, function (error, stdout) {
        let running = false;
        try {
            if (error !== null) {
                logger.error("exec ps nod error: " + error);
            } else {
                logger.info("exccmd success:" + command);
                logger.info("command res :", stdout);
                let resData = stdout.split("\n");
                for (let i = 0; i < resData.length; i++) {
                    if (resData[i].indexOf(processPath) != -1) {
                        logger.info("process is :", resData[i]);
                        running = true;
                        break;
                    }
                }
            }
            if (typeof callback == "function") {
                callback(running);
            }
        } catch (e) {
            logger.error("checkProcess error:",e);
        }
    });
}

function getValidWorldStateList(rows) {
    let worldstatelist = [];
    try {
        if ( utils.isNullList(rows) ) {
            return worldstatelist;
        }
        for (var i = rows.length - 1; i >= 0; i--) {
            let obj = rows[i];
            if ( utils.isNullList(obj.hash_v) ) {
                continue;
            }
            for (var t = 0; t < obj.hash_v.length; t++) {
                if (obj.hash_v[t].valid == 1) {
                    let result = {block_num : -1, hash_v : []};
                    result.block_num = obj.block_num;
                    result.hash_v.push(obj.hash_v[t]);
                    worldstatelist.push(result);
                    if(worldstatelist.length >= 5) {
                        return worldstatelist;
                    }
                }
            }

        }

    } catch (e) {
        logger.error("getValidWorldStateList error:",e);
    }
    return worldstatelist;
}

module.exports = {
    formatGensisTime,
    checkFileExist,
    transferTrxReceiptBytesToArray,
    transferFreeMemToArray,
    getMoveProdRTransFromBlockHeader,
    randomRato,
    parseUrlInfo,
    getNearestWsInfoByBlockHeight,
    getAlertTranFromBlock,
    getSyncUserTransFromTrans,
    getSyncAccPermFromTrans,
    getSyncResTransFromTrans,
    getUgasTransFromTrans,
    checkHashIsready,
    getMaxValidWorldState,
    checkProcess,
    getValidWorldStateList,
}
