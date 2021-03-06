#!/usr/bin/python
# -*- coding: UTF-8 -*-
from email.header import Header
from email.mime.text import MIMEText
import smtplib
import argparse
import json
import os
import random
import re
import subprocess
import sys
import time
import string
import requests
import datetime
from ConfigParser import ConfigParser
args = None
logFile = None

defaultclu = '%s/future-core/build/programs/clfuture/clfuture --wallet-url http://127.0.0.1:6666 '
schduleaccounts=[]

conf = ConfigParser()
curindex = 0
curblockheight = 0
if os.path.isfile("/root/workspace/future-core/scripts/mutichain.cfg") :
    conf.read("/root/workspace/future-core/scripts/mutichain.cfg")
    curindex = conf.getint('config', 'index')
    curblockheight = conf.getint('config', 'blockheight')
basis_value = curindex*150
maxnum=5
prefixStr="test.a."
output=['1']*maxnum
print "basis_value："
print basis_value

def out() :
    str = prefixStr
    for i in range(0, maxnum):
        str = '%s%s'%(str,output[maxnum-i-1])
    #print(str)
    return str;

def addAcc():
    for j in range(0,maxnum):
        if output[j] == '5':
            output[j] = 'a'
        else :
            output[j]=chr(ord(output[j])+1);

        if output[j] == chr(ord('z')+1):
            output[j]='1'
        else:
            break

def generateAccounts(startNum,endNum) :
    print "startNum:";
    print startNum;
    print " endNum:";
    print endNum;
    outNum=["1"]*(endNum-startNum);
    t=0;
    for i in range(0, endNum):
        #print i;
        str = out();
        if i >= startNum :
            #print "i >= startNum";
            #print  str;
            outNum[t]=str;
            t=t+1;
        addAcc();
    return outNum;

schduleaccounts = generateAccounts(basis_value, basis_value + 150);
sidechainacc = schduleaccounts[0:150]
sidechainacc1 = schduleaccounts[0:50]
sidechainacc2 = schduleaccounts[50:100]
sidechainacc3 = schduleaccounts[100:150]


print  schduleaccounts;

local= True;
sub1HttpUrlLocal = "172.16.10.5:8888"
sub2HttpUrlLocal = "172.16.10.5:8899"
sub3HttpUrlLocal = "172.16.10.5:8888"
sub1HttpUrl = "172.31.7.20:8888"
sub2HttpUrl = "172.31.12.250:8888"
sub3HttpUrl = "172.31.8.22:8888"


def run(args):
    print('bios-boot-tutorial.py:', args)
    logFile.write(args + '\n')
    if subprocess.call(args, shell=True):
        print('bios-boot-tutorial.py: exiting because of error')
        sys.exit(1)
def retry(args):
    retyrnum = 0
    while True:
        print('bios-boot-tutorial.py:', args)
        logFile.write(args + '\n')
        if subprocess.call(args, shell=True):
            print('*** Retry')
            retyrnum += 1
            if retyrnum > 500:
                break
        else:
            break

def sleep(t):
    print('sleep', t, '...')
    time.sleep(t)
    print('resume')

def sendEmail(msg,successFlag):
    """
    邮件通知
    :param str: email content
    :return:
    """
    receiver = "sidechain@future.io"
    if local == True :
        receiver = "chenxiaojian@future.io" ;

    try:
        sender = "739884701@qq.com"
        subject = '今日测试账户资源同步'
        if local == True:
            subject = '今日测试账户资源同步(docker环境)'
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
        print("邮件已通知, 请查收")
    except Exception as e:
        print("邮件配置有误", e)

def createmutiaccounts():
    for a in sidechainacc:
        retry(args.clfuture + 'create account -u futureio ' + a + ' ' + args.initacc_pk)
    sleep(10)
    print "sidechain";
    print sidechainacc1;
    if args.subchainNum >= 1:
        for a in sidechainacc1:
            retry(args.clfuture + ' system empoweruser %s %s %s %s 1 -p %s@active' %(a,"11",args.initacc_pk,args.initacc_pk,a))
    if args.subchainNum >= 2:
        for a in sidechainacc2:
            retry(args.clfuture + ' system empoweruser %s %s %s %s 1 -p %s@active' %(a,"12",args.initacc_pk,args.initacc_pk,a))
    if args.subchainNum >= 3:
        for a in sidechainacc3:
            retry(args.clfuture + ' system empoweruser %s %s %s %s 1 -p %s@active' %(a,"13",args.initacc_pk,args.initacc_pk,a))

def stepmutireslease():
    if args.subchainNum >= 1:
        for a in sidechainacc1:
            retry(args.clfuture + ' system resourcelease futureio %s 1  20  %s -p %s@active' %(a,"11",a))
    if args.subchainNum >= 2:
        for a in sidechainacc2:
            retry(args.clfuture + ' system resourcelease futureio %s 2  15  %s -p %s@active' %(a,"12",a))
    if args.subchainNum >= 3:
        for a in sidechainacc3:
            retry(args.clfuture + ' system resourcelease futureio %s 3  25  %s -p %s@active' %(a,"13",a))

def voteresrelet():
    #购买资源
    if args.subchainNum >= 1:
        for a in sidechainacc1:
            retry(args.clfuture + ' system resourcelease futureio %s 3  0  %s -p %s@active' %(a,"11",a))
    if args.subchainNum >= 2:
        for a in sidechainacc2:
            retry(args.clfuture + ' system resourcelease futureio %s 0  15  %s -p %s@active' %(a,"12",a))
    if args.subchainNum >= 3:
        for a in sidechainacc3:
            retry(args.clfuture + ' system resourcelease futureio %s 1  0  %s -p %s@active' %(a,"13",a))

def getaccresinfo(ip,acclist,nofindacc,leasenum,days,reslist):
    for a in acclist:
        j = json.loads(requests.get("http://"+ip+"/v1/chain/get_account_info",data = json.dumps({"account_name":a})).text)
        if ("account_name" in j):
            continue
        nofindacc.append(a)
    num = 1;
    for a in acclist:
        j = json.loads(requests.get("http://"+ip+"/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":"futureio","table":"reslease","json":"true","limit":1000,"table_key":a})).text)
        if len(j["rows"])== 0 :
            reslist.append(a)
            continue
        if (a == j["rows"][0]["owner"]) and (leasenum == j["rows"][0]["lease_num"]):
            print "-----"+str(num);
            print "expect days:"+str(days);
            startBlockNum = j["rows"][0]["start_block_height"]
            endBlockNum = j["rows"][0]["end_block_height"]
            lease_days = (endBlockNum - startBlockNum)/(6*60*24)
            print "actual days:"+str(lease_days);
            print "-----"+str(num);
            num = num +1;
            if lease_days == days :
                continue
        reslist.append(a)

def getchaincontext(chainname,sidechainacc,chainnofindacc,chainnofindres):
    chaininfostr = "子链:"+chainname+" \n"+"同步账户数量为"+str(len(sidechainacc))+" \n账户列表为:"
    for a in sidechainacc:
        chaininfostr += a +","
    accnum = len(chainnofindacc)
    chaininfostr += "\n检测剩余未同步数量为:"+str(accnum)
    if accnum != 0 :
        chaininfostr += "\n 未同步账户:"
        for i in range(accnum):
            chaininfostr += chainnofindacc[i] +","
    resnum = len(chainnofindres)
    chaininfostr += "\n同步资源数量为"+str(len(sidechainacc))+"，资源异常数量为:"+str(resnum)
    if resnum != 0 :
        chaininfostr += "\n 资源异常账户:"
        for i in range(resnum):
            chaininfostr += chainnofindres[i] +","
    return chaininfostr + "\n\n"

def deleteHistory():
    if os.path.isfile("/root/workspace/future-core/scripts/mutichain.cfg") :
        os.remove("/root/workspace/future-core/scripts/mutichain.cfg");

def merkleproof():
    global curblockheight
    curproofindex = 0
    verifysucblock = []
    verifyfailblock = []
    while True:
        curproofindex += 1
        if curproofindex > 1000:
            break
        addvalue = random.randint(1, 50)
        curblockheight += addvalue
        reqblockinfo = requests.get("http://127.0.0.1:8888/v1/chain/get_block_info",data = json.dumps({"block_num_or_id":str(curblockheight)})).text
        j = json.loads(reqblockinfo)
        if not ("proposer" in j):
            break
        if len(j["transactions"]) == 0:
            continue
        trx_id = j["transactions"][0]["trx"]["id"]
        transaction_mroot = j["transaction_mroot"]
        req_getmerkle = requests.get("http://127.0.0.1:8888/v1/chain/get_merkle_proof",data = json.dumps({"block_number":curblockheight,"trx_id":trx_id})).text
        merkle_j = json.loads(req_getmerkle)
        merkle_proof = merkle_j["merkle_proof"]
        trx_receipt_bytes = merkle_j["trx_receipt_bytes"]
        reqverifymerkle = requests.get("http://127.0.0.1:8888/v1/chain/verify_merkle_proof",data = json.dumps({"transaction_mroot":transaction_mroot,"merkle_proof":merkle_proof,"trx_receipt_bytes":trx_receipt_bytes})).text
        verfy_j = json.loads(reqverifymerkle)
        if verfy_j["is_matched"] == True:
            verifysucblock.append(curblockheight)
        else :
            verifyfailblock.append(curblockheight)
    return (verifysucblock,verifyfailblock)

def verifyaccrestest():
    successFlag=True;
    chain1nofindacc = []
    chain2nofindacc = []
    chain3nofindacc = []
    chain1nofindres = []
    chain2nofindres = []
    chain3nofindres = []

    url1 = sub1HttpUrl;
    if local == True :
        url1 = sub1HttpUrlLocal;

    url2 = sub2HttpUrl;
    if local == True:
        url2 = sub2HttpUrlLocal;

    url3 = sub3HttpUrl;
    if local == True:
        url3 = sub3HttpUrlLocal;

    if args.subchainNum >=1:
        print "check chain1 num"
        getaccresinfo(url1,sidechainacc1,chain1nofindacc,4,20,chain1nofindres)
        print("chain1 not find account number:",int(len(chain1nofindacc))," notfind resource number:",int(len(chain1nofindres)))
        chaininfostr = getchaincontext("11",sidechainacc1,chain1nofindacc,chain1nofindres)
        if (int(len(chain1nofindacc)) > 0 or int(len(chain1nofindres)) > 0) :
            successFlag = False;
    if args.subchainNum >=2:
        print "check chain2 num"
        getaccresinfo(url2,sidechainacc2,chain2nofindacc,2,30,chain2nofindres)
        print("chain2 not find account number:",int(len(chain2nofindacc))," notfind resource number:",int(len(chain2nofindres)))
        chaininfostr += getchaincontext("12",sidechainacc2,chain2nofindacc,chain2nofindres)
        if (int(len(chain2nofindacc)) > 0 or int(len(chain2nofindres)) > 0) :
            successFlag = False;
    if args.subchainNum >=3:
        print "check chain3 num"
        getaccresinfo(url3,sidechainacc3,chain3nofindacc,4,25,chain3nofindres)
        print("chain3 not find account number:",int(len(chain3nofindacc))," notfind resource number:",int(len(chain3nofindres)))
        chaininfostr += getchaincontext("13",sidechainacc3,chain3nofindacc,chain3nofindres)
        if (int(len(chain3nofindacc)) > 0 or int(len(chain3nofindres)) > 0) :
            successFlag = False;
    (verifysucblock,verifyfailblock) = merkleproof()
    totalverifyblock = verifysucblock + verifyfailblock
    merklestr = "merkle proof \n验证主链块数量为" + str(len(totalverifyblock))
    merklestr += "\n块高列表为:"
    for a in totalverifyblock:
        merklestr += str(a)+","
    merklestr += "\nmerkle proof 验证失败块数量为:" + str(len(verifyfailblock))
    if len(verifyfailblock) != 0:
        successFlag = False
        merklestr += "\n失败块列表为:"
        for a in verifyfailblock:
            merklestr += str(a)+","
    chaininfostr += merklestr
    configindex = curindex + 1
    confblockheight = curblockheight
    if os.path.isfile("/root/workspace/future-core/scripts/mutichain.cfg") :
        conf.set('config', 'index', str(configindex))
        conf.set('config', 'blockheight', str(confblockheight))
    else:
        conf.add_section("config")
        conf.set('config', 'index', str(configindex))
        conf.set('config', 'blockheight', str(confblockheight))
    with open('/root/workspace/future-core/scripts/mutichain.cfg', 'w') as fw:
        conf.write(fw)



    print(chaininfostr)
    sendEmail(chaininfostr,successFlag)
def getTransList():
    cunt = 0
    for blocknum in range( 1728331,1729410):
        reqblockinfo = requests.get("http://172.16.10.9:8888/v1/chain/get_block_info",data = json.dumps({"block_num_or_id":str(blocknum)})).text

        j = json.loads(reqblockinfo)
        if not ("proposer" in j):
            break
        if len(j["transactions"]) == 0:
            continue
        # print(reqblockinfo)
        for trxinfo in j["transactions"]:
            actions = trxinfo["trx"]["transaction"]
            for action in actions["actions"]:
                if action["account"] == "futio.token" and action["name"] == "transfer" and action["data"]["from"] == "root5" :
                    cunt += 1
                    print(" transfer block:%d :to:%s,quantity:%s,memo:%s,cunt:%d"%(blocknum, action["data"]["to"],action["data"]["quantity"],action["data"]["memo"],cunt))
                    commitblock = requests.get("http://172.16.10.9:9925/v1/chain_info/get_table_records",data = json.dumps({"code":"futureio","scope":"master","table":"blockheaders","json":"true","table_key_type":"uint64","table_key":blocknum})).text
                    commitblockjson = json.loads(commitblock)
                    is_exist = False
                    for trxid in commitblockjson["rows"][0]["trx_ids"]:
                        if trxid == trxinfo["trx"]["id"]:
                            is_exist = True
                            break
                    if is_exist == False:
                        print("Error blocknum:%d,trxid:%s" %( blocknum,trxinfo["trx"]["id"]))

# Command Line Arguments

parser = argparse.ArgumentParser()

commands = [
    ('c', 'createacc',      createmutiaccounts,       False,    "createmutiaccounts"),
    ('r', 'reslease',       stepmutireslease,       False,    "stepmutireslease"),
    ('V', 'voteaccres',     voteresrelet,         False,    "voteresrelet"),
    ('T', 'verifyaccres',   verifyaccrestest,      False,    "verifyaccrestest"),
    ('d', 'delete',   deleteHistory,      False,    "delete cfg file"),
    ('g', 'getTransList',   getTransList,      False,    "getTransList"),
]

parser.add_argument('--initacc-pk', metavar='', help="FUTURE Public Key", default='FUT6XRzZpgATJaTtyeSKqGhZ6rH9yYn69f5fkLpjVx6y2mEv5iQTn', dest="initacc_pk")
parser.add_argument('--initacc-sk', metavar='', help="FUTURE Private Key", default='5KZ7mnSHiKN8VaJF7aYf3ymCRKyfr4NiTiqKC5KLxkyM56KdQEP', dest="initacc_sk")
parser.add_argument('--clfuture', metavar='', help="Clfuture command", default=defaultclu % '/root/workspace')
parser.add_argument('-sn', '--subchainNum', type=int, default=3)

parser.add_argument('--log-path', metavar='', help="Path to log file", default='./output.log')
for (flag, command, function, inAll, help) in commands:
    prefix = ''
    if inAll: prefix += '*'
    if prefix: help = '(' + prefix + ') ' + help
    if flag:
        parser.add_argument('-' + flag, '--' + command, action='store_true', help=help, dest=command)
    else:
        parser.add_argument('--' + command, action='store_true', help=help, dest=command)

args = parser.parse_args()
print(args.clfuture)

logFile = open(args.log_path, 'a')

logFile.write('\n\n' + '*' * 80 + '\n\n\n')

haveCommand = False
for (flag, command, function, inAll, help) in commands:
    if getattr(args, command) or inAll and args.all:
        if function:
            haveCommand = True
            function()
if not haveCommand:
    print('bios-boot-tutorial.py: Tell me what to do. -a does almost everything. -h shows options.')
