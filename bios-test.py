#!/usr/bin/env python

import argparse
import os
import random
import subprocess
import sys
import time
import requests
import json
from account_info import *

local = True;
args = None
logFile = None
min_committee_staked = 420000000
min_committee_number = 4
max_resources_number = 10000
unlockTimeout = 999999999
maxBodySize = 2 * 1024 * 1024
reward_tensecperiod = 12500
newaccount_fee = 2000
max_ram_size = 30 * 1024 *1024 *1024  #The maximum ram is set to 30G
worldstate_interval = 1000
resourcelease_fee = 10800
sm2 = 'sm2'
defaultclu = '%s/future-core/build/programs/clfuture/clfuture --wallet-url http://127.0.0.1:6666 '
defaultkul = '%s/future-core/build/programs/kfutured/kfutured'
defaultcontracts_dir = '%s/future-core/build/contracts/'
initaccount = accounts
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

def importKeys():
    run(args.clfuture + 'wallet import --private-key ' + args.private_key)
    run(args.clfuture + 'wallet import --private-key ' + args.initacc_sk)

    if args.trx_cipher == sm2:
        for i in range(0, len(trx_account_sm_sk_list)):
            run(args.clfuture + 'wallet import --private-key ' + trx_account_sm_sk_list[i])
        ## pk in CMakeList. FUT5YmuioKinwYiWHhEPWrQQoq4bnELBMUdz35FsorgcXpN8oAxBg
        run(args.clfuture + 'wallet import --private-key 5Kewz25D5fiPH3gZ817j6sLmqNuME77xBeVQ9TXBDvD9g4QnqDn')
    else :
        for i in range(0, len(account_sk_list)):
           run(args.clfuture + 'wallet import --private-key ' + account_sk_list[i])
        ## pk in CMakeList. FUT7Dw4vB26dBEq57FAKdEWd1EFQZXVFAX9HvdifSVQ1B3o6fhGxk
        run(args.clfuture + 'wallet import --private-key 5JnconiP4AMeLwUpAcwHTHcgAwyfyXnvZd6ExT2LLfid7bnFsGh')
    for i in range(0, len(rand_sk_lst)):
       run(args.clfuture + 'wallet import --private-key ' + rand_sk_lst[i])

def updateAuth(account, permission, parent, controller):
    retry(args.clfuture + 'push action futureio updateauth' + jsonArg({
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

def resign(account, controller):
    updateAuth(account, 'owner', '', controller)
    updateAuth(account, 'active', 'owner', controller)

def randomTransfer():
    subaccounts = accounts[1:3] #args.num_producers
    for i in subaccounts:
        for j in subaccounts:
            if i != j:
                simple_run(args.clfuture + 'transfer -f %s %s "0.%s FGAS" ' %(i, j, random.randint(1, 999)))
#    sleep(2)

def startWallet():
    run('rm -rf ' + os.path.abspath(args.wallet_dir))
    run('mkdir -p ' + os.path.abspath(args.wallet_dir))
    background(args.kfutured + ' --max-body-size %d --unlock-timeout %d --http-server-address 127.0.0.1:6666 --wallet-dir %s' % (maxBodySize, unlockTimeout, os.path.abspath(args.wallet_dir)))
    sleep(1)
    run(args.clfuture + 'wallet create')

def stepKillAll():
    run('killall kfutured || true')
    sleep(1.5)

def stepStartWallet():
    startWallet()
    importKeys()

def createSystemAccounts():
    os.system("killall  rand.sh")
    while True:
        j = json.loads(requests.get("http://127.0.0.1:8888/v1/chain/get_block_info",data = json.dumps({"block_num_or_id":"3"})).text)
        if ("proposer" in j):
            break
        print ("waiting for block 3 is ready in the chain....")
        sleep(2)
    for a in systemAccounts:
        run(args.clfuture + 'create account futureio ' + a + ' ' + args.public_key)

def stepInstallSystemContracts():
    retry(args.clfuture + 'set contract futio.token ' + args.contracts_dir + 'futureio.token/')
    retry(args.clfuture + 'set contract futio.msig ' + args.contracts_dir + 'futureio.msig/')
    #retry(args.clfuture + 'set contract futio.rand ' + args.contracts_dir + 'futureio.rand/')
    retry(args.clfuture + 'set contract futio.bank ' + args.contracts_dir + 'futureio.bank/')
    retry(args.clfuture + 'set contract futio.res ' + args.contracts_dir + 'futureio.res/')
    sleep(2)

def stepCreateTokens():
    retry(args.clfuture + 'push action futio.token create \'["futureio", "1000000000.0000 FGAS"]\' -p futio.token')
    if not (args.subchain and args.subchain != 'futureio') :
        retry(args.clfuture + 'push action futio.token issue \'["futureio", "100000000.0000 FGAS", "memo"]\' -p futureio')
    retry(args.clfuture + 'push action futio.token set_chargeparams \'{"symbol":"FGAS","precision":"4","operate_interval":"%s","operate_fee":"%s",,"is_forbid_trans":0}\'  -p  futio.token'  % ( 60,100))
    sleep(2)

def stepSetSystemContract():
    retry(args.clfuture + 'set contract futureio ' + args.contracts_dir + 'futureio.system/')
    retry(args.clfuture + 'push action futureio setpriv' + jsonArg(['futio.msig', 1]) + '-p futureio@active')
    retry(args.clfuture + 'push action futureio setpriv' + jsonArg(['futio.res', 1]) + '-p futureio@active')
    sleep(2)

def stepCreateStakedAccounts():
    retry(args.clfuture + ' create account futureio hello %s ' % args.initacc_pk)
    for i in range(0, args.num_producers + 1 + args.non_producers):
        if args.trx_cipher == sm2:
            retry(args.clfuture + 'create account futureio %s %s ' % (accounts[i], trx_account_sm_pk_list[i]))
        else :
            retry(args.clfuture + 'create account futureio %s %s ' % (accounts[i], account_pk_list[i]))

    for a in initialAccounts:
        retry(args.clfuture + ' create account futureio %s %s ' % (a, args.initacc_pk))

def stepInitSimpleTest():
    retry(args.clfuture + 'push action hello hi \'{"user":"%s"}\' -p %s' % (accounts[1],accounts[1]))
    for i in range(10):
        retry(args.clfuture + 'transfer -f %s %s "0.1234 FGAS" ' %(accounts[1], accounts[2]))
        retry(args.clfuture + 'transfer -f %s %s "0.1234 FGAS" ' %(accounts[2], accounts[1]))
    for i in range(10):
        transvale = random.randint(1, 999)
        retry(args.clfuture + 'transfer  %s %s "0.%s FGAS" ' %(accounts[1], accounts[2], transvale))
        retry(args.clfuture + 'transfer  %s %s "0.%s FGAS" ' %(accounts[2], accounts[1], transvale))

def setMasterChainInfo():
    if local == True :
        if args.subchain and args.subchain != "futureio" :
            masterproducerinfo = ""
            for i in range(1, args.num_master_prods + 1):
                if args.consensus_cipher == sm2:
                    masterproducerinfo += '{"owner":"%s","producer_key":"%s","bls_key":"%s"},' % (("master"+initaccount[i]), consensus_sm2_pk_list[i], bls_pk_list[i] )
                else :
                    masterproducerinfo += '{"owner":"%s","producer_key":"%s","bls_key":"%s"},' % (("master"+initaccount[i]), pk_list[i], bls_pk_list[i] )
            masterproducerinfo = masterproducerinfo[:-1]
            retry(args.clfuture + ' push action futureio setmasterchaininfo \'{"chaininfo":{"owner": "futureio",\
            "master_prods":[%s],"block_height":%s,"block_id":"%s","master_chain_ext":[],"committee_mroot":"%s"}}\' -p futureio ' % \
            ( masterproducerinfo, args.num_master_block, args.master_block_id,args.committee_mroot) )

def setSysParams():
    #table_extension key, detail see futureio.system.hpp
    #enum global_state_exten_type_key {
         # global_state_key_start = 0,
         # update_auth = 1,
         # confirm_point_interval = 2,
         # sidechain_charge_ratio = 3,
         # is_claim_reward = 4,
         #free_account_per_res = 5,
         # version_number = 6,
        #  is_allow_buy_res = 7, //Allows a general account to buy resources
        #  check_user_bulletin = 8,
        #  allow_undelegate_block_interval = 9,  #T+1day 24*360
        #  refund_delegate_consensus_seconds = 10, #30days 30*24*3600
    #};
    retry(args.clfuture + ' push action futureio setsysparams \'{"params":{"chain_type": "0", "max_ram_size":"%s",\
        "min_activated_stake":%s,"min_committee_member_number":%s,\
        "block_reward_vec":[{"consensus_period":10,"reward":"%s"}{"consensus_period":2,"reward":"%s"}],\
        "max_resources_number":%s, "newaccount_fee":%s, "chain_name":"%s", "worldstate_interval":%s,"resource_fee":%s,"table_extension":[[1,"10000"], [2, "12"], [3, "0"], [4, "true"], [5, "50"], [6, "7"], [9, "8640"], [10, "2592000"]]}}\' -p futureio ' % \
        (max_ram_size, min_committee_staked, min_committee_number, reward_tensecperiod, int(reward_tensecperiod/5), max_resources_number, \
        newaccount_fee, args.subchain, worldstate_interval, resourcelease_fee) )

def stepRegProducers():
    for i in range(1, args.num_producers+1):
        if args.consensus_cipher == sm2:
            retry(args.clfuture + 'system regproducer %s %s %s %s https://%s.com "futureio" 0 -u' % (accounts[i], consensus_sm2_pk_list[i], bls_pk_list[i], accounts[i], accounts[i]))
        else :
            retry(args.clfuture + 'system regproducer %s %s %s %s https://%s.com "futureio" 0 -u' % (accounts[i], pk_list[i], bls_pk_list[i], accounts[i], accounts[i]))
    #retry(args.clfuture + 'set contract hello  ' + args.contracts_dir + 'hello/')
    sleep(2)
    delegateaccount = "futio.stake"
    if not (args.subchain and args.subchain != 'futureio') :
        delegateaccount = "futureio"
    for i in range(1, args.num_producers+1):
        retry(args.clfuture + 'system delegatecons %s %s  "%.4f FGAS" ' % (delegateaccount, accounts[i], min_committee_staked/10000))

    setMasterChainInfo()
    sleep(15)
    setSysParams()

def setMasterChainToSide():
    if args.subchain and args.subchain != "futureio" :
        masterproducerinfo = ""
        if not args.masterhttp:
            logFile.write('masterhttp is null \n')
            return
        logFile.write('masterhttp is %s,args.master_block_id:%d \n' % (args.masterhttp, args.num_master_block) )
        prodlist = json.loads(requests.get(args.masterhttp+"/v1/chain/get_producers",data = json.dumps({"json":"true","all_chain":"false","chain_name":"futureio"})).text)
        for prod in prodlist["rows"]:
            masterproducerinfo += '{"owner":"%s","producer_key":"%s","bls_key":"%s"},' % (prod["prod_detail"]["owner"], prod["prod_detail"]["producer_key"], prod["prod_detail"]["bls_key"] )
        masterproducerinfo = masterproducerinfo[:-1]
        blockinfojson = json.loads(requests.get(args.masterhttp+"/v1/chain/get_block_info",data = json.dumps({"block_num_or_id":args.num_master_block})).text)
        blockid = blockinfojson["id"]
        committee_mroot = blockinfojson["committee_mroot"]
        retry(args.clfuture + ' push action futureio setmasterchaininfo \'{"chaininfo":{"owner": "futureio",\
        "master_prods":[%s],"block_height":%s,"block_id":"%s","master_chain_ext":[],"committee_mroot":"%s"}}\' -p futureio ' % \
        ( masterproducerinfo, args.num_master_block, blockid,committee_mroot) )
        sleep(1)
        setSysParams()

def stepResign():
    if args.subchain and args.subchain != 'futureio' :
        resignAccounts.append('futio.cmnity')
        resignAccounts.append('futio.thteam')
        resignAccounts.append('futio.dapp')
    for a in resignAccounts:
        resign( a, 'futio.null')
    sleep(5)
    simple_run(args.clfuture + ' system listproducers')

def stepTransTest():
    while True:
        #randomTransfer()
        j = json.loads(requests.get("http://172.16.10.9:9925/v1/txn_test_gen/start_generation_hello",data = json.dumps(["", 100,30])).text)
        print("start:",j)
        sleep(5*60)
        j = json.loads(requests.get("http://172.16.10.9:9925/v1/txn_test_gen/stop_generation",data = json.dumps({})).text)
        print("stop:",j)
        sleep(5*60)

def stepregproducersTest():
    regindexstart = 0
    regindexend = 5
    chain_name = "newretail"
    for i in range(regindexstart, regindexend):
        if args.trx_cipher == sm2:
            run(args.clfuture + 'wallet import --private-key ' + trx_account_sm_sk_list[i])
        else :
            run(args.clfuture + 'wallet import --private-key ' + account_sk_list[i])
        if args.consensus_cipher == sm2:
            retry(args.clfuture + 'system regproducer %s %s %s %s https://%s.com "%s" 0 -u' % (accounts[i], consensus_sm2_pk_list[i], bls_pk_list[i], accounts[i], accounts[i],chain_name))
        else :
            retry(args.clfuture + 'system regproducer %s %s %s %s https://%s.com "%s" 0 -u' % (accounts[i], pk_list[i], bls_pk_list[i], accounts[i], accounts[i],chain_name))
    sleep(2)
    delegateaccount = "futureio"
    for i in range(regindexstart, regindexend):
        retry(args.clfuture + 'system delegatecons %s %s  "%.4f FGAS" ' % (delegateaccount, accounts[i], min_committee_staked/10000))

def stepexecrand():
    transrandaccount = "futio.rand"
    if not (args.subchain and args.subchain != 'futureio') :
        transrandaccount = "futureio"
    retry(args.clfuture + 'transfer %s futio.rand "6000 FGAS" ' % transrandaccount)
    retry(args.clfuture + 'set account permission futio.rand active \'{"threshold":1,"keys": [{"key": "%s","weight": 1}],"accounts": [{"permission":{"actor":"futio.rand","permission":"futio.code"},"weight":1}]}\' owner -p futio.rand' % (args.public_key))

    for i in range(0, len(rand_acc_lst)):
        retry(args.clfuture + ' create account futureio %s %s ' % ( rand_acc_lst[i], rand_pk_lst[i]))
    for a in rand_acc_lst:
        retry(args.clfuture + 'transfer  %s  %s  "%s FGAS" '  % (transrandaccount, a, "1000.0000"))
    for i in range(len(rand_acc_lst)):
        value = 1000
        retry(args.clfuture + 'transfer %s futio.rand \'%.4f FGAS\' \'in0x1WaiterRegister\' -p %s' % ( rand_acc_lst[i],value, rand_acc_lst[i]))

    randpath = "/root/workspace"
    if args.programpath:
        randpath = args.programpath
    listprods = args.clfuture + 'system listproducers'
    # os.system("cd %s/future-core/scripts/rand;  ./rand.sh c  sleep 2;  ./rand.sh r  sleep 2;\
    #   nohup ./rand.sh e >/dev/null 2>&1 &  sleep 2;echo  '\n Genesis end \n';echo %s;%s" % ( randpath, listprods, listprods))
    os.system("cd %s/future-core/scripts/rand; \
      nohup ./rand.sh e >/dev/null 2>&1 &  sleep 2;echo  '\n Genesis end \n';echo %s;%s" % ( randpath, listprods, listprods))

def addSubChainUser():
    for i in range(0,len(accounts)):
        userName = accounts[i]
        pk = ''
        if args.trx_cipher == sm2:
            pk = trx_account_sm_pk_list[i]
        else :
            pk = account_pk_list[i]
        retry(args.clfuture + 'create account futureio ' + userName + ' ' + pk)
        sleep(1)
    sleep(15)
    for i in range(0,len(accounts)):
        userName = accounts[i]
        pk = ''
        if args.trx_cipher == sm2:
            pk = trx_account_sm_pk_list[i]
        else :
            pk = account_pk_list[i]
        retry(args.clfuture+' system empoweruser '+userName+' unitopia "'+pk+'" "'+pk+'" 1 -u ');
        retry(args.clfuture+' system empoweruser '+userName+' pioneer "'+pk+'" "'+pk+'" 1 -u ');
        retry(args.clfuture+' system empoweruser '+userName+' newretail "'+pk+'" "'+pk+'" 1 -u ');
        sleep(1)

def testcreateisexist():
    noexistaccount = []
    testaccount = [
        "ray21","syfsyf225","u.mgr.feifan","u.mgr.suyu","u.mgr.zuofei"
    ]
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
    for i in range(0,len(testaccount)):
        for url in masterNetHttp.values():
            j = json.loads(requests.get(url+"/v1/chain/get_account_exist",data = json.dumps({"account_name":testaccount[i]})).text)
            if j["is_exist"] == False :
                print("ERROR not exist",url,testaccount[i])
                noexistaccount.append(testaccount[i]);
            else:
                print("exist ",url,testaccount[i])
    print ("no exist account size: %d" % (len(noexistaccount)) )
    for a in noexistaccount:
        print(a)
def setDefaultInitKey():
    if args.trx_cipher == sm2:
        args.public_key = "FUT87r1GHfh8CmazqK1MFa6E5qCoWfUTH4iYmaUDhC7XsNfEHCSvm"
        args.private_key = "5JZhAFwNnteT92DgqjMPD8kYzGEMd8B5GC7gaFNDJ6GXa8rQPhp"
        args.initacc_pk = "FUT5gNCrP4x6TCH66DHMizvVWSPSeGx6WkuTQy3HoQog7dTjBSzaF"
        args.initacc_sk = "5KhKgFeD7SfdY5sm1RnqX98zwcJgvvJAu3EjiBW7MtqcVShtor3"
# Command Line Arguments

parser = argparse.ArgumentParser()

commands = [
    ('k', 'kill',           stepKillAll,                True,    "Kill all nodfuture and kfutured processes"),
    ('w', 'wallet',         stepStartWallet,            True,    "Start kfutured, create wallet, fill with keys"),
    ('s', 'sys',            createSystemAccounts,       True,    "Create system accounts (futio.*)"),
    ('c', 'contracts',      stepInstallSystemContracts, True,    "Install system contracts (token, msig)"),
    ('t', 'tokens',         stepCreateTokens,           True,    "Create tokens"),
    ('S', 'sys-contract',   stepSetSystemContract,      True,    "Set system contract"),
    ('T', 'stake',          stepCreateStakedAccounts,   True,    "Create staked accounts"),
    ('I', 'initsimpletest', stepInitSimpleTest,         False,    "Simple transfer contract call test"),
    ('P', 'reg-prod',       stepRegProducers,           True,    "Register producers"),
    ('X', 'xfer',           stepTransTest,               False,   "Random transfer tokens (infinite loop)"),
    ('r', 'regproducers',  stepregproducersTest,    False,    "stepregproducersTest"),
    ('e', 'execrand',          stepexecrand,            False,    "stepexecrand"),
    ('A', 'addSubChainUser', addSubChainUser,         False,    "addSubChainUser"),
    ('E', 'testcreateisexist', testcreateisexist,         False,    "testcreateisexist"),
    ('q', 'resign',         stepResign,                 True,    "Resign futio"),
    ('C', 'setMasterChainToSide',  setMasterChainToSide,      False,    "get MasterChain info set sidechain"),
]

parser.add_argument('--public-key', metavar='', help="FUTURE Public Key", default='FUT59tMYEWA3gv8KjKvox1DXBNabryzj4KG8cbfSerhBidFyAU59w', dest="public_key")
parser.add_argument('--private-Key', metavar='', help="FUTURE Private Key", default='5K8bi37nWaxuQw79fAkNdAkHLt1bHsevnM1CaCzaLnWzS6QWm7Q', dest="private_key")
parser.add_argument('--initacc-pk', metavar='', help="FUTURE Public Key", default='FUT7yAmbHBrjikMB2s2uxuZBZxMgKeZCBTCeVteHd8syMJgFwgvnv', dest="initacc_pk")
parser.add_argument('--initacc-sk', metavar='', help="FUTURE Private Key", default='5JRRwBXCymJzMw7toHypcwZrzQDdpu7bmX4q2os7amgg3WWz3FQ', dest="initacc_sk")
parser.add_argument('--clfuture', metavar='', help="Clfuture command", default=defaultclu % '/root/workspace')
parser.add_argument('--kfutured', metavar='', help="Path to kfutured binary", default=defaultkul % '/root/workspace')
parser.add_argument('--contracts-dir', metavar='', help="Path to contracts directory", default=defaultcontracts_dir % '/root/workspace')
parser.add_argument('--genesis', metavar='', help="Path to genesis.json", default="./genesis.json")
parser.add_argument('--wallet-dir', metavar='', help="Path to wallet directory", default='./wallet/')
parser.add_argument('--log-path', metavar='', help="Path to log file", default='./output.log')
parser.add_argument('--symbol', metavar='', help="The futio.system symbol", default='FGAS')
parser.add_argument('--num-producers', metavar='', help="Number of producers to register", type=int, default=5, dest="num_producers")
parser.add_argument('--non-producers', metavar='', help="Number of non-producers to create", type=int, default=1, dest="non_producers")
parser.add_argument('--num-master-prods', metavar='', help="Number of master producers to register", type=int, default=5, dest="num_master_prods")
parser.add_argument('--num-master-block', metavar='', help="Number of master chain block height ", type=int, default=0, dest="num_master_block")
parser.add_argument('--master-block-id', metavar='', help="Number of master chain block height id ", type=str, default="", dest="master_block_id")
parser.add_argument('-a', '--all', action='store_true', help="Do everything marked with (*)")
parser.add_argument('-H', '--http-port', type=int, default=8000, metavar='', help='HTTP port for clfuture')
parser.add_argument('-p','--programpath', metavar='', help="set programpath params")
parser.add_argument('-m', '--masterchain', action='store_true', help="set current master chain")
parser.add_argument('-sub', '--subchain', type=str, default="futureio", help="set subchain name info")
parser.add_argument('--committee_mroot', metavar='', help="committee_mroot", type=str, default="", dest="committee_mroot")
parser.add_argument('-mh','--masterhttp', metavar='', help="set masterchain http")
parser.add_argument('--trx_cipher', metavar='', help="which cipher to use secp256k1/sm2", type=str, default="secp256k1", dest="trx_cipher")
parser.add_argument('--consensus_cipher', metavar='', help="which cipher to use ed25519/sm2", type=str, default="ed25519", dest="consensus_cipher")
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

print(args.clfuture)
print(args.kfutured)
print(args.contracts_dir)
setDefaultInitKey()
if local == True :
    adjustaccounts = ["genesis",]
    if args.masterchain:
        for a in accounts[1:]:
            adjustaccounts.append("master"+a)
    elif args.subchain and args.subchain != 'futureio' :
        for a in accounts[1:]:
            adjustaccounts.append(args.subchain+a)
    else:
        for a in accounts[1:]:
            adjustaccounts.append("user"+a)
    accounts = adjustaccounts

logFile = open(args.log_path, 'a')

logFile.write('\n\n' + '*' * 80 + '\n\n\n')

haveCommand = False
for (flag, command, function, inAll, help) in commands:
    if getattr(args, command) or inAll and args.all:
        if function:
            haveCommand = True
            function()
if not haveCommand:
    print('bios-test.py: Tell me what to do. -a does almost everything. -h shows options.')
