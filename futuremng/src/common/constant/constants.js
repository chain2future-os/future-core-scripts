var utils = require("../../common/util/utils")
/**
 * 命令相关常量
 *
 * @type {{KILL_NODFUTURE: string, KILL_WORLDSTATE: string}}
 */
var cmdConstants = {
    KILL_NODFUTURE: "killall 'nodfuture'",//关闭nodfuture
    KILL_WORLDSTATE: "killall 'wssfuture'", //关闭世界状态进程
    KILL_PM2: "killall 'pm2'",//关闭pm2
    PM2_LIST: "/usr/local/bin/pm2 list",//pm2 list
    CLEAR_BLOCK_DATA: "rm -rf ~/.local/share/futureio/nodfuture/data/blocks/",//清空本地块数据
    CLEAR_SHARED_MEMORY_DATA: "rm -rf ~/.local/share/futureio/nodfuture/data/state/",//清空memory.bin数据
    CLEAR_WORLD_STATE_FILE: "rm -rf ~/.local/share/futureio/wssfuture/data/worldstate/", //清空ws下文件
    CLEAR_STATE_FILE: "rm ~/.local/share/futureio/nodfuture/data/state/* -rf", //清空state目录文件
    START_WORLDSTATE: "~/workspace/future-core/build/programs/wssfuture/wssfuture > /log/ws.log 2>&1 &",//启动世界状态程序
    START_NODFUTURE: "sh ~/workspace/future-core/scripts/_runfuture.sh ~/workspace",//启动nod程序
    START_NODFUTURE_FILE: utils.formatHomePath("~/futuremng/tool/_runfuture.sh"),
    START_WORLDSTATE_FILE: utils.formatHomePath("~/futuremng/tool/_runworldstate.sh"),
    START_NODFUTURE_ARG: [utils.formatHomePath("~/workspace")],
    ENABLE_RESTART: "enableRestart",
    DISABLE_RESTART: "disableRestart",
    ENABLE_SYNC_USER_RES: "enableUserRes",
    DISABLE_SYNC_USER_RES: "disableUserRes",
    ADD_NOD_CONFIG: "ADD_NOD_CONFIG",
    ENABLE_SYNC_FGAS: "enableUgas",
    DISABLE_SYNC_FGAS: "disableUgas",
    ENABLE_SYNC_USER_RES_BY_BLOCK: "enableUserResByBlock",
    DISABLE_SYNC_USER_RES_BY_BLOCK: "disableUserResByBlock",
    SET_SYNC_BLOCK_MAX_COUNT: "syncBlockMaxCount",
    RESTART_NOD: "restartNod",
    UPDATE_MONITOR: "updateMonitor",
    ENABLE_SYNC_SERIVE: "enableSyncService" ,
    DISABLE_SYNC_SERIVE: "disableSyncService" ,
}

//编码常量
var encodingConstants = {
    UTF8: "UTF-8",
    GBK: "GBK",
}

//链常量
var chainNameConstants = {
    MAIN_CHAIN_NAME: "futureio",
    INVAILD_CHAIN_NAME: "zzzzzzzzzzzzj", //非法链
    MAIN_CHAIN_NAME_TRANSFER: "master", //只有转账的时候用它标志主链
    SUB_CHAIN_NAME: "subchain", //子链名字的统称
    DEFAULT_CHAIN_NAME: "default", //默认的新链
}

//时间常量（单位ms）
var timeConstats = {
    SECOND: 1000,
    SECONDS10: 1000 * 10,
    MINUTE: 1000 * 60,
    HOUR: 1000 * 60 * 60,
    DAY: 1000 * 60 * 60 * 24
}

//合约常量
var contractConstants = {
    FUTUREIO: "futureio",
    FUTIO_BANK:"futio.bank",
    FUTIO_RAND:"futio.rand",
    FUTIO_TOKEN:"futio.token",
    FUTIO_RES:"futio.res",
}

/**
 * 账号常量
 * @type {{FUTIO_SYSTEM: string}}
 */
var accountConstants = {
    FUTIO_SYSTEM:"futio.", //系统账号
    GENESIS_ACCOUNT:"genesis", //genesis账号
}

//action常量
var actionConstants = {
    EMPOWER_USER:"empoweruser",//用户授权到子链,
    RESOURCE_LEASE:"resourcelease",//购买资源
    RESOURCE_TRANSFER:"transferresource",//转义资源
    MOVE_PROD:"moveprod",//委员会调度
    TRANSFER:"transfer",//转账
    SETCODE:"setcode",//setcode
    SETAPI:"setabi",//setabi
    REG_PRODUCER:"regproducer",//regproducer
    DELEGATE_CONS:"delegatecons",//delegatecons
    UN_DELEGATE_CONS:"undelegatecons",//undelegatecons
    UPDATE_AUTH:"updateauth",//updateauth
    DELETE_AUTH:"deleteauth",//deleteauth
    LINK_AUTH:"linkauth",//linkauth
    UNLINK_AUTH:"unlinkauth",//unlinkauth
    ACCEPT_MASTER:"acceptmaster",//acceptmaster
    ACCEPT_HEADER:"acceptheader",//acceptheader
    SYNC_LIGHTCLIENT_TRAN:"synclwctx",//synclwctx
    PROD_HEAER_BEAT:"prodheartbeat",//prodheartbeat
}

//表常量
var tableConstants = {
    RESOURCE_LEASE: "reslease",//用户资源表，
    WORLDSTATE_HASH: "wshash", //世界状态hash表
    GLOBAL: "global",
    BULLETIN_BANK: "bulletinbank",
    CHAINS: "chains",
    BLOCK_HEADER:"blockheaders",
    NEWCHAIN: "newchain",
    BRIEFPROD: "briefprod",
    FIXED_COMMITTEE: "fixedcmt",
}

//scode常量
var scopeConstants = {
    SCOPE_MAIN_CHAIN: "futureio",//主链scope
    SCOPE_WSS_HASH: "futio.wshash",//世界状态表scope
}

//chainid常量
var chainIdConstants = {
    NONE_CHAIN: "0000000000000000000000000000000000000000000000000000000000000000",//未同步子链创世块
}

//路径常量
var pathConstants = {
    WSS_DATA: utils.formatHomePath("~/.local/share/futureio/wssfuture/data/worldstate/download/"),
    WSS_LOCAL_DATA: utils.formatHomePath("~/.local/share/futureio/wssfuture/data/worldstate/"),
    MNG_CONFIG: utils.formatHomePath("~/.local/share/futureio/futuremng/config/"),
    FILE_DOWNLOAD_PATH:utils.formatHomePath("~/.local/share/futureio/futuremng/download/"),
    SYNC_SERVICES_PATH: utils.formatHomePath("~/.local/share/futureio/futuremng/config/sync.json"),
    WSS_BLOCKMERKLE_PATH: utils.formatHomePath("~/.local/share/futureio/nodfuture/data/wsroot/"),
    LAST_CHECK_SLEEP_PATH: utils.formatHomePath("~/.local/share/futureio/futuremng/config/last_check_sleep.json"),
}

//ini配置常量
var iniConstants = {
    UDP_SEED: "udp-seed",
    MONITOR_SERVER_ENDPOINT: "monitor-server-endpoint",
    P2P_PEER_ADDRESS: "p2p-peer-address",
    RPOS_P2P_PEER_ADDRESS: "rpos-p2p-peer-address",
    SUBCHAIN_HTTP_ENDPOINT: "subchainHttpEndpoint",
    GENESIS_TIME: "genesis-time",
    GENESIS_PK: "genesis-pk",
    MNG_PATH: "mngpath",
    NOD_PATH: "nodpath",
    WSS_PATH: "wsspath",
    MONITOR: "monitor",
    PEER_KEY: "peer-key",
    CHAIN_NAME: "chain-name",
    MONGODB_BLOCK_START: "mongodb-block-start",
}

/**
 * 缓存key常量
 * @type {{NOD_FILE_KEY: string, MNG_FILE_KEY: string}}
 */
var cacheKeyConstants = {
    NOD_FILE_KEY: "nod_file_key",
    MNG_FILE_KEY: "mng_file_key",
    WS_FILE_KEY: "ws_file_key",
    RAND_FILE_KEY: "rand_file_key",
    SERVER_VERSOIN_KEY: "server_version_key",
    SEED_CONFIG_KEY: "seed_config_key",
    GROUP_CONFIG_KEY: "group_config_key"
}

/**
 * 文件名constants
 * @type {{NOD_EXE_FILE: string}}
 */
var filenameConstants = {
    NOD_EXE_FILE: "nodfuture",
    MNG_FILE: "sideChainService.js",
    WS_EXE_FILE:"wssfuture",
    RAND_FILE:"votingRandService.js",
    GROUP_FILE:"group.json"
}

/**
 * 加密算法
 * @type {{SHA256: string, SHA1: string, MD5: string}}
 */
var algorithmConstants = {
    MD5 : "md5",
    SHA1 : "sha1",
    SHA256 : "sha256"
}

/**
 * status 常量
 * @type {{STARTING: number, SUCCESS: number, STOP: number, EXCEPTION: number, UNSTART: number}}
 */
var statusConstants = {
    SUCCESS: 4,
    EXCEPTION: 3,
    STOP: 2,
    STARTING: 1,
    UNSTART: 0
}

/**
 *
 * @type {{STARTING: number, SUCCESS: number, STOP: number, EXCEPTION: number, UNSTART: number}}
 */
var alertTranTypeConstants = {
    BIG_AMOUNT_TRANSFER: 1,//大额转账
    SET_CODE_OR_API: 2,//设置合约相关
    PRODUCER_INFO: 3,//矿工相关
    AUTH_INFO: 4, //权限相关
}

var PRIVATE_KEY = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6TQALgms1BnT02fowOtSGGCQ1ed1GVWvzODASnDMlyRsbiwnsMROf7YZ7umA4ma5n9erPyw27ile7JDjsQo1GbUZn2tAbjg1G7VPgkxp9QZp8uXquTI9bDEYXIeYQS9f71mh8DkR3VOUru8+j5uCOqmF+jiDMOt8qf5Yyhw5fbQIDAQAB";
//API验证时间前后不超过1小时（单位ms）
var API_MAX_INTEVAL_TIME = 1000 * 60 * 60;

//未知用户
var UNKNOWN_USER = "unknown001";

//报警transfercount
var TRANSFER_ALERT_COUNT=500000;

//启动回放命令
var CMD_HARDREPLAY_BLOCKS= " --hard-replay-blockchain";

/**
 * apiTimeConstants
 * @type {{SEED_CHECK_API_TIME: number, DEFAULT_API_TIME: number}}
 */
var apiTimeConstants = {
    DEFAULT_SEED_API_TIME : 6000,
    LOCAL_API_TIME : 3000,
}



module.exports = {
    cmdConstants,
    encodingConstants,
    chainNameConstants,
    timeConstats,
    contractConstants,
    tableConstants,
    actionConstants,
    scopeConstants,
    chainIdConstants,
    pathConstants,
    iniConstants,
    cacheKeyConstants,
    filenameConstants,
    algorithmConstants,
    statusConstants,
    PRIVATE_KEY,
    API_MAX_INTEVAL_TIME,
    UNKNOWN_USER,
    apiTimeConstants,
    TRANSFER_ALERT_COUNT,
    alertTranTypeConstants,
    accountConstants,
    CMD_HARDREPLAY_BLOCKS,
}
