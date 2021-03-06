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
import requests
from account_info import *
#from account_info_master import *
#from account_info_sub1 import *
#from account_info_sub2 import *
#from account_info_sub3 import *

logFile = None

unlockTimeout = 999999999
defaultclu = '%s/future-core/build/programs/clfuture/clfuture --wallet-url http://127.0.0.1:6666 '
defaultkul = '%s/future-core/build/programs/kfutured/kfutured'
defaultcontracts_dir = '%s/future-core/build/contracts/'


initaccount = accounts

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
    time = 0
    while True:
        if time >= 5 :
            break;
        print('bios-subchain.py:', args)
        logFile.write(args + '\n')
        if subprocess.call(args, shell=True):
            print('*** Retry')
            time=time+1;
            sleep(0.5)
        else:
            break

def getChainNameList():
    chainList = [];
    chainInfoList = json.loads(requests.get("http://127.0.0.1:8888/v1/chain/get_table_records",data = json.dumps({"code":"futureio","scope":"futureio","table":"chains","json":"true"})).text)
    rows = chainInfoList["rows"];
    for i in range(0, len(rows)):
        chainList.append(rows[i]["chain_name"]);
    return chainList;

def empowerUser():
    chainList = getChainNameList();
    print "subchain list:";
    print chainList;
    userName = "futureio"
    index = 1
    for i in range(0, len(chainList)):
        print "start to find chain("+str(chainList[i])+" producers:)";
        producersObj = json.loads(requests.get("http://127.0.0.1:8888/v1/chain/get_table_records",data = json.dumps({"code":"futureio","limit":"500","scope":""+chainList[i]+"","table":"producers","json":"true"})).text)
        producers = producersObj["rows"];
        print producers;
        sleep(1);
        for j in range(0, len(producers)):
            accountObj = json.loads(requests.get("http://127.0.0.1:8888/v1/chain/get_account_info",data = json.dumps({"account_name": producers[j]["owner"]})).text)
            userPK =  accountObj["permissions"][0]["required_auth"]["keys"][0]["key"];
            #print "chain("+str(chainList[i])+") producer:"+str(producers[j]["owner"]+" userPK:"+userPK+" index:"+str(index));
            for t in range(0, len(chainList)):
                if chainList[i] != chainList[t]:
                    print "prepare empower(chain("+str(chainList[i])+") producer:"+str(producers[j]["owner"]+") to chain:"+chainList[t])+" index:"+str(index);
                    index = index +1;
                    retry(args.clfuture+'system empoweruser '+str(producers[j]["owner"])+' '+chainList[t]+' "'+userPK+'" "'+userPK+'" 1 -u');
                    sleep(0.5);


# Command Line Arguments
commands = [
    ('e', 'empowerUser', empowerUser, True, "empowerUser"),
];
parser = argparse.ArgumentParser()
parser.add_argument('-sub', '--subchain', type=str, help="set subchain name info")
parser.add_argument('-ct', '--chainType', type=str, help="chain type data")
parser.add_argument('-a', '--all', action='store_true', help="Do everything marked with (*)")
parser.add_argument('-p', '--programpath', metavar='', help="set programpath params")
parser.add_argument('--clfuture', metavar='', help="Clfuture command", default=defaultclu % '/root/workspace')
parser.add_argument('--kfutured', metavar='', help="Path to kfutured binary", default=defaultkul % '/root/workspace')
parser.add_argument('--contracts-dir', metavar='', help="Path to contracts directory",
                    default=defaultcontracts_dir % '/root/workspace')
parser.add_argument('--log-path', metavar='', help="Path to log file", default='./output.log')
parser.add_argument('-pn', '--producerNum', type=int, help="set producerNum to create")

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
