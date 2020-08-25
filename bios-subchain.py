#!/usr/bin/env python

import argparse
import json
import os
import random
import re
import subprocess
import sys
import time
import string
import json
from account_info import *

logFile = None

unlockTimeout = 999999999
defaultclu = '%s/future-core/build/programs/clfuture/clfuture --wallet-url http://127.0.0.1:6666 '
defaultkul = '%s/future-core/build/programs/kfutured/kfutured'
defaultcontracts_dir = '%s/future-core/build/contracts/'

# accoding to location in accoint_info file : user111-user115
startl=1;
endl=5;

# if master network local is False
local = True;
# if need mutisign clfuture
"/root/workspace/future-core/build/programs/clfuture/clfuture  --print-request --print-response  --wallet-url http://172.16.20.223:6666 --addl-wallet-url http://172.16.20.134:6666 --addl-wallet-url http://172.16.10.5:6669 --addl-wallet-url http://172.16.10.4:6699 --addl-wallet-url http://127.0.0.1:6666  -u http://120.92.168.180:8888 "
mutisignclu = None
# if need add " -m "
mutisignparams = " "
rewardaccount = ""
# if need add u.stake.1
stakeconsaccount = ""
seedNum = 1

def sleep(t):
    print('sleep', t, '...')
    time.sleep(t)
    print('resume')

def run(args,stop):
    print('bios-boot-tutorial.py:', args)
    logFile.write(args + '\n')
    if subprocess.call(args, shell=True):
        print('bios-subchain.py: exiting because of error')
        if stop == True:
            sys.exit(1)

def retry(args):
    while True:
        print('bios-subchain.py:', args)
        logFile.write(args + '\n')
        if subprocess.call(args, shell=True):
            print('*** Retry')
            sleep(5)
        else:
            break


def background(args):
    print('bios-boot-tutorial.py:', args)
    logFile.write(args + '\n')
    return subprocess.Popen(args, shell=True)

def stepKillAll():
    run('killall kfutured || true',False)
    sleep(1.5)


def startWallet():
    run('rm -rf ' + os.path.abspath(args.wallet_dir),False)
    run('mkdir -p ' + os.path.abspath(args.wallet_dir),False)
    background(args.kfutured + ' --unlock-timeout %d --http-server-address 127.0.0.1:6666 --wallet-dir %s' % (unlockTimeout, os.path.abspath(args.wallet_dir)))
    sleep(1)
    run(args.clfuture + 'wallet create',False)

def importKeys():
    run(args.clfuture + 'wallet import --private-key ' + args.private_key,False)
    run(args.clfuture + 'wallet import --private-key ' + args.initacc_sk,False)
    run(args.clfuture + 'wallet import --private-key  5JnconiP4AMeLwUpAcwHTHcgAwyfyXnvZd6ExT2LLfid7bnFsGh',False)
    for i in range(0, len(account_sk_list)):
        run(args.clfuture + 'wallet import --private-key ' + account_sk_list[i],False)
    for i in range(0, len(rand_sk_lst)):
        run(args.clfuture + 'wallet import --private-key ' + rand_sk_lst[i],False)

def stepStartWallet():
    startWallet()
    importKeys()


def getUserName(i):
    if local == True:
        return args.subchain + accounts[i];
    else:
        return accounts[i];

# addSubChainUse
def addSubChainUser():
    print "addSubChainUser start..."
    endindex = endl;
    if args.producerNum :
        endindex = args.producerNum;
    for i in range(startl,endindex+1+seedNum):
        userName = getUserName(i);
        pk = account_pk_list[i]
        print "add new user:" + userName + "(" + pk + ") belongs to chain(" + args.subchain + ")"
        clu =args.clfuture
        if mutisignclu != None:
            clu = mutisignclu
        retry(clu + 'create account futureio ' + userName + ' ' + pk + mutisignparams)
    print "addSubChainUser end..."
    sleep(1)


# add balance to user
def addBalanceToUser():
    print "addBalanceToUser start..."
    endindex = endl;
    if args.producerNum :
        endindex = args.producerNum;
    for i in range(startl,endindex+1):
        userName = getUserName(i);
        print "transfer to  user(" + userName + ") 20.0000 FGAS"
        retry(args.clfuture + 'transfer futureio ' + userName + ' "20.0000 FGAS"')
        sleep(0.5)
    print "addBalanceToUser end..."
    sleep(2)

# reg producer
def regProducer():
    print "regProducer start..."
    endindex = endl;
    if args.producerNum :
        endindex = args.producerNum;
    for i in range(startl,endindex+1):
        userName = getUserName(i);
        userPK = account_pk_list[i]
        print "empoweruser(user:"+userName+" to chain:"+args.subchain+")"
        retry(args.clfuture+'system empoweruser '+userName+' '+args.subchain+' "'+userPK+'" "'+userPK+'" 1 -p '+userName+'@active ' + mutisignparams);
        sleep(1)
    sleep(5)
    for i in range(startl,endindex+1):
        userName = getUserName(i);
        pk = pk_list[i]
        bls_key = bls_pk_list[i];
        print "reg producer:" + userName + "(" + pk + " "+bls_key+ ") belongs to chain(" + args.subchain + ")"
        realrewardaccount = userName
        if len(rewardaccount) > 0:
            realrewardaccount = rewardaccount
        typeId=1;
        if args.chainType :
            array=args.chainType.split(',')
            typeId=array[0]
        retry(args.clfuture + ' system regproducer ' + userName +' '+pk+' '+bls_key +" "+ realrewardaccount +' https://'+userName+'.com '+args.subchain + ' '+ str(typeId) +' -p futureio@active -u ' + mutisignparams)
        sleep(1)

    print "regProducer end..."
    sleep(2)

# delegateStark
def delegateStark():
    print "delegateStark start..."

    endindex = endl;
    if args.producerNum :
        endindex = args.producerNum;
    for i in range(startl,endindex+1):
        userName = getUserName(i);
        print "delegatecons:" + userName + " 42000.0000 FGAS"
        clu =args.clfuture
        if mutisignclu != None:
            clu = mutisignclu
        retry(clu + 'push action futureio delegatecons \'{"from":"'+stakeconsaccount+'", "receiver":"'+userName+'", "stake_cons_quantity":"42000.0000 FGAS"}\' -p '+stakeconsaccount+'@active ' + mutisignparams )
        sleep(0.5)
    print "delegateStark end..."
    sleep(2)

# clear subchain
def clearSubchain():
    print "clearSubchain start..."
    print "clearSubchain end..."

# addSubchain()
def addSubchain():
    print "addSubchain start..."
    print "add a new subchain info(name:"+args.subchain+")"
    typeId=1;
    if args.chainType :
        array=args.chainType.split(',')
        typeId=array[0]
    run(args.clfuture + ' push action futureio regsubchain \'{"chain_name": "'+args.subchain+'", "chain_type": "'+typeId+'","genesis_producer_pubkey":"'+ pk_list[0] +'"}\' -p futureio@active ' + mutisignparams,True);
    sleep(1)
    print "addSubchain end..."

# add chain_type
# clu push action futureio regchaintype '{"type_id": "1", "min_producer_num": "40", "max_producer_num": "200", "sched_step": "10", "consensus_period": "10"}' -p futureio@active
def addChainType():
    print "addChainType start..."
    typeId=1;
    minP=4
    maxP=6
    step=2
    minstake=0
    if local == False and not args.chainType:
        print "addChainType end ..."
        return
    if args.chainType :
        array=args.chainType.split(',')
        typeId=array[0]
        minP=array[1]
        maxP=array[2]
        step=array[3]
        minstake=array[4]
    run(args.clfuture + ' push action futureio regchaintype \'{"type_id": "'+typeId+'", "min_producer_num": "'+minP+'", "max_producer_num": "'+maxP+'", "sched_step": "'+step+'", "consensus_period": "10", "min_activated_stake": "'+str(minstake)+'"}\' -p futureio@active ' + mutisignparams, True);

    if args.fixedRate :
        chainTypeMap = {}
        array=args.fixedRate.split(',')
        chainTypeMap["2"]=array[1]
        chainTypeMap["3"]=array[2]
        chainTypeMap["4"]=array[3]
        chainTypeMap["1"]=array[0]
        for key,value in chainTypeMap.items():
            run(args.clfuture + ' push action futureio setchaintypeextendata \'{"type_id": "'+typeId+'", "key": "'+key+'", "value": "'+value+'"}\' -p futureio@active ' + mutisignparams, True);
    print "addChainType end..."


def showSubchain():
    clu =args.clfuture
    if mutisignclu != None:
        clu = mutisignclu
    run(clu + ' get table futureio futureio chains',False);

def regDefaultProd():
    stepKillAll()
    stepStartWallet()
    addChainType()
    addSubChainUser()
    endindex = endl;
    if args.producerNum :
        endindex = args.producerNum;
    for i in range(startl,endindex+1):
        userName = getUserName(i);
        pk = pk_list[i]
        bls_key = bls_pk_list[i];
        print "reg producer:" + userName + "(" + pk + " "+bls_key+ ") belongs to chain(" + args.subchain + ")"
        realrewadaccount = userName
        if len(rewardaccount) > 0:
            realrewadaccount = rewardaccount
        clu =args.clfuture
        if mutisignclu != None:
            clu = mutisignclu
        typeId=1;
        if args.chainType :
            array=args.chainType.split(',')
            typeId=array[0]
        retry(clu + 'system regproducer ' + userName +' '+pk+' '+bls_key + ' '+realrewadaccount+' https://'+userName+'.com  default '+typeId+' -p futureio@active -u '+ mutisignparams)
        sleep(1)
    delegateStark()
    # set setgenesisprodpk
    retry(clu + ''' push action futureio setgenesisprodpk '{"chain_type":1,"genesis_prod_pk":"369c31f242bfc5093815511e4a4eda297f4b8772a7ff98f7806ce7a80ffffb35"}' -p futureio@active ''')
    showSubchain()

# Command Line Arguments
commands = [
    ('k', 'kill',           stepKillAll,                True,    "Kill all nodfuture and kfutured processes"),
    ('w', 'wallet',         stepStartWallet,            True,    "Start kfutured, create wallet, fill with keys"),
    ('A', 'addSubChainType', addChainType, True, "add a new subchain type"),
    ('N', 'newSubchain', addSubchain, True, "add a new subchain"),
    ('U', 'addUser', addSubChainUser, True, "add subchain users in mainchain"),
    ('B', 'addBalance', addBalanceToUser, False, "add balance to subchain users"),
    ('P', 'regProd', regProducer, True, "register producers"),
    ('D', 'delegate', delegateStark, True, "delegate cons"),
    ('S', 'show', showSubchain, True, "show sunchains"),
    ('r', 'regDefaultProd', regDefaultProd, False, " regDefaultProd"),
    # ('C', 'clearSubchain', clearSubchain, True, "clear subchain's block and users"),
];
parser = argparse.ArgumentParser()
parser.add_argument('-sub', '--subchain', type=str, help="set subchain name info")
parser.add_argument('-ct', '--chainType', type=str, help="chain type data")
parser.add_argument('-fr', '--fixedRate', type=str, help="chain type fixed rate")
parser.add_argument('-a', '--all', action='store_true', help="Do everything marked with (*)")
parser.add_argument('-p', '--programpath', metavar='', help="set programpath params")
parser.add_argument('--clfuture', metavar='', help="Clfuture command", default=defaultclu % '/root/workspace')
parser.add_argument('--kfutured', metavar='', help="Path to kfutured binary", default=defaultkul % '/root/workspace')
parser.add_argument('--contracts-dir', metavar='', help="Path to contracts directory",
                    default=defaultcontracts_dir % '/root/workspace')
parser.add_argument('--log-path', metavar='', help="Path to log file", default='./output.log')
parser.add_argument('-pn', '--producerNum', type=int, help="set producerNum to create")
parser.add_argument('--wallet-dir', metavar='', help="Path to wallet directory", default='./wallet/')
parser.add_argument('--public-key', metavar='', help="FUTURE Public Key", default='FUT59tMYEWA3gv8KjKvox1DXBNabryzj4KG8cbfSerhBidFyAU59w', dest="public_key")
parser.add_argument('--private-Key', metavar='', help="FUTURE Private Key", default='5K8bi37nWaxuQw79fAkNdAkHLt1bHsevnM1CaCzaLnWzS6QWm7Q', dest="private_key")
parser.add_argument('--initacc-pk', metavar='', help="FUTURE Public Key", default='FUT7yAmbHBrjikMB2s2uxuZBZxMgKeZCBTCeVteHd8syMJgFwgvnv', dest="initacc_pk")
parser.add_argument('--initacc-sk', metavar='', help="FUTURE Private Key", default='5JRRwBXCymJzMw7toHypcwZrzQDdpu7bmX4q2os7amgg3WWz3FQ', dest="initacc_sk")

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

if mutisignclu != None:
    #args.clfuture = mutisignclu
    mutisignparams = " -m "
    # stakeconsaccount = " u.stake.1 "
else:
    mutisignparams = " "
    stakeconsaccount = "futureio"

# print(args.clfuture)
# print(args.kfutured)
# print(args.contracts_dir)


# log info
logFile = open(args.log_path, 'a')
logFile.write('\n\n' + '*' * 80 + '\n\n\n')



# Entry Point
haveCommand = False
for (flag, command, function, inAll, help) in commands:
    if getattr(args, command) or inAll and args.all:
        if function:
            haveCommand = True
            function()
if not haveCommand:
    print('bios-subchain.py: Tell me what to do. -a does almost everything. -h shows options.')
