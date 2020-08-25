#!/usr/bin/env python

import argparse
import os
import random
import subprocess
import sys
import time
import requests
import json

args = None
logFile = None
defaultpath = "/root/workspace"
defaultclu = '%s/future-core/build/programs/clfuture/clfuture '
defaultkul = '%s/future-core/build/programs/kfutured/kfutured'
defaultcontracts_dir = '%s/future-core/build/contracts/'
clums = '''/Users/yanhuichao/work/future-core/build/programs/clfuture/clfuture --print-request --print-response --wallet-url http://172.16.20.223:6666 --addl-wallet-url http://172.16.20.134:6666 --addl-wallet-url http://172.16.10.5:6669 --addl-wallet-url http://172.16.20.110:6666 ''' + ' -u http://120.92.168.180:8888 '
destChaininfo = {
        "futureio":"http://127.0.0.1:8888",
        #"11":" http://172.16.10.5:8899 ",
}

testNetHttp = {
    "futureio":"http://172.16.10.9:8888",
    "11":"http://172.16.10.9:8899",
    "12":"http://172.16.10.9:9999",
    "13":"http://172.16.10.9:9911",
}
masterNetHttp = {
    "futureio":"http://120.92.168.180:8888",#  "futureio":"https://future.services",
    "pioneer":"http://120.92.173.112:8888",#  "pioneer":"https://pioneer.future.services",
    "unitopia":"http://120.92.118.61:8888",#  "unitopia":"https://unitopia.future.services",
    "newretail":"http://120.92.78.113:8888",#  "newretail":"https://new-retail.future.services",
    "australia":"http://120.92.210.218:8888",#"australia":"https://australia.future.services"
    "safari":"http://115.231.151.81:8888",#"australia":"https://australia.future.services"
    "rapid":"http://120.92.151.37:8888",#"australia":"https://australia.future.services"
    "pluxury":"http://115.231.151.93:8888",#"pluxury":"https://australia.future.services"
    "sporty":"http://115.231.151.97:8888",#"sporty":"https://australia.future.services"
}
mutiSignHttp = [
    "http://172.16.20.223:6666",#feifan
    "http://172.16.20.134:6666",#yusu
    "http://172.16.10.5:6669",#zuofei  # 172.16.20.202:6666
    "http://172.16.20.110:6666",#yufengshen
]
mutiSignWalletUrl = ""
mutiSignParam = ""
signAccount = ["ray21","syfsyf225","u.mgr.feifan","u.mgr.suyu","u.mgr.zuofei"]
netHttpList = testNetHttp
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
    while True:
        print('bios-test.py:', args)
        logFile.write(args + '\n')
        if subprocess.call(args, shell=True):
            sleep(0.3)
            print('*** Retry')
        else:
            break

def background(args):
    print('bios-test.py:', args)
    logFile.write(args + '\n')
    return subprocess.Popen(args, shell=True)

def sleep(t):
    print('sleep', t, '...')
    time.sleep(t)
    print('resume')


def updateAuth(clu, account, permission, parent, controller):
    retry(clu + ' push action futureio updateauth ' + jsonArg({
        'account': account,
        'permission': permission,
        'parent': parent,
        'auth': {
            'threshold': 1, 'keys': [], 'waits': [],
            'accounts': [{
                'weight': 1,
                'permission': {'actor': controller, 'permission': 'active'}
            }]
        }
    }) + '-p ' + account + '@' + permission)

def resign(clu, account, controller):
    updateAuth(clu, account, 'owner', '', controller)
    updateAuth(clu, account, 'active', 'owner', controller)

def updateAuthkey(clu, account, permission, parent, key):
    retry(clu + ' push action futureio updateauth ' + jsonArg({
        'account': account,
        'permission': permission,
        'parent': parent,
        'auth': {
            'threshold': 1, 'keys': [{
        "key": key,
        "weight": 1
    }], 'waits': [],
            'accounts': []
        }
    }) + '-p ' + account + '@' + permission)

def updateMultiAuthActor(clu,account, permission, parent, controller1, controller2, controller3,controller4,controller5): ##4/6
    run(clu + ' push action futureio updateauth ' + jsonArg({
        'account': account,
        'permission': permission,
        'parent': parent,
        'auth': {
            'threshold': 4, 'keys': [], 'waits': [],
            'accounts': [{
                'weight': 2,
                'permission': {'actor': controller1, 'permission': permission}
            },{
                'weight': 1,
                'permission': {'actor': controller2, 'permission': permission}
            },{
                'weight': 1,
                'permission': {'actor': controller3, 'permission': permission}
            },{
                'weight': 1,
                'permission': {'actor': controller4, 'permission': permission}
            },{
                'weight': 1,
                'permission': {'actor': controller5, 'permission': permission}
            }]
        }
    }) + '-p ' + account + '@' + permission + " -m ")


def ModifyAccountKey():
    accountlist = [
        'syfsyf225',
        'ray21',
    ]
    pkList =[
        "FUT5Krqm7YVx96Ytgc7VHG373Afvv2iqSvLDvWXjnV14fTpdrCZQ9",
        "FUT7janeToGDRZUNA7JPkX4hMBMdDJjwUMMWK19ajYi7i2CWtQdFG"
    ]
    for i in range(0, len(accountlist)):
        for url in masterNetHttp.values():
            clu = args.clfuture + ' -u ' + url + ' '
            retry(clu + ''' push action futio.token safe_transfer '["futio.bank","%s","2.4000 FGAS",""]'  -p futio.bank''' % accountlist[i] )
            updateAuthkey(clu,accountlist[i], 'owner', '', pkList[i])
            updateAuthkey(clu,accountlist[i], 'active', 'owner', pkList[i])
            retry(clu + ''' push action futio.token safe_transfer '["futio.fee","futio.bank","2.4000 FGAS",""]'  -p futio.fee''')

def updateAccountAuth():
    accountlist = [
    'futio.msig',
    'futio.token',
    'futio.rand',
    'futio.bank',
    'futio.reward',
    'futio.mfee',
    # 'futio.cmnity',
    # 'futio.thteam',
    # 'futio.dapp',
    # 'futio.stake',
    'futio.resfee',
    'futio.fee',
    # 'futio.empty',
    'futio.reward',
    'futio.mfee',
    'futureio',
    ]
    for i in range(0, len(accountlist)):
        for url in masterNetHttp.values():
            clu = args.clfuture + ' -u ' + url + ' '
            #clu = '''/Users/yanhuichao/work/future-core/build/programs/clfuture/clfuture --print-request --print-response --wallet-url http://172.16.20.223:6666 --addl-wallet-url http://172.16.20.134:6666 --addl-wallet-url http://172.16.20.202:6666 --addl-wallet-url http://172.16.20.110:6666 ''' + ' -u ' + url + ' '
            # retry(clu + ''' push action futio.token transfer '["%s","starwin1","1096666.0000 FGAS",""]'  -p %s -m''' % (accountlist[i],accountlist[i]) )
            updateMultiAuthActor(clums,accountlist[i], 'active', 'owner',signAccount[0], signAccount[1], signAccount[2], signAccount[3], signAccount[4])
            updateMultiAuthActor(clums,accountlist[i], 'owner', '', signAccount[0], signAccount[1], signAccount[2], signAccount[3], signAccount[4])
            #simple_run(clu + ''' transfer u.stake.1 qqfuture123  "5555.5556 FGAS"  -p u.privequ.1  -m''')

def resignAccounts():
    resignAccounts = [
        "futio.stake",
    ]
    for a in resignAccounts:
        for url in masterNetHttp.values():
            clu = args.clfuture + ' -u ' + url + ' '
            resign(clu, a, 'futio.null')


def generateContractTrx():
    os.system("rm -rf contracttrx/")
    os.system("mkdir contracttrx/")
    for chain_name,url in destChaininfo.items():
        retry(args.clfuture + ' -u ' + url + 'set contract futio.token ' + args.contracts_dir + 'futureio.token/   -d -j -s  -x 86400  >' + "contracttrx/"+chain_name+"token.json")
        retry(args.clfuture + ' -u ' + url + 'set contract futio.msig ' + args.contracts_dir + 'futureio.msig/   -d -j -s  -x 86400  >' + "contracttrx/"+chain_name+"msig.json")
        retry(args.clfuture + ' -u ' + url + 'set contract futio.bank ' + args.contracts_dir + 'futureio.bank/   -d -j -s  -x 86400  >' + "contracttrx/"+chain_name+"bank.json")
        retry(args.clfuture + ' -u ' + url + 'set contract futureio ' + args.contracts_dir + 'futureio.system/   -d -j -s  -x 86400  >' + "contracttrx/"+chain_name+"sys.json")
        #retry(args.clfuture + ' -u ' + url + ' transfer futureio root4 "100 FGAS"  -d -j -s  -x 86400  >' + "contracttrx/"+chain_name+"sys.json")     

def propose():
    perm = ''' '[{"actor": "root", "permission": "active"}, {"actor": "root1", "permission": "active"}, {"actor": "root2", "permission": "active"}]' '''
    for chain_name,url in destChaininfo.items():
        clupropose = args.clfuture + ' -u ' + url + ' multisig  propose_trx '
        retry(clupropose + chain_name+"token " + perm+  "contracttrx/"+chain_name+"token.json " + " futiomsig -p futiomsig@active")
        retry(clupropose + chain_name+"msig " + perm+  "contracttrx/"+chain_name+"msig.json "+ " futiomsig -p futiomsig@active")
        retry(clupropose + chain_name+"bank " + perm+ "contracttrx/"+chain_name+"bank.json " + " futiomsig -p futiomsig@active")
        #retry(clupropose + chain_name+"sys " + perm+  "contracttrx/"+chain_name+"sys.json "+ " futiomsig -p futiomsig@active")

def approve():
    for chain_name,url in destChaininfo.items():
        cluapprove = args.clfuture + ' -u ' + url + ' multisig  approve  futiomsig '
        for i in range(0,len(signAccount)):
            retry(cluapprove + chain_name+"token " + ''' '{"actor": "%s", "permission": "active"}'  -p  %s@active''' % (signAccount[i],signAccount[i]))
            retry(cluapprove + chain_name+"msig " +''' '{"actor": "%s", "permission": "active"}'  -p  %s@active''' % (signAccount[i],signAccount[i]))
            retry(cluapprove + chain_name+"bank " + ''' '{"actor": "%s", "permission": "active"}'  -p  %s@active''' % (signAccount[i],signAccount[i]))
            retry(cluapprove + chain_name+"sys " + ''' '{"actor": "%s", "permission": "active"}'  -p  %s@active''' % (signAccount[i],signAccount[i]))   

def execPropose():
    for chain_name,url in destChaininfo.items():
        cluexec = args.clfuture + ' -u ' + url + ' multisig  exec futiomsig '
        retry(cluexec + chain_name+"sys " + '''  -p  %s@active''' % ("futio.mfee")) 

def updateContractTrx():
    for chain_name,url in netHttpList.items():
        if args.chainname and chain_name != args.chainname:
            continue
        if args.nochainname and chain_name == args.nochainname:
            continue
        clu = args.clfuture + mutiSignWalletUrl + ' -u ' + url + ' '
        if args.futureiocontract:
            run(clu + ' set contract futureio ' + args.contracts_dir + 'futureio.system/  -p futureio@active' + mutiSignParam)
            #run(clu + ''' push action futureio  setglobalextendata  '["17", "14"]' -p futureio''' + mutiSignParam)
        if args.tokencontract:
            run(clu + ' set contract futio.token ' + args.contracts_dir + 'futureio.token/  -p futio.token@active' + mutiSignParam)
        if args.bankcontract:
            run(clu + ' set contract futio.bank ' + args.contracts_dir + 'futureio.bank/  -p futio.bank@active' + mutiSignParam)
        if args.rescontract:
            run(clu + ' set contract futio.res ' + args.contracts_dir + 'futureio.res/  -p futio.res@active' + mutiSignParam)

def verifyContractCode():
    verifyContractList = []
    if args.futureiocontract:
        verifyContractList.append("futureio")
    if args.tokencontract:
        verifyContractList.append("futio.token")
    if args.bankcontract:
        verifyContractList.append("futio.bank")
    if args.rescontract:
        verifyContractList.append("futio.res")
    for contract in verifyContractList:
        print( contract + " code:")
        for chain_name,url in netHttpList.items():
            if args.chainname and chain_name != args.chainname:
                continue
            if args.nochainname and chain_name == args.nochainname:
                continue
            clu = args.clfuture + ' -u ' + url
            run(clu + ' get code ' + contract)
            #run(clu + ' get table futureio ' + contract + ''' global |grep '"key": 17,' -A 1 ''')
def getSysAccKey():
    accountlist = [
        'futureio',
    'futio.msig',
    'futio.token',
    'futio.resfee',
    'futio.bank',
    'futio.fee',
    'futio.rand',
    'futio.reward',
    'futio.mfee',]
    for a in accountlist:
      for chain_name,url in netHttpList.items():
         clu = args.clfuture + ' -u ' + url
         print(chain_name)
         run(clu + ' get account '+ a +  ''' |grep 'owner' -A 1 ''')


def createAccount():
    accountList = [
        'futio.mfee',
        'futio.reward',
      #   'futio.cmnity',
      #   'futio.thteam',
      #   'futio.dapp'
        ]
    pkList = [
    "FUT6r3BNrssrD9F5jJo17aszYN3S7mrYcCYqXGDgaEB1WPgF9LVfe",
    "FUT6r3BNrssrD9F5jJo17aszYN3S7mrYcCYqXGDgaEB1WPgF9LVfe",
    #"FUT6r3BNrssrD9F5jJo17aszYN3S7mrYcCYqXGDgaEB1WPgF9LVfe",
    ]
    #clu = args.clfuture + " -u http://120.92.168.180:8888 "
    clu = '''/Users/yanhuichao/work/future-core/build/programs/clfuture/clfuture --print-request --print-response --wallet-url http://172.16.20.223:6666 --addl-wallet-url http://172.16.20.134:6666 --addl-wallet-url http://172.16.20.202:6666 --addl-wallet-url http://172.16.20.110:6666 ''' + ' -u http://120.92.168.180:8888 '
    for i in range(0,len(accountList)):
        userName = accountList[i]
        pk = pkList[i]
        run(clu +' create account futureio '+userName+' "'+pk+'"  -m')
        sleep(1)
        # simple_run(clu +' system empoweruser '+userName+' pioneer "'+pk+'" "'+pk+'" 1 -u ');
        # simple_run(clu +' system empoweruser '+userName+' unitopia "'+pk+'" "'+pk+'" 1 -u ');
        # simple_run(clu +' system empoweruser '+userName+' newretail "'+pk+'" "'+pk+'" 1 -u ');
        # simple_run(clu +' system empoweruser '+userName+' australia "'+pk+'" "'+pk+'" 1 -u ');
        

def verifycreateisexist():
    accountList = [        'futio.cmnity',
        'futio.thteam',
        #'futio.dapp'
        ]
    noexistaccount = []
    for i in range(0,len(accountList)):
        for url in masterNetHttp.values():
            j = json.loads(requests.get(url+"/v1/chain/get_account_exist",data = json.dumps({"account_name":accountList[i]})).text)
            if j["is_exist"] == False :
                noexistaccount.append(accountList[i]);
    print ("no exist account size: %d" % (len(noexistaccount)) )
    for a in noexistaccount:
        print(a)

def modifyRewardAccount():
    prodlist = [
        "chensiyuan"
    ]
    rewardlist = [
        "pikachu1"
    ]
    #rewardaccList = []
    curaccount = ""
    clu = '''/home/sidechain/future-core/build/programs/clfuture/clfuture --print-request --print-response --wallet-url http://172.16.20.227:6666 --addl-wallet-url http://172.16.20.34:6666 --addl-wallet-url http://127.0.0.1:6669 --addl-wallet-url http://172.16.20.123:8899 ''' + ' -u http://120.92.168.180:8888 '
    for i in range(0,len(prodlist)):
        briefprodjson = json.loads(requests.get("http://120.92.168.180:8888/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":"futureio","table":"briefprod","json":"true","table_key":prodlist[i]})).text)
        print(prodlist[i],briefprodjson["rows"][0]["location"],briefprodjson["rows"][0]["in_disable"])
        assert briefprodjson["rows"][0]["in_disable"] == 0,"producer location error"
        prodinfojson = json.loads(requests.get("http://120.92.168.180:8888/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":briefprodjson["rows"][0]["location"],"table":"producers","json":"true","table_key":prodlist[i]})).text)
        prodkey = prodinfojson["rows"][0]["producer_key"]
        blskey = prodinfojson["rows"][0]["bls_key"]
        location = briefprodjson["rows"][0]["location"]
        print("producer_key:", prodkey)
        print("bls_key:", blskey)
        rewardAccount = prodinfojson["rows"][0]["claim_rewards_account"]
        print(prodlist[i], rewardAccount)
        #assert (rewardAccount == "viewtoken1"),"rewardAccount error"
        # if rewardAccount != curaccount:
        #     rewardaccList.append(rewardAccount);
        #     curaccount = rewardAccount
        #print(rewardaccList)
        retry(clu +' system undelegatecons u.stake.1 %s -m' % prodlist[i])
        sleep(3)
        retry(clu +''' push action futureio regproducer '["%s","%s","%s","%s","%s","%s",0]' -p futureio -m ''' %(prodlist[i], prodkey, blskey, rewardlist[i], prodlist[i], location))
        sleep(3)
        retry(clu +' system delegatecons u.stake.1 %s  "42000.0000 FGAS" -m' %(prodlist[i]))
        sleep(1)

def moveProducer():
    prodlist = [
        "xuefu.1"
    ]
    clu = '''/Users/yanhuichao/work/future-core/build/programs/clfuture/clfuture --print-request --print-response --wallet-url http://172.16.20.223:6666 --addl-wallet-url http://172.16.20.134:6666 --addl-wallet-url http://172.16.10.5:6669 --addl-wallet-url http://172.16.20.110:6666 ''' + ' -u http://120.92.168.180:8888 '
    for i in range(0,len(prodlist)):
        briefprodjson = json.loads(requests.get("http://120.92.168.180:8888/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":"futureio","table":"briefprod","json":"true","table_key":prodlist[i]})).text)
        print(prodlist[i],briefprodjson["rows"][0]["location"],briefprodjson["rows"][0]["in_disable"])
        assert briefprodjson["rows"][0]["in_disable"] == 0,"producer location error"
        prodinfojson = json.loads(requests.get("http://120.92.168.180:8888/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":briefprodjson["rows"][0]["location"],"table":"producers","json":"true","table_key":prodlist[i]})).text)
        prodkey = prodinfojson["rows"][0]["producer_key"]
        blskey = prodinfojson["rows"][0]["bls_key"]
        location = briefprodjson["rows"][0]["location"]
        print("producer_key:", prodkey)
        print("bls_key:", blskey)
        rewardAccount = prodinfojson["rows"][0]["claim_rewards_account"]
        print(prodlist[i], rewardAccount)

        execmoveprod = clu +''' push action  futureio  moveprod  '{
            "producer":"%s",
            "producerkey":"%s",
            "blskey":"%s",
            "from_disable":false,
            "from_chain":"%s",
            "to_disable":false,
            "to_chain":"safari"
            }'  -p  futureio -m''' % (prodlist[i],prodkey,blskey,location)
        print(execmoveprod)
        run(execmoveprod)
        sleep(5)
def empowerUser():
    userlist = [
"ray21","syfsyf225","u.mgr.feifan","u.mgr.suyu","u.mgr.zuofei"
    ]
    for i in range(0,len(userlist)):
        accountdict = json.loads(requests.get("http://120.92.168.180:8888/v1/chain/get_account_info",data = json.dumps({"account_name":userlist[i]})).text)
        print(json.dumps(accountdict))
        pubkey = accountdict["permissions"][0]["required_auth"]["keys"][0]["key"]
        print(pubkey)
        run(clums +' system empoweruser %s pluxury %s %s  1 -u -m' %(userlist[i],pubkey,pubkey) )
        run(clums +' system empoweruser %s sporty %s %s  1 -u -m' %(userlist[i],pubkey,pubkey) )
        #retry(clums +' system empoweruser %s rapid %s %s  1 -u -m' %(userlist[i],pubkey,pubkey) )

def createRandomAcc():
    character = 'abcdefghijklmnopqrstuvwxyz12345'
    print(len(character));
    for i in range(0,85):
        acclen = random.randint(7, 13)
        accountname = ""
        for j in range(0,acclen):
            randomlen = random.randint(1, 32)
            accountname += character[(randomlen-1):randomlen]
        print(accountname)
# Command Line Arguments

parser = argparse.ArgumentParser()

commands = [
    ('k', 'mk',            ModifyAccountKey,           True,    "ModifyAccountKey"),
    ('A', 'ua',            updateAccountAuth,           True,    "updateAccountAuth"),
    ('r', 'ra',            resignAccounts,           True,    "resignAccounts"),
    ('g', 'gct',           generateContractTrx,        True,    "generateContractTrx"),
    ('p', 'prop',           propose,        True,    "propose"),
    ('a', 'appro',           approve,        True,    "approve"),
    ('e', 'execpropose',     execPropose,        True,    "execpropose"),
    ('u', 'updateContractTrx', updateContractTrx,        True,    "updateContractTrx"),
    ('V', 'verifyContractCode', verifyContractCode,        True,    "verifyContractCode"),
    ('c', 'createAccount', createAccount,        True,    "createAccount"),
    ('v', 'verifycreateisexist', verifycreateisexist,        True,    "verifycreateisexist"),
    ('R', 'modifyRewardAccount', modifyRewardAccount,        False,    "modifyRewardAccount"),
    ('M', 'moveProducer', moveProducer,        False,    "moveProducer"),
    ('E', 'empowerUser', empowerUser,        False,    "empowerUser"),
    ('C', 'createRandomAcc', createRandomAcc,        False,    "createRandomAcc"),
    ('G', 'getSysAccKey', getSysAccKey,        False,    "getSysAccKey"),
]

parser.add_argument('--clfuture', metavar='', help="Clfuture command", default=defaultclu % '/root/workspace')
parser.add_argument('--kfutured', metavar='', help="Path to kfutured binary", default=defaultkul % '/root/workspace')
parser.add_argument('--contracts-dir', metavar='', help="Path to contracts directory", default=defaultcontracts_dir % '/root/workspace')
parser.add_argument('--genesis', metavar='', help="Path to genesis.json", default="./genesis.json")
parser.add_argument('--wallet-dir', metavar='', help="Path to wallet directory", default='./wallet/')
parser.add_argument('--log-path', metavar='', help="Path to log file", default='./output.log')
parser.add_argument('--symbol', metavar='', help="The futio.system symbol", default='FGAS')
parser.add_argument('-al', '--all', action='store_true', help="Do everything marked with (*)")
parser.add_argument('-H', '--http-port', type=int, default=8000, metavar='', help='HTTP port for clfuture')
parser.add_argument('-pr','--programpath', metavar='', help="set programpath params")
parser.add_argument('-m', '--masterchain', action='store_true', help="exec masternet")
parser.add_argument('-ms', '--mutisign', action='store_true', help="muti sign")
parser.add_argument('--chainname', metavar='', help="exec chainname")
parser.add_argument('--nochainname', metavar='', help="exec nochainname")
parser.add_argument('--futureiocontract', action='store_true', help="exec futureiocontract")
parser.add_argument('--tokencontract', action='store_true', help="exec tokencontract")
parser.add_argument('--bankcontract', action='store_true', help="exec bankcontract")
parser.add_argument('--rescontract', action='store_true', help="exec rescontract")

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
if args.mutisign:
    mutiSignWalletUrl += " --print-request --print-response"
    walletUrlStr = ""
    for i in range(0,len(mutiSignHttp)):
        if i == 0:
            walletUrlStr = " --wallet-url "
        else:
            walletUrlStr = " --addl-wallet-url "
        mutiSignWalletUrl += " %s %s " % ( walletUrlStr, mutiSignHttp[i])
    mutiSignParam = " -m "
else:
    args.clfuture += " --wallet-url http://127.0.0.1:6666 "
    
print(args.clfuture)
print(args.kfutured)
print(args.contracts_dir)

logFile = open(args.log_path, 'a')

logFile.write('\n\n' + '*' * 80 + '\n\n\n')

haveCommand = False
for (flag, command, function, inAll, help) in commands:
    if getattr(args, command) or inAll and args.all:
        if function:
            haveCommand = True
            function()
if not haveCommand:
    print('updatecontracts.py: Tell me what to do. -a does almost everything. -h shows options.')
