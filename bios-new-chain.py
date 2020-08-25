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
defaultpath = "/root/workspace/future-core-scripts"
defaultclu = '%s/future-core/build/programs/clfuture/clfuture --wallet-url http://127.0.0.1:6666 '
defaultkul = '%s/future-core/build/programs/kfutured/kfutured'
defaultcontracts_dir = '%s/future-core/build/contracts/'
initaccount = accounts
def jsonArg(a):
    return " '" + json.dumps(a) + "' "

def run(args):
    print('bios-new-chain.py:', args)
    logFile.write(args + '\n')
    if subprocess.call(args, shell=True):
        print('bios-new-chain.py: exiting because of error')
        sys.exit(1)

def simple_run(args):
    print('bios-new-chain.py:', args)
    logFile.write(args + '\n')
    if subprocess.call(args, shell=True):
        print('bios-new-chain.py: error')

def retry(args):
    retrycnt = 0
    while True:
        print('bios-new-chain.py:', args)
        logFile.write(args + '\n')
        if subprocess.call(args, shell=True):
            sleep(0.5)
            retrycnt += 1
            if retrycnt > 100:
                break
            print('*** Retry:%d' % retrycnt)
        else:
            break

def background(args):
    print('bios-new-chain.py:', args)
    logFile.write(args + '\n')
    return subprocess.Popen(args, shell=True)

def sleep(t):
    print('sleep', t, '...')
    time.sleep(t)
    print('resume')

def importKeys():
    simple_run(args.clfuture + 'wallet import --private-key ' + args.private_key)
    simple_run(args.clfuture + 'wallet import --private-key ' + args.initacc_sk)
    simple_run(args.clfuture + 'wallet import --private-key  5JnconiP4AMeLwUpAcwHTHcgAwyfyXnvZd6ExT2LLfid7bnFsGh')
    for i in range(0, len(account_sk_list)):
       simple_run(args.clfuture + 'wallet import --private-key ' + account_sk_list[i])
    for i in range(0, len(rand_sk_lst)):
       simple_run(args.clfuture + 'wallet import --private-key ' + rand_sk_lst[i])

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
    simple_run('rm -rf ' + os.path.abspath(args.wallet_dir))
    simple_run('mkdir -p ' + os.path.abspath(args.wallet_dir))
    background(args.kfutured + ' --max-body-size %d --unlock-timeout %d --http-server-address 127.0.0.1:6666 --wallet-dir %s' % (maxBodySize, unlockTimeout, os.path.abspath(args.wallet_dir)))
    sleep(1)
    simple_run(args.clfuture + 'wallet create')

def stepKillAll():
    simple_run('killall kfutured || true')
    sleep(1.5)

def stepStartWallet():
    startWallet()
    importKeys()

def createSystemAccounts():
    while True:
        j = json.loads(requests.get("http://127.0.0.1:8888/v1/chain/get_block_info",data = json.dumps({"block_num_or_id":"3"})).text)
        if ("proposer" in j):
            break
        print ("waiting for block 3 is ready in the chain....")
        sleep(2)
    for a in systemAccounts:
        retry(args.clfuture + 'create account futureio ' + a + ' ' + args.public_key)

def stepInstallSystemContracts():
    retry(args.clfuture + 'set contract futio.token ' + args.contracts_dir + 'futureio.token/')
    retry(args.clfuture + 'set contract futio.msig ' + args.contracts_dir + 'futureio.msig/')
    retry(args.clfuture + 'set contract futio.rand ' + args.contracts_dir + 'futureio.rand/')
    retry(args.clfuture + 'set contract futio.bank ' + args.contracts_dir + 'futureio.bank/')
    sleep(2)

def stepCreateTokens():
    retry(args.clfuture + 'push action futio.token create \'["futureio", "500000000.0000 FGAS"]\' -p futio.token')
    if not (args.subchain and args.subchain != 'futureio') :
        retry(args.clfuture + 'push action futio.token issue \'["futureio", "100000000.0000 FGAS", "memo"]\' -p futureio')
    retry(args.clfuture + 'push action futio.token set_chargeparams \'{"symbol":"FGAS","precision":"4","operate_interval":"%s","operate_fee":"%s",,"is_forbid_trans":0}\'  -p  futio.token'  % ( 60,100))
    sleep(2)

def stepSetSystemContract():
    retry(args.clfuture + 'set contract futureio ' + args.contracts_dir + 'futureio.system/')
    sleep(20)
    retry(args.clfuture + 'push action futureio setpriv' + jsonArg(['futio.msig', 1]) + '-p futureio@active')
    sleep(2)

def stepCreateStakedAccounts():
    retry(args.clfuture + ' create account futureio hello %s ' % args.initacc_pk)
    for i in range(0, args.num_producers + 1 + args.non_producers):
        retry(args.clfuture + 'create account futureio %s %s ' % (accounts[i], account_pk_list[i]))

    for a in initialAccounts:
        retry(args.clfuture + ' create account futureio %s %s ' % (a, args.initacc_pk))

def setMasterChainInfo():
    if local == True :
        if args.subchain and args.subchain != "futureio" :
            masterproducerinfo = ""
            for i in range(1, args.num_master_prods + 1):
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
        "block_reward_vec":[{"consensus_period":10,"reward":"%s"}],\
        "max_resources_number":%s, "newaccount_fee":%s, "chain_name":"%s", "worldstate_interval":%s,"resource_fee":%s,"table_extension":[[1,"10000"], [2, "12"], [3, "0"], [4, "true"], [5, "50"], [6, "7"], [9, "8640"], [10, "2592000"]]}}\' -p futureio ' % \
        (max_ram_size, min_committee_staked, min_committee_number, reward_tensecperiod, max_resources_number, \
        newaccount_fee, args.subchain, worldstate_interval, resourcelease_fee) )

def stepRegProducers():
    for i in range(1, args.num_producers+1):
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
    simple_run(args.clfuture + ' system listproducers')

def stepregproducersTest():
    regindexstart = 0
    regindexend = 5
    chain_name = "newretail"
    for i in range(regindexstart, regindexend):
        run(args.clfuture + 'wallet import --private-key ' + account_sk_list[i])
        retry(args.clfuture + 'system regproducer %s %s %s %s https://%s.com "%s" 0 -u' % (accounts[i], pk_list[i], bls_pk_list[i], accounts[i], accounts[i],chain_name))
    sleep(2)
    delegateaccount = "futureio"
    for i in range(regindexstart, regindexend):
        retry(args.clfuture + 'system delegatecons %s %s  "%.4f FGAS" ' % (delegateaccount, accounts[i], min_committee_staked/10000))

def createNewChain():
    stepKillAll()
    startWallet()
    importKeys()
    createSystemAccounts()
    stepInstallSystemContracts()
    stepCreateTokens()
    stepSetSystemContract()
    setMasterChainToSide()
    sleep(15)
    if args.seed_accont and len( args.seed_accont ) > 0 and args.seed_account_pk and len( args.seed_account_pk ) > 0:
        logFile.write(" seed_account:%s,pk:%s\n" % (args.seed_accont, args.seed_account_pk) )
        retry(args.clfuture + 'create account futureio %s %s ' % (args.seed_accont, args.seed_account_pk))
    retry(args.clfuture + 'create account futureio %s %s ' % (accounts[0], account_pk_list[0]))

def addSubChainUser():
    for i in range(0,len(accounts)):
        userName = accounts[i]
        pk = account_pk_list[i]
        retry(args.clfuture + 'create account futureio ' + userName + ' ' + pk)
        sleep(1)
    sleep(15)
    for i in range(0,len(accounts)):
        userName = accounts[i]
        pk = account_pk_list[i]
        retry(args.clfuture+' system empoweruser '+userName+' unitopia "'+pk+'" "'+pk+'" 1 -u ');
        retry(args.clfuture+' system empoweruser '+userName+' pioneer "'+pk+'" "'+pk+'" 1 -u ');
        retry(args.clfuture+' system empoweruser '+userName+' newretail "'+pk+'" "'+pk+'" 1 -u ');
        sleep(1)

def testcreateisexist():
    noexistaccount = []
    testaccount = [
    ]
    for i in range(0,len(testaccount)):
        j = json.loads(requests.get("http://120.92.168.180:8888/v1/chain/get_account_exist",data = json.dumps({"account_name":testaccount[i]})).text)
        if j["is_exist"] == False :
            noexistaccount.append(testaccount[i]);
    print ("no exist account size: %d" % (len(noexistaccount)) )
    for a in noexistaccount:
        print(a)

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
    ('P', 'reg-prod',       stepRegProducers,           True,    "Register producers"),
    ('r', 'regproducers',  stepregproducersTest,    False,    "stepregproducersTest"),
    ('A', 'addSubChainUser', addSubChainUser,         False,    "addSubChainUser"),
    ('E', 'testcreateisexist', testcreateisexist,         False,    "testcreateisexist"),
    ('q', 'resign',         stepResign,                 True,    "Resign futio"),
    ('n', 'createNewChain',  createNewChain,            False,    "Resign futio"),
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
parser.add_argument('--wallet-dir', metavar='', help="Path to wallet directory", default=defaultpath+'/wallet/')
parser.add_argument('--log-path', metavar='', help="Path to log file", default=defaultpath+'/output.log')
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
parser.add_argument('--seed-accont', metavar='', help="create seed account ", dest="seed_accont")
parser.add_argument('--seed-account-pk', metavar='', help="seed account sk", dest="seed_account_pk")
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

print("logpath:",args.log_path)
logFile = open(args.log_path, 'a')

logFile.write('\n\n' + '*' * 80 + '\n\n\n')

haveCommand = False
for (flag, command, function, inAll, help) in commands:
    if getattr(args, command) or inAll and args.all:
        if function:
            haveCommand = True
            function()
if not haveCommand:
    print('bios-new-chain.py: Tell me what to do. -a does almost everything. -h shows options.')
