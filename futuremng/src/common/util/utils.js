//var logger = require("../../config/logConfig").getLogger("Utils");
const publicIp = require('public-ip');
const path = require('path');
const os = require('os');

/**
 * 判断是否为空
 * @param data
 * @returns {boolean}
 */
function isNull(data) {
    return (data == "" || data == undefined || data == null) ? true : false;
}

/**
 * 判断是否为空
 * @param data
 * @returns {boolean}
 */
function isNullList(data) {
    if (isNull(data)) {
        return true;
    }

    if (data.length ==0) {
        return true;
    }
    return false;
}

/**
 * 判断是否不为空
 * @param data
 * @returns {boolean}
 */
function isNotNull(data) {
    return isNull(data) == false;
}

/**
 * 判断所有参数是否都不为空
 * @returns {boolean}
 */
function isAllNotNull() {

    for (var i = 0; i < arguments.length; i++) {
        if (isNull(arguments[i])) {
            return false;
        }
    }

    return true;
}

/**
 *
 * @param e
 * @returns {*}
 */
function logNetworkError(e) {

    if (isNotNull(e.data)) {
        return e.data;
    }

    if (isNotNull(e.code)) {
        return e.code;
    }

    return e;
}

/**
 * 获取本机ip
 * @returns {*|string}
 */
function getLocalIPAdress(){
    var interfaces = require('os').networkInterfaces();
    //console.log(interfaces);
    for(var devName in interfaces){
        var iface = interfaces[devName];
        for(var i=0;i<iface.length;i++){
            var alias = iface[i];
            if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal){
                return alias.address;
            }
        }
    }
}

/**
 * 获取外网ip
 * @returns {Promise<void>}
 */
var cachePublicIp = "";
var ptime = 0;
var errortime = 0;
getPublicIp = async () => {

    let ip = getLocalIPAdress();
    //logger.info("cachePublicIp:",cachePublicIp);
    if (isNotNull(cachePublicIp)) {
        ip = cachePublicIp;
        ptime++;
    }
    if (ptime == 0) {
        try {

            let retry = 3;
            let res = await publicIp.v4();
            while (isNull(res)) {
                res = await publicIp.v4();
                retry--;
                if (retry <= 0) {
                    break;
                }
            }

            if (isNotNull(res)) {
                ip = res;
                cachePublicIp = res;
            }
        } catch (e) {
            console.error("getPublicIp error:", e);
        }
    }

    if (ptime >= 10) {
        ptime = 0;
    }
    console.error("PublicIp:",ip);
    return ip;
}

/**
 *
 * @param str
 * @param logstr
 */
function addLogStr(str,logstr) {
    let time  = getLocalTime();
    return str + time+":"+logstr +"\r\n    ";
}

function getLocalTime() {
    return new Date(parseInt(new Date().getTime()) * 1).toLocaleString().replace(/:\d{1,2}$/,' ');
}

function getTodayString() {
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth()+1;
    let day = now.getDate();
    let res = year + ".";
    if (month < 10) {
        res = res + "0" + month;
    } else {
        res = res + month;
    }
    res = res + ".";
    if (day < 10) {
        res = res + "0" + day;
    } else {
        res = res + day;
    }

    return res;
}

/**
 *
 * @param filepath
 * @returns {*}
 */
function formatHomePath(filepath) {
    if (filepath.indexOf("~") == 0) {
        return path.join(os.homedir(),filepath.substr(1));
    }

    return filepath;
}

/**
 *
 * @param num1
 * @param num2
 * @returns {*}
 */
function calcMin(num1,num2) {
    if (num1 < num2) {
        return num1;
    }

    return num2;
}



function ipToNumber(ip) {
    var numbers = ip.split(".");
    return parseInt(numbers[0])*256*256*256 +
        parseInt(numbers[1])*256*256 +
        parseInt(numbers[2])*256 +
        parseInt(numbers[3]);
}

function numberToIp(number) {
    return (Math.floor(number/(256*256*256))) + "." +
        (Math.floor(number%(256*256*256)/(256*256))) + "." +
        (Math.floor(number%(256*256)/256)) + "." +
        (Math.floor(number%256));
}


/**
 * 检查ip是否属于局域网
 * @param localIp
 * @param netGateway
 * @param subnetMask
 * @returns {boolean}
 */
function checkIpBelongsToLocalNet(localIp, startIp, endIp) {

    let belongFlag = false;
    try {
        let localIpNum = ipToNumber(localIp);
        let startIpNum = ipToNumber(startIp);
        let endIpNum = ipToNumber(endIp);

        if (localIpNum >= startIpNum && localIpNum <= endIpNum) {
            return true;
        }

    } catch (e) {
        console.log("checkBelongsToSubnet error:",e);
    }

    return belongFlag;
}

module.exports = {
    isNull,
    isNotNull,
    isAllNotNull,
    logNetworkError,
    isNullList,
    getLocalIPAdress,
    getPublicIp,
    addLogStr,
    formatHomePath,
    calcMin,
    getTodayString,
    checkIpBelongsToLocalNet,
}
