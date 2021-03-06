const crypto = require('crypto');
const fs = require('fs');
var logger = require("../../config/logConfig").getLogger("HashUtil");

/**
 *
 * @param str
 * @param algorithm
 * @param encoding
 * @returns {string}
 */
function checksum(str, algorithm, encoding) {

    let hash = crypto.createHash(algorithm);
    hash.update(str, encoding);
    return hash.digest('hex');
}

/**
 *
 * @param filepath
 * @returns {Promise<*>}
 */
 function calcHash(filepath,algorithm) {
    try {
        logger.debug("start calc hash file :",filepath);
        if (fs.existsSync(filepath)) {
            let data =fs.readFileSync(filepath,null);
            //logger.info("data:",data);
            let hash =  checksum(data, algorithm,null);
            logger.debug("finish calc hash file :",filepath);
            logger.debug("finish calc hash file hash :",hash);
            return hash;

        } else {
            logger.error("hashutil not exist:",filepath);
        }

    } catch (e) {
        logger.error("calc hash file error:",e);
    }

    return null;

}

function calcMd5(data) {
    try {
        return checksum(data, "md5",null);
    } catch (e) {
        logger.error("calcMd5 error:",e)
    }

    return null;
}

module.exports = {
    calcHash,
    calcMd5
}



