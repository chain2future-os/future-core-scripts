var log4js = require('log4js');
const fs = require('fs');
var os = require('os');
const ini = require('ini');
var pathConstants = require("../common/constant/constants").pathConstants;
var constant = require("../common/constant/constants");

/**
 * log文件mng（前缀+系统名+时间）
 * @type {string}
 */
var dir = "/log/";
var filename = "mng-"+os.hostname()+"-";

/**
 * log整体配置
 * @type {{categories: {default: {level: string, appenders: string[]}}, appenders: {console: {type: string}, default: {filename: string, "maxLogSize ": number, alwaysIncludePattern: boolean, pattern: string, type: string}}}}
 */
var logConfig = {
    "appenders": {
        "console": {
            "type": "console"
        },
        "default": {
            "type": "dateFile",
            "filename": dir+filename,
            "pattern": "yyyy-MM-dd.log",
            "alwaysIncludePattern": true,
        }
    },
    "categories": {
        "default": {
            "appenders": [
                "console",
                "default"
            ],
            "level": "info" //ALL TRACE DEBUG INFO WARN ERROR FATAL OFF.

        }
    }
};

//read config
try {
    var configIniLocal = ini.parse(fs.readFileSync(pathConstants.MNG_CONFIG+"config.ini", constant.encodingConstants.UTF8));
    var level = configIniLocal.logLevel;
    if (level != null && level != undefined && level != "") {
        logConfig.categories.default.level = level;
    }
} catch (e) {
    console.log("read config file error of log info");
}


log4js.configure(logConfig);

/**
 *
 * @param categoty
 * @returns {Logger}
 */
var getLogger = function(categoty) {
    return require('log4js').getLogger(categoty);
}

module.exports = {
    getLogger
}
