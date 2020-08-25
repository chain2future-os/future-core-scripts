#!/usr/bin/env python

import argparse
import os
import random
import subprocess
import sys
import time
import requests
import json
from email.header import Header
from email.mime.text import MIMEText
import smtplib
from datetime import datetime
args = None
logFile = None
isMasterNet = False
testNetHttp = {
    "futureio":"http://127.0.0.1:8888",#"http://172.16.10.9:8888",
    "11":"http://172.16.10.9:8899",
    "12":"http://172.16.10.9:9999",
    "13":"http://172.16.10.9:9911",
}

masterNetHttp = {
    "futureio":"http://120.92.168.236:8888",#  "futureio":"https://future.services",
    "pioneer":"http://120.92.173.112:8888",#  "pioneer":"https://pioneer.future.services",
    "unitopia":"http://120.92.155.45:8888",#  "unitopia":"https://unitopia.future.services",
    "newretail":"http://110.43.42.136:8888",#  "newretail":"https://new-retail.future.services",
    "australia":"http://120.92.210.218:8888",#"australia":"https://australia.future.services"
}
emailReceiver = "yanhuichao@future.io"#,suyu@future.io,chenxiaojian@future.io,shenyufeng@future.io"
defaultpatch = "/root/workspace"
defaultclu = '%s/future-core/build/programs/clfuture/clfuture --wallet-url http://127.0.0.1:6666 '
defaultkul = '%s/future-core/build/programs/kfutured/kfutured'
defaultcontracts_dir = '%s/future-core/build/contracts/'
netHttpList = testNetHttp
cur_claim_account = "u.claim.1"

def jsonArg(a):
    return " '" + json.dumps(a) + "' "

def run(args):
    print('bios-test.py:', args)
    logFile.write(args + '\n')
    if subprocess.call(args, shell=True):
        print('bios-test.py: exiting because of error')
        sys.exit(1)

def simple_run(args):
    print('bios-test.py:', args)
    logFile.write(args + '\n')
    if subprocess.call(args, shell=True):
        print('bios-test.py: error')

def retry(args):
    retry_size = 0
    while True:
        print('bios-test.py:', args)
        logFile.write(args + '\n')
        if subprocess.call(args, shell=True):
            sleep(0.2)
            print('*** Retry')
            retry_size += 1
            if retry_size > 30:
                return False
        else:
            return True

def sleep(t):
    print('sleep', t, '...')
    time.sleep(t)

def readfile(fname):
	fileold = open(fname, "r")
	content = fileold.readlines()
	fileold.close()
	return content

def writefile(fname,content):
	filenew = open(fname, "w")
	filenew.writelines(content)
	filenew.close()


def sendEmail(msg,successFlag):
    """
    邮件通知
    :param str: email content
    :return:
    """
    receiver = emailReceiver
    try:
        sender = "739884701@qq.com"
        subject = '测试网矿工奖励发放'
        if isMasterNet:
            subject = '主网矿工奖励发放'
        status = "--失败"
        if successFlag == True :
            status = "--成功"
        subject = subject+status;
        username = "739884701"
        password = "cfiawwwcqltbbcic"
        host = "smtp.qq.com"
        s = "{0}".format(msg)

        msg = MIMEText(s, 'plain', 'utf-8')  # 中文需参数‘utf-8’，单字节字符不需要
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = sender
        msg['To'] = receiver

        smtp = smtplib.SMTP_SSL()
        smtp.connect(host)
        smtp.login(username, password)
        smtp.sendmail(sender, receiver.split(","), msg.as_string())
        smtp.quit()
        print(" email send success")
    except Exception as e:
        print(" email error", e)

def getrewardaccount(producer):
    producer = producer + ".r"
    prodlen = len(producer)
    if prodlen > 12:
        producer = producer[(prodlen-12):prodlen]
    if producer[0] == '.':
        producer = "a"+producer[1:]
    return producer
def readConfigInfo( self ):
    if not os.path.isfile("~/record.json") :
        return
    load_dict = None
    with open("~/record.json",'r') as load_f:
        load_dict = json.load(load_f)
        json_str = json.dumps(load_dict)
        print(json_str)
        logFile.write('\n ~/record.json:'+json_str+'\n')
    return load_dict

def writeConfigInfo( chainProdDict ):
    time_name = time.strftime('%Y.%m.%d',time.localtime(time.time()))
    with open( defaultpatch + "/claimrewards/record/%s_record.json" % time_name,"w") as f:
        json.dump(chainProdDict,f)
        print("write success...")

def getProdUnpaidBalance():
    totalUnpaidBalance = 0.0000
    j = json.loads(requests.get(netHttpList["futureio"]+"/v1/chain/get_producers",data = json.dumps({"json":"true","all_chain":"true"})).text)
    print("%-12.12s  %-12.12s    %-14.14s" %( "chain_name", "producer", "reward"))

    for prod in j["rows"]:
        if prod["chain_name"] == "futureio":
            continue
        print("%-12.12s  %-12.12s    %.4f FGAS" %(prod["chain_name"],prod["prod_detail"]["owner"],float(prod["prod_detail"]["unpaid_balance"])/10000))
        totalUnpaidBalance += float(prod["prod_detail"]["unpaid_balance"])/10000
    print("totalUnpaidBalance:%.4f FGAS" % totalUnpaidBalance)
    return totalUnpaidBalance

def claimForMaintainer():
    clu = args.clfuture + ' -u ' + netHttpList["futureio"]
    maintainerDict = json.loads(requests.get(netHttpList["futureio"]+"/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":"maintainer","table":"upaiddisprod","json":"true"})).text)
    for i in range( 0, len(maintainerDict["rows"])):
        cur_container = maintainerDict["rows"][i]["owner"]
        retry(clu + '''  push action futureio  claimrewards  '["%s"]'  -p %s@active  -x 200''' % (cur_container, cur_claim_account) )
        sleep(1)


def utc2local( utc_dtm ):
    # UTC 时间转本地时间（ +8:00 ）
    local_tm = datetime.fromtimestamp( 0 )
    utc_tm = datetime.utcfromtimestamp( 0 )
    offset = local_tm - utc_tm
    return utc_dtm + offset

def claimRewards():
    clu = args.clfuture + ' -u ' + netHttpList["futureio"]
    chainProdDict = {}
    chainProdDict["time"] = time.strftime('%Y.%m.%d %H:%M:%S',time.localtime(time.time()))
    chainProdDict["data"] = []
    sendMsg = " 提取矿工奖励 开始时间:%s" % chainProdDict["time"]
    isAllSucceed = True
    totalPaidBalance = 0
    sidechainNumber = 0
    minProducer = ""
    minProduceRewards = 0
    maxProducer = ""
    maxProduceRewards = 0
    notClaimProdStr = "\n未提取奖励成功的矿工为:"
    tatalProducerNum = 0
    chainInfoDict = json.loads(requests.get(netHttpList["futureio"]+"/v1/chain/get_chain_info").text)
    print( chainInfoDict )
    startBlock = chainInfoDict["head_block_num"]
    rewardsInfo = "\n  %-12.12s   %-12.12s    %-14.14s" %( "矿工","收款账号", "奖励" )
    futioRewardInfo = ""
    prodInfoDict = json.loads(requests.get(netHttpList["futureio"]+"/v1/chain/get_producers",data = json.dumps({"json":"true","all_chain":"true"})).text)
    for i in range(0, len(prodInfoDict["rows"])):
        cur_producer = prodInfoDict["rows"][i]["prod_detail"]["owner"]
        if prodInfoDict["rows"][i]["chain_name"] == "futureio":
            continue
        retry(clu + '''  push action futureio  claimrewards  '["%s"]'  -p %s@active  -x 200''' % (cur_producer, cur_claim_account) )
        sleep(1)
    claimForMaintainer()
    sleep(20)
    for i in range(startBlock,startBlock + 360):
        blockInfoDict = json.loads(requests.get(netHttpList["futureio"]+"/v1/chain/get_block_info",data = json.dumps({"block_num_or_id": i})).text)
        if ("code" in blockInfoDict) and blockInfoDict["code"] == 500:
            break
        for trx in blockInfoDict["transactions"]:
            for act in trx["trx"]["transaction"]["actions"]:
                if act["account"] == "futureio" and act["name"] == "rewardproof":
                    proofInfoDict = json.loads(act["data"]["proof_info"])
                    paid_balance = int(proofInfoDict["paid_balance"])
                    if proofInfoDict["producer"] == "futio.cmnity" \
                        or proofInfoDict["producer"] == "futio.dapp" \
                        or proofInfoDict["producer"] == "futio.thteam":
                        futioRewardInfo += "\n公司账号:%s, 奖励为:%.4f FGAS" % ( proofInfoDict["producer"], paid_balance/10000 )
                    else:
                        tatalProducerNum += 1
                        if minProduceRewards == 0 or minProduceRewards > paid_balance:
                            minProduceRewards = paid_balance
                            minProducer = proofInfoDict["producer"]
                        if maxProduceRewards == 0 or maxProduceRewards < paid_balance:
                            maxProduceRewards = paid_balance
                            maxProducer = proofInfoDict["producer"]
                        totalPaidBalance += paid_balance
                        rewardsInfo += "\n  %-12.12s   %-12.12s    %.4f FGAS" % ( proofInfoDict["producer"], proofInfoDict["reward_account"], paid_balance/10000 )
                    utc_tm = dt = datetime.strptime(blockInfoDict["timestamp"], '%Y-%m-%dT%H:%M:%S.000')
                    local_tm = utc2local(utc_tm)
                    print( "tran loc time:\t", local_tm.strftime("%Y.%m.%d %H:%M:%S"),"blockheight:\t", i )
                    proofInfoDict["time"] = local_tm.strftime("%Y.%m.%d %H:%M:%S")
                    chainProdDict["data"].append(proofInfoDict)
        sleep(0.1)
    print( json.dumps( chainProdDict ) )
    sendMsg += futioRewardInfo
    chainsInfoDict = json.loads(requests.get(netHttpList["futureio"]+"/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":"futureio","table":"chains","json":"true"})).text)
    for i in range(0, len(prodInfoDict["rows"])):
        cur_producer = prodInfoDict["rows"][i]["prod_detail"]["owner"]
        if prodInfoDict["rows"][i]["chain_name"] == "futureio":
            continue
        isSerchSucc = False
        for j in range(0, len(chainProdDict["data"])):
            if cur_producer == chainProdDict["data"][j]["producer"]:
                isSerchSucc = True
                break
        if not isSerchSucc:
            isAllSucceed = False
            notClaimProdStr += cur_producer +", "
    if not isAllSucceed:
        sendMsg += notClaimProdStr
    if tatalProducerNum != 0:
        sendMsg += "\n侧链数:%d 矿工数量:%d 奖励总金额:%.4f FGAS 矿工平均金额:%.4f FGAS " % (len(chainsInfoDict["rows"]), tatalProducerNum, totalPaidBalance/10000,totalPaidBalance/10000/tatalProducerNum)
    sendMsg += "\n奖励最少的矿工:%s 奖励为:%.4f FGAS" % (minProducer, minProduceRewards/10000)
    sendMsg += "\n奖励最多的矿工:%s 奖励为:%.4f FGAS" % (maxProducer, maxProduceRewards/10000) + rewardsInfo
    writeConfigInfo( chainProdDict )
    sendEmail( sendMsg, isAllSucceed )


# Command Line Arguments

parser = argparse.ArgumentParser()

commands = [
    ('g', 'getProdUnpaidBalance',    getProdUnpaidBalance,   True,    "getProdUnpaidBalance"),
    ('c', 'claimRewards',            claimRewards,           False,    "claimRewards"),
]

parser.add_argument('--clfuture', metavar='', help="Clfuture command", default=defaultclu % '/root/workspace')
parser.add_argument('--kfutured', metavar='', help="Path to kfutured binary", default=defaultkul % '/root/workspace')
parser.add_argument('--contracts-dir', metavar='', help="Path to contracts directory", default=defaultcontracts_dir % '/root/workspace')
parser.add_argument('--wallet-dir', metavar='', help="Path to wallet directory", default='./wallet/')
parser.add_argument('--log-path', metavar='', help="Path to log file", default='/claimrewards/output.log')
parser.add_argument('--symbol', metavar='', help="The futio.system symbol", default='FGAS')
parser.add_argument('-al', '--all', action='store_true', help="Do everything marked with (*)")
parser.add_argument('-H', '--http-port', type=int, default=8000, metavar='', help='HTTP port for clfuture')
parser.add_argument('-p','--programpath', metavar='', help="set programpath params")
parser.add_argument('-m', '--masterchain', action='store_true', help="exec masternet")

for (flag, command, function, inAll, help) in commands:
    prefix = ''
    if inAll: prefix += '*'
    if prefix: help = '(' + prefix + ') ' + help
    if flag:
        parser.add_argument('-' + flag, '--' + command, action='store_true', help=help, dest=command)
    else:
        parser.add_argument('--' + command, action='store_true', help=help, dest=command)

args = parser.parse_args()
if args.programpath:
    args.clfuture = defaultclu % (args.programpath)
    args.kfutured = defaultkul % (args.programpath)
    args.contracts_dir = defaultcontracts_dir % (args.programpath)
    defaultpatch = args.programpath
if args.masterchain:
    netHttpList = masterNetHttp
    isMasterNet = True
args.log_path = defaultpatch + args.log_path
print(args.clfuture)
print(args.kfutured)
print(args.contracts_dir)
if not os.path.isdir(defaultpatch+"/claimrewards/record"):
    os.system("mkdir -p %s/claimrewards/record" % defaultpatch)
logFile = open(args.log_path, 'w')

logDateStr = '\n\n' + '*' * 80 + "\n current time:%s \n" % time.strftime('%Y.%m.%d %H:%M:%S ',time.localtime(time.time()))
logFile.write(logDateStr)
print(logDateStr)
haveCommand = False
for (flag, command, function, inAll, help) in commands:
    if getattr(args, command) or inAll and args.all:
        if function:
            haveCommand = True
            function()
if not haveCommand:
    print('claim_rewards.py: Tell me what to do. -a does almost everything. -h shows options.')
