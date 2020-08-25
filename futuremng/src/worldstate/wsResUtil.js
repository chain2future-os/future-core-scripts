/**
 * 世界状态返回的状态码枚举
 * @type {{HASH_NOT_MATH: number, SUCCESS: number, ENDPOINT_UNREACHABLE: number, ONGOING: number}}
 */
var resCodeEnum = {
    SUCCESS: 0,
    ONGOING: 1,
    ENDPOINT_UNREACHABLE: 2,
    HASH_NOT_MATH: 3
}

/**
 * 判断是否成功
 * @param res
 * @returns {boolean}
 */
var isSuccess = function (res) {
    return checkStatus(res, resCodeEnum.SUCCESS);
}

/**
 * 判断还在进行中
 * @param res
 * @returns {boolean}
 */
var isOngoing = function (res) {
    return checkStatus(res, resCodeEnum.ONGOING);
}

/**
 * 错误
 * @param res
 * @returns {boolean}
 */
var isError = function (res) {
    return !checkStatus(res, resCodeEnum.SUCCESS);
}

/**
 * 比较状态
 * @param code
 * @param compareCode
 * @returns {boolean}
 */
var checkStatus = function (res, code) {
    try {
        // console.log("res: "+res.code);
        // console.log("compare: "+code);
        if (res.code == code) {
            return true;
        }
    } catch (e) {
        //logger.error("check ws res status", e);
    }

    return false;
}

module.exports = {
    isSuccess,
    isError,
    isOngoing,
}
