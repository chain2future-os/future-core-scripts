const {U3} = require('u3.js');
const {createU3, format} = U3;
const axios = require('axios')
var qs = require('qs');
var sleep = require("sleep")
var futureEncryptUtil = require("../common/util/futureEncryptUtil")


/**
 * 链相关操作的api
 */
var logger = require("../config/logConfig").getLogger("ChainApi");
var constant = require("../common/constant/constants")
var utils = require("../common/util/utils");
var hashUtil = require("../common/util/hashUtil");

/**
 *
 * @param prefix
 * @param path
 * @param param
 * @param backUplist
 * @returns {Promise<*>}
 */
multiRequest = async function (prefix, path, params, prefixlist) {
    logger.debug("multiRequest:", prefix);
    logger.debug("multiRequest:", prefixlist);
    let res = null;
    try {
        res = await axios.post(prefix + path, params,{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        if (res.status == 200) {
            logger.debug("multiRequest(" + path + ") success:", res);
            return res;
        } else {
            logger.error("multiRequest(" + path + ") error:", res);
        }
    } catch (e) {
        logger.error("multiRequest("+path+") error:", utils.logNetworkError(e));
        // if (prefixlist.length > 0) {
        //     for (let i = 0; i < prefixlist.length; i++) {
        //         let newPrefix = prefixlist[i];
        //         try {
        //             logger.info("multiRequest(" + path + "), user new url:" + newPrefix);
        //             res = await axios.post(newPrefix + path, params);
        //             if (res.status == 200) {
        //                 return res;
        //             }
        //         } catch (e) {
        //             logger.error("multiRequest error:", e);
        //             logger.error("multiRequest(" + path + ") error:", res);
        //         }
        //     }
        // }
    }

    return res;
}

/**
 * 获取主网主链Chain Id
 * @param config
 * @returns {Promise<*>}
 */
const getChainId = async (config) => {

    try {
        const rs = await multiRequest(config.httpEndpoint, "/v1/chain_info/get_chain_info", {}, config.seedHttpList);
        return rs.data.chain_id;
    } catch (e) {
        logger.error("getChainId error:", utils.logNetworkError(e));
    }

    return null;

}

/**
 * 获取链最大block num
 * @param config
 * @returns {Promise<*>}
 */
const getChainMaxBlockNum = async (config) => {

    try {
        const rs = await multiRequest(config.httpEndpoint, "/v1/chain_info/get_chain_info", {}, config.seedHttpList);
        return rs.data.head_block_num;
    } catch (e) {
        logger.error("getChainMaxBlockNum error:", utils.logNetworkError(e));
    }

    return null;

}

const getChainIdByAllSeed = async (config,seedList) => {

    try {
        const rs = await multiRequest(config.httpEndpoint, "/v1/chain_info/get_chain_info", {}, config.seedHttpList);
        return rs.data.chain_id;
    } catch (e) {
        logger.error("getChainId error:", utils.logNetworkError(e));

        for (let i =0;i<seedList.length;i++) {
            try {
                config.httpEndpoint = seedList[i];
                const rs = await multiRequest(config.httpEndpoint, "/v1/chain_info/get_chain_info", {}, config.seedHttpList);
                return rs.data.chain_id;
            } catch (e) {
                logger.error("getChainId error:", utils.logNetworkError(e));
            }
        }
    }

    return null;

}

const getBlockHeaderInfo = async (httpEndpoint,scope,table_key) => {
    let rows = [];
    try {
        const params = {
            "code": constant.contractConstants.FUTUREIO,
            "scope": scope,
            "table": constant.tableConstants.BLOCK_HEADER,
            "json": true,
            "table_key_type": "uint64",
            "table_key": table_key,
        };
        let res = await axios.post(httpEndpoint + "/v1/chain_info/get_table_records", params,{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        return res.data.rows;
    } catch (e) {
        logger.error("getBlockHeaderInfo error,",e);
    }

    return rows;
}

/**
 *
 * @param httpEndpoint
 * @param blockId
 * @returns {Promise<*>}
 */
const getBlockInfoData = async (httpEndpoint,blockId) => {
    let blockObj = null;
    try {
        const params = {
            "block_num_or_id" : blockId
        }
        let res = await axios.post(httpEndpoint + "/v1/chain_info/get_block_info", params,{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        blockObj = res.data;
    } catch (e) {
        logger.error("get block info data error:",e);
    }

    return blockObj;
}



/**
 * 获取已同步最小块的信息
 * @param config
 * @param scope
 * @param table_key
 * @returns {Promise<*>}
 */
const getMinBlockHeaderInfo = async (httpEndpoint,scope) => {
    let blockId = 0;
    try {
        const params = {
            "code": constant.contractConstants.FUTUREIO,
            "scope": scope,
            "table": constant.tableConstants.BLOCK_HEADER,
            "json": true,
            "table_key_type": "uint64",
            "limit": 1,
        };
        let res = await axios.post(httpEndpoint + "/v1/chain_info/get_table_records", params,{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.debug("getMinBlockHeaderInfo res:",res.data);
        if (res.data.rows.length > 0) {
            return res.data.rows[0].block_number;
        }
    } catch (e) {
        logger.error("getBlockHeaderInfo error,",e);
    }

    return blockId;
}

/**
 * 根据user 获取chain name
 * @param user
 * @returns {Promise<*|number|Location|string|WorkerLocation>}
 */
const getChainInfo = async function initChainName(config, user) {

    let result = null;
    logger.debug("getChainInfo config :", config);
    try {
        var u3 = createU3({...config, sign: true, broadcast: true});
        result = await u3.getProducerInfo({"owner": user});
        logger.debug("getChainInfo", result);
    } catch (e) {
        logger.error("getChainInfo error:", utils.logNetworkError(e));
    }

    return result;

}


/**
 * 获取账号
 * @param config
 * @param accountName
 * @returns {Promise<null>}
 */
async function getAccount(port, accountName) {
    try {
        const rs = await axios.post("http://127.0.0.1:"+port + "/v1/chain_info/get_account_exist", {"account_name": accountName},{timeout: constant.apiTimeConstants.LOCAL_API_TIME});
        let res =  rs.data;
        if (res.is_exist == true) {
            return true;
        }
    } catch (e) {
        logger.error("getAccount("+accountName+") error",utils.logNetworkError(e));
    }
    return null;

}

/**
 * 获取本地producer列表
 * @returns {Promise<Array>}
 */
async function getProducerLists(prefix) {

    var result = [];
    try {
        const params = {
            "json": "true",
            "lower_bound": "0",
            "limit": 10000,
            "chain_name": constant.chainNameConstants.MAIN_CHAIN_NAME
        };
        logger.info("getProducerLists",prefix + "/v1/chain_info/get_producers");
        const rs = await axios.post(prefix + "/v1/chain_info/get_producers", params,{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});

        logger.debug("getProducerLists:", rs.data.rows);
        var rows = rs.data.rows;
        for (var i in rows) {
            var row = rows[i];
            if (row.chain_name == constant.chainNameConstants.MAIN_CHAIN_NAME) {
                result.push({
                    owner: row.prod_detail.owner,
                    miner_pk: row.prod_detail.producer_key,
                    bls_pk: row.prod_detail.bls_key,
                });
            }

        }

        //logger.debug("getProducerLists result=", result);

    } catch (e) {
        logger.error("getProducerLists error:",utils.logNetworkError(e));
    }
    return result;
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

        logger.debug("contractInteract start contractName:", contractName," actionName:", actionName, " params:",params, " accountName:",accountName," privateKey:",privateKey);
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
        logger.info('contractInteract success contractName:',contractName," actionName:", actionName, " accountName:",accountName);
        return data;
    } catch (err) {
        logger.info('contractInteract error contractName:',contractName," actionName:", actionName, " params:",params, " accountName:",accountName," privateKey:",privateKey);
        logger.error('' + actionName + ' error :', err);
    }
    return null;
}

/**
 * 根据链名称并基于group获取种子ip
 * @param chainName
 * @param chainConfig
 * @returns {Promise<void>}
 */
getChainSeedIPByGroup = async (chainName, chainConfig) => {

    logger.info("getChainSeedIPByGroup of chain("+chainName+")");
    try {

        let localIp = utils.getLocalIPAdress();

        if (utils.isNotNull(chainConfig.groupConfig) && chainConfig.groupConfig.length > 0) {
            for (let i=0;i< chainConfig.groupConfig.length;i++) {
                let group = chainConfig.groupConfig[i];
                let belongFlag = utils.checkIpBelongsToLocalNet(localIp,group.startIp,group.endIp);
                if (belongFlag == false) {
                   logger.info("I("+localIp+") am not belong to this group("+group.startIp+"-"+group.endIp+")");
                } else {
                    let chainId = null;
                    logger.error("I("+localIp+") am  belong to this group("+group.name+")("+group.startIp+"-"+group.endIp+")");
                    let seedList = group.seedList;
                    let seedArray = [];
                    if (utils.isNotNull(seedList)) {
                        for (let j=0;j<seedList.length;j++) {
                            let seedInfo = seedList[j];
                            if (seedInfo.chainName == chainName) {
                                if (seedInfo.seedType == 1) {
                                    chainId = seedInfo.chainId;
                                    seedArray.push(seedInfo.privateIp);
                                }
                            }
                        }
                    }

                    logger.error("I("+localIp+") am  belong to this group("+group.name+"), chain("+chainName+")'s seed list:",seedArray);

                    if (seedArray.length >0) {
                        let privateFlag = await checkSeedReady(seedArray,chainConfig.nodPort,chainId);
                        if (privateFlag == true) {
                            return seedArray;
                        } else {
                            logger.error("add seed list of chain("+chainName+") in group("+group.name+") are not connected")
                        }
                    } else {
                        logger.info("can't find any seed info of chain("+chainName+") in group("+group.name+")")
                    }
                }
            }
        }

    } catch (e) {
        logger.error("getChainSeedIPByGroup error:",e);
    }

    return null;

}


/**
 * 根据链名称并基于group获取peerkeys
 * @param chainName
 * @param chainConfig
 * @returns {Promise<*>}
 */
getChainPeerKeysByGroup = async (chainName, chainConfig) => {

    logger.info("getChainPeerKeysByGroup of chain("+chainName+")");
    try {

        let localIp = utils.getLocalIPAdress();

        if (utils.isNotNull(chainConfig.groupConfig) && chainConfig.groupConfig.length > 0) {
            for (let i=0;i< chainConfig.groupConfig.length;i++) {
                let group = chainConfig.groupConfig[i];
                let belongFlag = utils.checkIpBelongsToLocalNet(localIp,group.startIp,group.endIp);
                if (belongFlag == false) {
                    logger.info("I("+localIp+") am not belong to this group("+group.startIp+"-"+group.endIp+")");
                } else {
                    let chainId = null;
                    logger.error("I("+localIp+") am  belong to this group("+group.name+")("+group.startIp+"-"+group.endIp+")");
                    let seedList = group.seedList;
                    let seedArray = [];
                    let peerKeyArray = [];
                    if (utils.isNotNull(seedList)) {
                        for (let j=0;j<seedList.length;j++) {
                            let seedInfo = seedList[j];
                            if (seedInfo.chainName == chainName) {

                                peerKeyArray.push(seedInfo.pk);

                                /**
                                 * 只有类型为seed才需要
                                 */
                                if (seedInfo.seedType == 1) {
                                    chainId = seedInfo.chainId;
                                    seedArray.push(seedInfo.privateIp);
                                }
                            }
                        }
                    }

                    logger.error("I("+localIp+") am  belong to this group("+group.name+"), chain("+chainName+")'s peer keys list:",peerKeyArray);

                    if (seedArray.length >0) {
                        let privateFlag = await checkSeedReady(seedArray,chainConfig.nodPort,chainId);
                        if (privateFlag == true) {
                            return peerKeyArray;
                        } else {
                            logger.error("add seed list of chain("+chainName+") in group("+group.name+") are not connected")
                        }
                    } else {
                        logger.info("can't find any seed info of chain("+chainName+") in group("+group.name+")")
                    }
                }
            }
        }

    } catch (e) {
        logger.error("getChainPeerKeysByGroup error:",e);
    }

    return null;

}

/**
 * 根据链名称获取种子ip
 * @param chain
 * @returns {Promise<string>}
 */
getChainSeedIP = async (chainName, chainConfig) => {

    // logger.debug(chainConfig.seedIpConfig);
    // logger.debug(chainName);
    try {
        if (utils.isNotNull(chainConfig.seedIpConfig) && chainConfig.seedIpConfig.length > 0) {

            //简单模式（不分内外网ip）
            let simpleModeFlag = true;

            if (chainConfig.seedIpConfig.length > 0) {
                let config = chainConfig.seedIpConfig[0];
                logger.debug("seed config:",config);
                if (utils.isNotNull(config.seedList) && config.seedList.length > 1) {
                    simpleModeFlag = false;
                }
            }

            logger.error("ChainSeedIP simple mode:",simpleModeFlag);
            if (simpleModeFlag == true) {
                for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
                    //logger.debug(chainConfig.seedIpConfig[i])
                    if (chainConfig.seedIpConfig[i].chainName == chainName) {
                        return chainConfig.seedIpConfig[i].seedIp;
                    }
                }
            } else {
                //复杂模式，需要检查内外网ip的信息
                let privateIPList = [];
                let publicIPList = [];
                let chainId = "";

                for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
                    //logger.debug(chainConfig.seedIpConfig[i])
                    if (chainConfig.seedIpConfig[i].chainName == chainName) {
                        chainId = chainConfig.seedIpConfig[i].chainId;
                        for (let j =0;j<chainConfig.seedIpConfig[i].seedList.length;j++) {
                            privateIPList.push(chainConfig.seedIpConfig[i].seedList[j].privateIp);
                            if (utils.isNotNull(chainConfig.seedIpConfig[i].seedList[j].publicIp) && chainConfig.seedIpConfig[i].seedList[j].publicIp.length > 10) {
                                publicIPList.push(chainConfig.seedIpConfig[i].seedList[j].publicIp);
                            }
                        }
                    }
                }

                /**
                 * 检查内网节点是否连通
                 */
                logger.info("chain（"+chainName+"）private ip list：",privateIPList);
                logger.info("chain（"+chainName+"）public ip list：",publicIPList);
                logger.info("chain（"+chainName+"）chainId：",chainId);

                let privateFlag = await checkSeedReady(privateIPList,chainConfig.nodPort,chainId);
                if (privateFlag == true) {
                    logger.info("I am in LAN("+chainName+") , use private ip list");
                    return privateIPList;
                } else {
                    logger.info("I am not in LAN("+chainName+") , use public ip list");
                    return publicIPList;
                }

            }

        }

    } catch (e) {
        logger.error("get chain seed ip error:", e);
    }
    return null;
}

/**
 * 根据seed账户获取公钥
 * @param chain
 * @returns {Promise<string>}
 */
getChainSeedPk = async (chainName, seedAccount, chainConfig) => {
    try {
        if (utils.isNull(chainConfig.seedIpConfig) || chainConfig.seedIpConfig.length == 0) {
            logger.error("getChainSeedPk seedIpConfig is null seedAccount:",seedAccount);
            return null;
        }
        for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
            if (chainConfig.seedIpConfig[i].chainName == chainName) {
                for (let j =0;j<chainConfig.seedIpConfig[i].seedList.length;j++) {
                    let seedInfo = chainConfig.seedIpConfig[i].seedList[j];
                    if( seedInfo.account == seedAccount ) {
                        logger.info("getChainSeedPk seedAccount:",seedAccount," seedInfo.pk:",seedInfo.pk);
                        return seedInfo.pk;
                    }
                }
                break;
            }
        }
    } catch (e) {
        logger.error("get chain seed pk error:", e);
    }
    return null;
}

checkSeedReady = async (ipList,nodPort,chainId) => {

    logger.info("check seed ready start....");
    try {
        if (ipList.length > 0) {
            for (let i=0;i<ipList.length;i++) {
                try {
                    let url = "http://"+ipList[i]+":"+nodPort+"/v1/chain_info/get_chain_info";
                    let res = await axios.post(url, {},{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
                    logger.info("check seed ready url（"+ipList[i]+"） chain id:",res.data.chain_id);
                    if (utils.isNotNull(res.data.chain_id)) {
                        logger.info("seed("+ipList[i]+") get chainID("+res.data.chain_id+") ,need to compare chainid("+chainId+")")
                        if (utils.isNull(chainId)) {
                            logger.info("compare chainid("+chainId+") is null, success");
                            logger.info("check seed("+ipList[i]+") success,chainid is ",res.data.chain_id);
                            return true;
                        } else {
                            if (res.data.chain_id == chainId) {
                                logger.info("compare chainid("+chainId+") equal config chainid("+res.data.chain_id+"), success");
                                return true;
                            } else {
                                logger.error("compare chainid("+chainId+") not equal config chainid("+res.data.chain_id+"), fail");
                                return false;
                            }
                        }
                    } else {
                        logger.error("check seed("+ipList[i]+") error,chainid is null");
                    }
                } catch (e) {
                    logger.error("check seed ready url（"+ipList[i]+"） error",utils.logNetworkError(e));
                }
            }
        }

    } catch (e) {
        logger.error("checkSeedReady eroor;",e);
    }


    return false;
}


/**
 * 基于group信息获取链httplist
 * @param chainName
 * @param chainConfig
 * @returns {Promise<Array>}
 */
getChainHttpListByGroup = async (chainName, chainConfig) => {

    logger.info("getChainHttpListByGroup of chain("+chainName+")");
    let groupList = chainConfig.groupConfig;
    let seedList = null;

    /**
     * 如果group为空，通过通用配置获取seed列表
     */
    if (utils.isNull(groupList)) {
        logger.error("group is null ,get seed list from seed list");
        seedList = await getChainSeedIP(chainName, chainConfig);
    } else {
        logger.error("group is exitst ,get seed list from group list");
        seedList = await getChainSeedIPByGroup(chainName, chainConfig);
        if (utils.isNull(seedList)) {
            logger.error("can't find suitable group ,get seed list from seed list");
            seedList = await getChainSeedIP(chainName, chainConfig);
        }
    }

    let chainHttpList = [];
    if (utils.isNullList(seedList) == false) {
        for (let i = 0; i < seedList.length; i++) {
            let url = "http://" + seedList[i] + ":"+chainConfig.nodPort;
            chainHttpList.push(url);
        }
    }

    return chainHttpList;
}

/**
 * 获取链httplist
 * @param chainName
 * @param chainConfig
 * @returns {Promise<Array>}
 */
getChainHttpList = async (chainName, chainConfig) => {

    let seedList = await getChainSeedIP(chainName, chainConfig);
    let chainHttpList = [];
    if (utils.isNullList(seedList) == false) {
        for (let i = 0; i < seedList.length; i++) {
            let url = "http://" + seedList[i] + ":"+chainConfig.nodPort;
            chainHttpList.push(url);
        }
    }

    return chainHttpList;
}


/**
 * 根据链名称获取白名单公钥信息（genesis+seed）基于group
 * @param chainName
 * @param chainConfig
 * @returns {Promise<void>}
 */
getChainPeerKeyByGroup = async (chainName, chainConfig) => {
    try {

        logger.info("getChainPeerKeyByGroup of chain("+chainName+")");
        let groupList = chainConfig.groupConfig;
        if (utils.isNull(groupList)) {
            logger.error("group is null ,get peer key list from seed list");
            return await getChainPeerKey(chainName,chainConfig);
        } else {
            let peerKeysArray =  await getChainPeerKeysByGroup(chainName,chainConfig);
            logger.info("getChainPeerKeyByGroup of chain("+chainName+") result :", peerKeysArray);
            if (utils.isNull(peerKeysArray)) {
                return await getChainPeerKey(chainName,chainConfig);
            } else {
                return peerKeysArray;
            }
        }

    } catch (e) {
        logger.error("get getChainPeerKeyByGroup error:", e);
        return await getChainPeerKey(chainName,chainConfig);
    }

    return [];

}

/**
 * 根据链名称获取白名单公钥信息（genesis+seed）
 * @param chain
 * @returns {Promise<string>}
 */
getChainPeerKey = async (chainName, chainConfig) => {

    // logger.debug(chainConfig.seedIpConfig);
    // logger.debug(chainName);
    try {
        if (utils.isNotNull(chainConfig.seedIpConfig)) {
            for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
                //logger.debug(chainConfig.seedIpConfig[i])
                if (chainConfig.seedIpConfig[i].chainName == chainName) {
                    return chainConfig.seedIpConfig[i].peerKeys;
                }
            }
        }

    } catch (e) {
        logger.error("get getChainPeerKey error:", e);
    }
    return [];
}

/**
 * 获取表数据
 * @param config
 * @param code
 * @param scope
 * @param table
 * @param limit
 * @param table_key
 * @param lower_bound
 * @param upper_bound
 * @returns {Promise<*>}
 */
getTableInfo = async (httpEndpoint, code, scope, table, limit, table_key, lower_bound, upper_bound) => {
    try {
        const params = {"code": code, "scope": scope, "table": table, "json": true, "key_type": "name"};

        if (utils.isNotNull(lower_bound)) {
            if (typeof(lower_bound)=='string') {
                params.key_type = "name";
            } else {
                params.key_type = "uint64";
            }
        }
        logger.debug(params);
        if (utils.isNotNull(limit)) {
            params.limit = limit;
        }
        if (utils.isNotNull(table_key)) {
            params.table_key = table_key;
        }
        if (utils.isNotNull(lower_bound)) {
            params.lower_bound = lower_bound;
        }
        if (utils.isNotNull(upper_bound)) {
            params.upper_bound = upper_bound;
        }
        logger.debug("url:",httpEndpoint+"/v1/chain_info/get_table_records");
        logger.debug("params:",params);

        let res = await multiRequest(httpEndpoint, "/v1/chain_info/get_table_records", params, []);
        //logger.info(res);
        return res.data;
    } catch (e) {
        logger.error("get_table_records error:", utils.logNetworkError(e));
    }

    return null;
}


getTableScopeInfo = async (httpEndpoint, code, scope, table, limit, table_key, lower_bound, upper_bound) => {
    try {
        const params = {"code": code, "scope": scope, "table": table, "json": true, "key_type": "name"};
        logger.debug(params);
        if (utils.isNotNull(limit)) {
            params.limit = limit;
        }
        if (utils.isNotNull(table_key)) {
            params.table_key = table_key;
        }
        if (utils.isNotNull(lower_bound)) {
            params.lower_bound = lower_bound;
        }
        if (utils.isNotNull(upper_bound)) {
            params.upper_bound = upper_bound;
        }
        //logger.info("url:",httpEndpoint+"/v1/chain/get_table_by_scope");
        //logger.info("params:",params);

        let res = await multiRequest(httpEndpoint, "/v1/chain/get_table_by_scope", params, []);
        //logger.info(res.data);
        return res.data;
    } catch (e) {
        logger.error("get_table_by_scope error:", utils.logNetworkError(e));
    }

    return null;
}


/**
 * getCommitteeBulletin
 *
 * @param config
 * @param chain_name
 * @returns {Promise<Array>}
 */
getCommitteeBulletin = async (config,chain_name) => {
    let bulletinList = [];
    try {
        const params = {"chain_name": chain_name};
        let res = await multiRequest(config.httpEndpoint, "/v1/chain/get_committee_bulletin", params, config.seedHttpList);
        logger.debug("getCommitteeBulletin res:",res.data);
        bulletinList = res.data;
    } catch (e) {
        logger.error("getCommitteeBulletin error:",e);
    }

    return bulletinList;
}

/**
 * 获取全表数据
 * @param config
 * @param code
 * @param scope
 * @param table
 * @returns {Promise<*>}
 */
getTableAllData = async (config, code, scope, table, pk) => {
    let tableObj = {rows: [], more: false};
    let count = 10000; //MAX NUM
    let limit = 1000; //limit
    let finish = false;
    let lower_bound = null;
    var index = 0;
    try {
        while (finish == false) {
            logger.info("getTableAllData httpendpoint:"+config.httpEndpoint+" table: " + table + " scope:" + scope+" code:"+code + " lower_bound(request)：" + lower_bound);
            index++;
            let tableinfo = await getTableInfo(config.httpEndpoint, code, scope, table, limit, null, lower_bound, null);
            logger.debug("tableinfo:" + table + "):", tableinfo);
            if (utils.isNullList(tableinfo.rows) == false) {
                for (let i = 0; i < tableinfo.rows.length; i++) {
                    if (tableinfo.rows[i][pk] != lower_bound || lower_bound == null) {
                        tableObj.rows.push(tableinfo.rows[i]);
                    }
                }

                if (utils.isNotNull(pk)) {
                    lower_bound = tableinfo.rows[tableinfo.rows.length - 1][pk];
                }

                logger.info("table: " + table + " scope:" + scope + " lower_bound(change)：" + lower_bound);
            }

            //查看是否还有
            finish = true;
            if (utils.isNotNull(tableinfo.more) && tableinfo.more == true) {
                finish = false;
            }
            logger.debug("tableinfo more：" + tableinfo.more);
            if (index * limit >= count) {
                logger.info("table: " + table + " count > " + count + " break now!");
                break;
            }

        }
    } catch (e) {
        logger.error("getTableAllData error:", utils.logNetworkError(e));
    }

    logger.debug("getTableAllData(" + table + "):", tableObj);
    return tableObj;

}


getTableAllScopeData = async (config, code, scope, table, pk) => {
    let tableObj = {rows: [], more: false};
    let count = 1000000; //MAX NUM
    let limit = 100; //limit
    let finish = false;
    let lower_bound = null;
    var index = 0;
    try {
        while (finish == false) {
            logger.info("table: " + table + " scope:" + scope + " lower_bound(request)：" + lower_bound);
            index++;
            let tableinfo = await getTableScopeInfo(config.httpEndpoint, code, scope, table, limit, null, lower_bound, null);
            logger.debug("tableinfo:" + table + "):", tableinfo);
            if (utils.isNullList(tableinfo.rows) == false) {
                for (let i = 0; i < tableinfo.rows.length; i++) {
                    if (tableinfo.rows[i][pk] != lower_bound || lower_bound == null) {
                        tableObj.rows.push(tableinfo.rows[i]);
                    }
                }

                if (utils.isNotNull(pk)) {
                    lower_bound = tableinfo.rows[tableinfo.rows.length - 1][pk];
                }

                logger.info("table: " + table + " scope:" + scope + " lower_bound(change)：" + lower_bound);
            }

            //查看是否还有
            finish = true;
            if (utils.isNotNull(tableinfo.more) && tableinfo.more != '0' && tableinfo.more != 0) {
                finish = false;
            }
            logger.info("tableinfo more：" + tableinfo.more);
            if (index * limit >= count) {
                logger.info("table: " + table + " count > " + count + " break now!");
                break;
            }

        }
    } catch (e) {
        logger.error("getTableAllData error:", utils.logNetworkError(e));
    }

    logger.debug("getTableAllData(" + table + "):", tableObj);
    return tableObj;

}

/**
 * 返回不同子链对应的非noneproducer的链接点
 * @param chainId
 * @returns {Promise<string>}
 */
getSubchanEndPoint = async (chainName, chainConfig) => {

    // logger.debug(chainConfig.seedIpConfig);
    // logger.debug(chainName);
    try {
        if (utils.isNotNull(chainConfig.seedIpConfig)) {
            for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
                //logger.debug(chainConfig.seedIpConfig[i])
                if (chainConfig.seedIpConfig[i].chainName == chainName) {
                    return chainConfig.seedIpConfig[i].subchainHttpEndpoint;
                }
            }
        }

    } catch (e) {
        logger.error("getSubchanEndPoint error:", e);
    }
    return "";
}

/**
 * 返回不同子链对应的monitor-server-endpoint的链接点
 * @param chainId
 * @returns {Promise<string>}
 */
getSubchanMonitorService = async (chainName, chainConfig) => {

    // logger.debug(chainConfig.seedIpConfig);
    // logger.debug(chainName);
    try {
        if (utils.isNotNull(chainConfig.seedIpConfig)) {
            for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
                //logger.debug(chainConfig.seedIpConfig[i])
                if (chainConfig.seedIpConfig[i].chainName == chainName) {
                    return chainConfig.seedIpConfig[i].monitorServerEndpoint;
                }
            }
        }

    } catch (e) {
        logger.error("getSubchanMonitorService error:", e);
    }
    return "";
}

getSubchainConfig = async (chainName, chainConfig) => {

    // logger.debug(chainConfig.seedIpConfig);
    // logger.debug(chainName);
    try {
        if (utils.isNotNull(chainConfig.seedIpConfig)) {
            for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
                //logger.debug(chainConfig.seedIpConfig[i])
                if (chainConfig.seedIpConfig[i].chainName == chainName) {
                    return chainConfig.seedIpConfig[i];
                }
            }
        }

    } catch (e) {
        logger.error("getSubchainConfig error:", e);
    }
    return "";
}

/**
 *
 * @param config
 * @returns {Promise<*>}
 */
const getChainBlockDuration = async (config) => {
    try {
        const rs = await multiRequest(config.httpEndpoint, "/v1/chain_info/get_chain_info", {}, config.seedHttpList);
        return rs.data.block_interval_ms;
    } catch (e) {
        logger.error("getChainBlockDuration error,", utils.logNetworkError(e));
    }

    return null;

}

/**
 *
 * @param config
 * @returns {Promise<*>}
 */
const getHeadBlockNum = async (port) => {
    try {
        const rs = await multiRequest("http://127.0.0.1:"+port, "/v1/chain_info/get_chain_info", {}, []);
        return rs.data.head_block_num;
    } catch (e) {
        logger.error("getHeadBlockNum error,", utils.logNetworkError(e));
    }

    return null;

}

/**
 *
 * @param config
 * @returns {Promise<*>}
 */
const getMasterHeadBlockNum = async (httpendpoint) => {
    try {
        const rs = await multiRequest(httpendpoint, "/v1/chain_info/get_chain_info", {}, []);
        return rs.data.head_block_num;
    } catch (e) {
        logger.error("getMasterHeadBlockNum error,", utils.logNetworkError(e));
    }

    return null;

}

/**
 *
 * @param config
 * @returns {Promise<*>}
 */
const getHeadBlockProposer = async (config) => {
    try {
        const rs = await multiRequest(config.httpEndpoint, "/v1/chain_info/get_chain_info", {}, config.seedHttpList);
        return rs.data.head_block_proposer;
    } catch (e) {
        logger.error("getHeadBlockProposer error,", utils.logNetworkError(e));
    }

    return null;

}

/**
 *
 * @param config
 * @returns {Promise<*>}
 */
const getServerVersion = async (port) => {
    let path = "http://127.0.0.1:"+port+"/v1/chain_info/get_chain_info"
    try {
        const rs = await axios.post(path,{},{timeout: constant.apiTimeConstants.LOCAL_API_TIME});
        logger.debug("get get_chain_info  ",rs.data);
        if (rs.status == 200) {
            return rs.data.server_version;
        } else {
            logger.error("request node serverVersion error code (" + path + ")");
        }
    } catch (e) {
        logger.error("getServerVersion error,", utils.logNetworkError(e));
    }

    return null;
}


/**
 * monitor check in
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
monitorCheckIn = async (url, param) => {
    try {
        logger.debug("monitorCheckIn param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/checkIn", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("monitorCheckIn result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("monitorCheckIn error,", utils.logNetworkError(e));
    }
}

/**
 * confirmBlockCheckIn
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
confirmBlockCheckIn = async (url,param) => {
    try {
        logger.info("confirmBlockCheckIn param:", qs.stringify(param));
        const rs = await axios.post(url + "/alert/uploadConfirmBlock", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("confirmBlockCheckIn result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("confirmBlockCheckIn error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
getSyncBlock = async (url,param) => {
    try {
        logger.info("getSyncBlock param:", qs.stringify(param));
        const rs = await axios.post(url + "/alert/getSyncBlockInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("getSyncBlock result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("getSyncBlock error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
updateSyncBlock = async (url,param) => {
    try {
        logger.info("updateSyncBlock param:", qs.stringify(param));
        const rs = await axios.post(url + "/alert/uploadSyncBlock", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("updateSyncBlock result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("updateSyncBlock error,", utils.logNetworkError(e));
    }
}
/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadFailTran = async (url,param) => {
    try {
        logger.info("updateFailTran param:", qs.stringify(param));
        const rs = await axios.post(url + "/alert/uploadFailedSync", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("updateFailTran result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("updateSyncBlock error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
getFailedTranList = async (url,param) => {
    try {
        logger.info("getFailedTranList param:", qs.stringify(param));
        const rs = await axios.post(url + "/alert/getFailedTranList", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("getFailedTranList result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("getFailedTranList error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
finishFailedTranList = async (url,param) => {
    try {
        logger.info("finishFailedTranList param:", qs.stringify(param));
        const rs = await axios.post(url + "/alert/finishFailedSyncList", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("finishFailedTranList result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("finishFailedTranList error,", utils.logNetworkError(e));
    }
}

/**
 * ramUsageCheckIn
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
ramUsageCheckIn = async (url,param) => {
    try {
        logger.info("ramUsageCheckIn param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addRamUsage", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("ramUsageCheckIn result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("addRamUsage error,", utils.logNetworkError(e));
    }
}



/**
 * uploadugas
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadugas = async (url,param) => {
    for( let i = 0; i < 3; i++ ) {
        try {
            logger.info("uploadugas param:", qs.stringify(param));
            const rs = await axios.post(url + "/filedist/addUgasInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
            logger.info("uploadugas result:", formartDataFromMonitor(rs.data));
            return formartDataFromMonitor(rs.data);
        } catch (e) {
            logger.error("uploadugas error,", utils.logNetworkError(e)," retry count:",i);
            sleep.msleep(1000);
        }
    }
}

/**
 * upload heart beat offline producers
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadHbOfflineProd = async (url,param) => {
    try {
        logger.debug("uploadHbOfflineProd param:", qs.stringify(param));
        logger.info("uploadHbOfflineProd Url:", (url + "/filedist/addHbOfflineProdList"));
        const rs = await axios.post(url + "/filedist/addHbOfflineProdList", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("uploadHbOfflineProd result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("uploadHbOfflineProd error,", utils.logNetworkError(e));
    }
}

/**
 * uploadChainBalance
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadChainBalance = async (url,param) => {
    try {
        logger.info("uploadChainBalance param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addChainBalace", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("uploadChainBalance result:", rs.data);
        logger.info("uploadChainBalance result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("uploadChainBalance error,", utils.logNetworkError(e));
    }
}

/**
 * getMaxBlock
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
getMaxBlock = async (url,param) => {
    try {
        logger.info("getMaxBlock param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/queryBlockInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("getMaxBlock result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("uploadChainBalance error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadBlockLIst = async (url,param) => {
    try {
        logger.info("uploadBlockLIst param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addBlockInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("getMaxBlock result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("uploadBlockLIst error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadClaimRecord = async (url,param) => {
    try {
        logger.info("uploadClaimRecord param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addClaimRewardRecord", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("uploadClaimRecord result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("uploadClaimRecord error,", utils.logNetworkError(e));
    }
}
/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadAlertTran = async (url,param) => {
    try {
        logger.info("uploadAlertTran param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addAlertTran", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("uploadAlertTran result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("uploadAlertTran error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
uploadCurrency = async (url,param) => {
    try {
        logger.info("uploadCurrency param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addCurrencyInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("uploadCurrency result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("uploadCurrency error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param httpEndPoint
 * @returns {Promise<*>}
 */
getCurrencyStats = async (httpEndPoint) => {
    try {

        const rs = await axios.post(httpEndPoint+ "/v1/chain/get_currency_stats",{"code":"futio.token", "symbol":"FGAS"},{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        return rs.data;
    } catch (e) {
        logger.error("getCurrencyStats error:",e);
    }

    return null;
}


/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
checkDeployFile = async (url, param) => {
    try {
        logger.debug("checkDeployFile param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/checkDeployInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("checkDeployFile result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("checkDeployFile error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
finsihDeployFile = async (url, param) => {
    try {
        logger.debug("finishDeployInfo param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/finishDeployInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("finishDeployInfo result:", formartDataFromMonitor(rs.data));
        return formartDataFromMonitor(rs.data);
    } catch (e) {
        logger.error("finishDeployInfo error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @returns {Promise<void>}
 */
getSubchainList = async (chainConfig) => {
    let apiArray = [];
    try {
        if (utils.isNotNull(chainConfig.seedIpConfig)) {
            for (let i = 0; i < chainConfig.seedIpConfig.length; i++) {
                //logger.debug(chainConfig.seedIpConfig[i])
                apiArray.push({
                    "chainName": chainConfig.seedIpConfig[i].chainName,
                    "httpEndpoint": chainConfig.seedIpConfig[i].subchainHttpEndpoint
                })
            }
        }
    } catch (e) {
        logger.error("getSubchainList error,", e);
    }

    return apiArray;
}

getSyncBlockChainList = async (chainConfig, isMainChain) => {
    if (isMainChain) {
        return await getSubchainList(chainConfig);
    } else {
        return [{
            "chainName": constant.chainNameConstants.MAIN_CHAIN_NAME,
            "httpEndpoint": chainConfig.config.httpEndpoint
        }];
    }
}


/**
 * 获取目标chain中已同步的块信息
 * @param configTemp
 * @param targetChainHttp
 * @param targetChainName
 * @param searchChainName
 * @returns {Promise<*>}
 */
const getTargetChainBlockNum = async (configTemp, targetChainHttp, targetChainName, searchChainName) => {

    try {
        configTemp.httpEndpoint = targetChainHttp;
        var u3Temp = createU3({...configTemp, sign: true, broadcast: true});
        var subchainBlockNumResult = await u3Temp.getSubchainBlockNum({"chain_name": searchChainName});
        return subchainBlockNumResult;
    } catch (e) {
        logger.error("getTargetChainBlockNum error:", utils.logNetworkError(e))
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
addSwitchLog = async (url, param) => {
    try {
        logger.debug("addSwitchLog param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addSwitchLog", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("addSwitchLog result:", rs.data);
        return rs.data;
    } catch (e) {
        logger.error("addSwitchLog error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
addRestartLog = async (url, param) => {
    try {
        logger.debug("addRestartLog param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/addRestartLog", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("addRestartLog result:", rs.data);
        return rs.data;
    } catch (e) {
        logger.error("addRestartLog error,", utils.logNetworkError(e));
    }
}

/**
 *
 * @returns {Promise<*>}
 */
getSubchainBlockNum = async (config, chain_name) => {
    try {
        var u3 = createU3({...config, sign: true, broadcast: true});
        return await u3.getSubchainBlockNum({"chain_name": chain_name});
    } catch (e) {
        logger.error("getSubchainBlockNum :", e);
    }

    return null;

}

/**
 * 获取子链中主链的块高
 * @returns {Promise<*>}
 */
getMasterBlockNum = async (port) => {

    try {
        const rs = await multiRequest("http://127.0.0.1:"+port, "/v1/chain_info/get_master_block_num", {}, []);
        logger.info("getMasterBlockNum data:",rs.data);
        return rs.data;
    } catch (e) {
        logger.error("getMasterBlockNum error,", utils.logNetworkError(e));
    }

}


/**
 *
 * @returns {Promise<*>}
 */
getSubchainCommittee = async (config, chain_name) => {
    try {
        var u3 = createU3({...config, sign: true, broadcast: true});
        return await u3.getSubchainCommittee({"chain_name": chain_name});
    } catch (e) {
        logger.error("getSubchainCommittee :", e);
    }

    return null;

}

var maxCheckSeedTime =5;

var checkSubSeedTime =0;

var checkMainSeedTime = 0;

checkSubchainSeed = async (chainConfig) => {

    let path = chainConfig.configSub.httpEndpoint + "/v1/chain_info/get_chain_info"
    try {
        let res = await axios.post(path,{},{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("[seed check] checkSubchainSeed success,use seed:"+chainConfig.configSub.httpEndpoint);
        checkSubSeedTime = 0;
        return;
    } catch (e) {
        logger.error("[seed check] checkSubchainSeed error("+chainConfig.configSub.httpEndpoint+") :", utils.logNetworkError(e));
        checkSubSeedTime++;
        if (checkSubSeedTime <= maxCheckSeedTime) {
            logger.error("[seed check] check subchain seed time("+checkSubSeedTime+") <= max("+maxCheckSeedTime+"),wait next...");
            return;
        }

        checkSubSeedTime = 0;

        let seedHttpList = chainConfig.configSub.seedHttpList;
        if (seedHttpList.length > 0) {
            logger.info("[seed check] start to use other seed http to request checkSubchainSeed");
            for (let i = 0; i < seedHttpList.length; i++) {
                chainConfig.configSub.httpEndpoint = seedHttpList[i];
                path = chainConfig.configSub.httpEndpoint + "/v1/chain_info/get_chain_info"
                try {
                    let res = await axios.post(path,{},{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
                    chainConfig.u3Sub = createU3({...chainConfig.configSub, sign: true, broadcast: true});
                    logger.info("[seed check] checkSubchainSeed("+path+") success,use new seed:"+chainConfig.configSub.httpEndpoint);
                    return null;
                } catch (e) {
                    logger.error("[seed check] checkSubchainSeed("+path+") error:", utils.logNetworkError(e));
                }
            }
        }

    }

    return null;
}

checkMainchainSeed = async (chainConfig, isForceUpdate = false) => {

    let path = chainConfig.config.httpEndpoint + "/v1/chain_info/get_chain_info"
    try {
        let res = await axios.post(path,{},{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("[seed check] checkMainchainSeed success,use seed:"+chainConfig.config.httpEndpoint);
        checkMainSeedTime = 0;
        return;
    } catch (e) {
        logger.info("[seed check] start to use other seed http to request checkMainchainSeed, checkMainSeedTime:",checkMainSeedTime," isForceUpdate",isForceUpdate);

        checkMainSeedTime++;
        if (checkMainSeedTime <= maxCheckSeedTime && isForceUpdate == false) {
            logger.error("[seed check] check mainchain seed time("+checkMainSeedTime+") <= max("+maxCheckSeedTime+"),wait next...");
            return;
        }

        checkMainSeedTime = 0;
        let seedHttpList = chainConfig.config.seedHttpList;
        if (seedHttpList.length > 0) {
            logger.info("[seed check] start to use other seed http to request checkMainchainSeed,seedHttpList:",seedHttpList);
            for (let i = 0; i < seedHttpList.length; i++) {
                chainConfig.config.httpEndpoint = seedHttpList[i];
                path = chainConfig.config.httpEndpoint + "/v1/chain_info/get_chain_info"
                try {
                    let res = await axios.post(path,{},{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
                    chainConfig.u3Sub = createU3({...chainConfig.config, sign: true, broadcast: true});
                    logger.info("[seed check] checkMainchainSeed("+path+") success,use new seed:"+chainConfig.config.httpEndpoint);
                    return null;
                } catch (e) {
                    logger.error("[seed check] checkMainchainSeed("+path+") error:", utils.logNetworkError(e));
                }
            }
        }

    }

    return null;
}

/**
 *
 * @param data
 * @param sign
 * @returns {boolean}
 */
verifySign = (data,sign) => {
    try {
        let apiTime = data.time;
        let nowTime = new Date().getTime();
        if (apiTime - nowTime >= constant.API_MAX_INTEVAL_TIME || nowTime - apiTime >= constant.API_MAX_INTEVAL_TIME) {
            logger.error("api time is not valid(api time("+apiTime+") : local time:("+nowTime+")");
            return false;
        }
        logger.debug("api time is  valid(api time("+apiTime+") : local time:("+nowTime+")");
        let sign = data.sign;
        logger.debug("check sign:",sign);
        data.sign = "sign";
        let res = JSON.stringify(data);
        logger.debug("check sign new data:",res);
        let rawStr = res+constant.PRIVATE_KEY;
        logger.debug("check sign raw string:",rawStr);
        let checkSign = hashUtil.calcMd5(rawStr);
        logger.debug("check sign md5:",checkSign);

        if (sign == checkSign) {
            logger.debug("sign("+sign+") == checksign("+checkSign+")")
            return true;
        }

        logger.error("sign("+sign+") != checksign("+checkSign+")")
    } catch (e) {
        logger.error("verify sign error:",e);
    }

    return false;

}

/**
 *
 * @param data
 * @returns {*}
 */
formartDataFromMonitor =  (data) => {
    try {

        logger.debug("formartDataFromMonitor data:",data);
        if (typeof(data)=='string') {
            if (data.indexOf("00") == 0) {
                logger.info("formartDataFromMonitor is encoded need decode");
                let str = futureEncryptUtil.decodeFuture(data);
                let jsonObj = JSON.parse(str);
                return jsonObj;
            } else {
                logger.info("formartDataFromMonitor is not encoded need not decode");
                let jsonObj = JSON.parse(data);
                return jsonObj;
            }
        }
    } catch (e) {
        logger.error("formartDataFromMonitor error:",e);
    }

    return data;
}

/**
 * get seed info
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
getSeedInfo = async (url, param) => {
    try {
        logger.info("getSeedInfo param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/getSeedInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.debug("monitor getSeedInfo result:", formartDataFromMonitor(rs.data));
        let data =  formartDataFromMonitor(rs.data);
        if (data.code ==0) {
            return formartDataFromMonitor(rs.data);
        } else {
            logger.error("getSeedInfo error:",formartDataFromMonitor(rs.data));
        }
    } catch (e) {
        logger.error("getSeedInfo error,", utils.logNetworkError(e));
    }

    return null;
}

/**
 *
 * @param url
 * @param param
 * @returns {Promise<*>}
 */
getGroupInfo = async (url, param) => {
    try {
        logger.info("getGroupInfo param:", qs.stringify(param));
        const rs = await axios.post(url + "/filedist/getGroupInfo", qs.stringify(param),{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.debug("monitor getGroupInfo result:", formartDataFromMonitor(rs.data));
        let data =  formartDataFromMonitor(rs.data);
        if (data.code ==0) {
            return formartDataFromMonitor(rs.data);
        } else {
            logger.error("getGroupInfo error:",formartDataFromMonitor(rs.data));
        }
    } catch (e) {
        logger.error("getGroupInfo error,", utils.logNetworkError(e));
    }

    return null;
}

/**
 *
 * @param config
 * @param blockNum
 * @param trxId
 * @returns {Promise<*>}
 */
getMerkleProof = async (config,blockNum,trxId) => {
    try {
        const rs = await multiRequest(config.httpEndpoint, "/v1/chain/get_merkle_proof", {block_number:blockNum,trx_id:trxId}, config.seedHttpList);
        return rs.data;
    } catch (e) {
        logger.error("get getMerkleProof error:",utils.logNetworkError(e), " config:",config.httpEndpoint);
    }

    return null;
}

/**
 * 查询表信息
 * @param httpEndpoint
 * @param code
 * @param scope
 * @param table
 * @returns {Promise<*>}
 */
const get_table_records_info = async ( httpEndpoint, code, scope, table ) => {
    try {
        const params = {
            "code": code,
            "scope": scope,
            "table": table,
            "json": true,
            "table_key_type": "name",
            "limit": 1,
        };
        let res = await axios.post(httpEndpoint + "/v1/chain_info/get_table_records", params,{timeout: constant.apiTimeConstants.DEFAULT_SEED_API_TIME});
        logger.info("get_table_records_info res:",res.data);
        if (res.data.rows.length > 0) {
            return res.data.rows;
        }
    } catch (e) {
        logger.error("get_table_records_info error,",e);
    }

    return null;
}

/**
 * 获取表数据
 * @param config
 * @param code
 * @param scope
 * @param table
 * @param limit
 * @param table_key
 * @param lower_bound
 * @param upper_bound
 * @returns {Promise<*>}
 */
getTableInfoEx = async (httpEndpoint, code, scope, table, limit, table_key, lower_bound, upper_bound) => {
    try {
        const params = {"code": code, "scope": scope, "table": table, "json": true, "key_type": "name"};

        if (utils.isNotNull(lower_bound)) {
            if (typeof(lower_bound)=='string') {
                params.key_type = "name";
            } else {
                params.key_type = "uint64";
            }
        }
        logger.debug(params);
        if (utils.isNotNull(limit)) {
            params.limit = limit;
        }
        if (utils.isNotNull(table_key)) {
            params.table_key = table_key;
        }
        if (utils.isNotNull(lower_bound)) {
            params.lower_bound = lower_bound;
        }
        if (utils.isNotNull(upper_bound)) {
            params.upper_bound = upper_bound;
        }
        logger.debug("url:",httpEndpoint+"/v1/chain_info/get_table_records");
        logger.debug("params:",params);

        let res = await multiRequest(httpEndpoint, "/v1/chain_info/get_table_records", params, []);
        return {res:res.data,err:null};
    } catch (e) {
        logger.error("get_table_records error:", utils.logNetworkError(e));
        return {res:null,err:e};
    }
}
/**
 * 获取全表数据
 * @param config
 * @param code
 * @param scope
 * @param table
 * @returns {Promise<*>}
 */
getTableAllDataEx = async (config, code, scope, table, pk) => {
    let tableObj = {rows: [], more: false};
    let count = 10000; //MAX NUM
    let limit = 1000; //limit
    let finish = false;
    let lower_bound = null;
    var index = 0;
    let req_error_info = null;
    try {
        while (finish == false) {
            logger.info("getTableAllData httpendpoint:"+config.httpEndpoint+" table: " + table + " scope:" + scope+" code:"+code + " lower_bound(request)：" + lower_bound);
            index++;
            let tabObj = await getTableInfoEx(config.httpEndpoint, code, scope, table, limit, null, lower_bound, null);
            let tableinfo = tabObj.res;
            req_error_info = tabObj.err;
            logger.debug("tableinfo:" + table + "):", tableinfo);
            if (utils.isNullList(tableinfo.rows) == false) {
                for (let i = 0; i < tableinfo.rows.length; i++) {
                    if (tableinfo.rows[i][pk] != lower_bound || lower_bound == null) {
                        tableObj.rows.push(tableinfo.rows[i]);
                    }
                }

                if (utils.isNotNull(pk)) {
                    lower_bound = tableinfo.rows[tableinfo.rows.length - 1][pk];
                }

                logger.info("table: " + table + " scope:" + scope + " lower_bound(change)：" + lower_bound);
            }

            //查看是否还有
            finish = true;
            if (utils.isNotNull(tableinfo.more) && tableinfo.more == true) {
                finish = false;
            }
            logger.debug("tableinfo more：" + tableinfo.more);
            if (index * limit >= count) {
                logger.info("table: " + table + " count > " + count + " break now!");
                break;
            }

        }
    } catch (e) {
        logger.error("getTableAllData error:", utils.logNetworkError(e));
        req_error_info = e
    }

    logger.debug("getTableAllData(" + table + "):", tableObj);
    return {res:tableObj,err:req_error_info};

}

module.exports = {
    getChainId,
    getChainInfo,
    getProducerLists,
    contractInteract,
    getAccount,
    getTableInfo,
    getTableAllData,
    getChainSeedIP,
    getChainSeedPk,
    getSubchanEndPoint,
    getSubchanMonitorService,
    getChainBlockDuration,
    monitorCheckIn,
    checkDeployFile,
    finsihDeployFile,
    addSwitchLog,
    getSubchainBlockNum,
    getSubchainCommittee,
    checkSubchainSeed,
    verifySign,
    getSeedInfo,
    checkMainchainSeed,
    addRestartLog,
    getMasterBlockNum,
    getHeadBlockNum,
    getMerkleProof,
    getHeadBlockProposer,
    getBlockHeaderInfo,
    getMinBlockHeaderInfo,
    confirmBlockCheckIn,
    getCommitteeBulletin,
    getChainIdByAllSeed,
    ramUsageCheckIn,
    getServerVersion,
    getBlockInfoData,
    getMasterHeadBlockNum,
    getTableAllScopeData,
    uploadugas,
    getCurrencyStats,
    uploadCurrency,
    formartDataFromMonitor,
    uploadHbOfflineProd,
    uploadChainBalance,
    getMaxBlock,
    uploadBlockLIst,
    uploadClaimRecord,
    uploadAlertTran,
    getSyncBlock,
    updateSyncBlock,
    uploadFailTran,
    getFailedTranList,
    finishFailedTranList,
    getGroupInfo,
    getChainHttpListByGroup,
    getChainSeedIPByGroup,
    getChainPeerKeyByGroup,
    get_table_records_info,
    checkSeedReady,
    getChainMaxBlockNum,
    getTableInfoEx,
    getTableAllDataEx,
}
