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

user_prefix = "user"

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
    while time <=20:
        print('bios-subchain.py:', args)
        logFile.write(args + '\n')
        if subprocess.call(args, shell=True):
            print('*** Retry')
            time=time+1;
            sleep(1)
        else:
            break









def findIndex(userTag) :
    index=0;
    for a in accounts :
        print a;
        if a == userTag :
            break;
        index = index+1
    return index

# transfer producer
# sample : python transfer_reg.py -T -s 11 -d 12 -u user.11.111
def transferReg():
    print "transfer reg start:"
    user = args.user
    source = args.source;
    dest = args.dest;
    userArray=user.split('.')
    userTag=userArray[len(userArray)-1]
    #print userTag
    index = findIndex("."+userTag)
    userPK=account_pk_list[index]
    minerPK=pk_list[index]
    print "transfer producer("+user+" accountPK: "+userPK+") from chain("+source+") to chain("+dest+")"
    sleep(1)
    print "empoweruser(user:"+user+" to chain:"+dest+")"
    retry(args.clfuture+'push action futureio empoweruser \'{"user": "'+user+'", "owner_pk": "'+userPK+'", "active_pk": "'+userPK+'", "chain_name":"'+dest+'"}\' -p '+user+'@active');
    sleep(5)
    bls_key = bls_pk_list[index];
    print "reg producer:" + user + "(" + userPK + " "+bls_key+ ") belongs to chain(" + dest + ")"
    #print(args.clfuture + 'system regproducer ' + user +' '+userPK+' '+bls_key+' https://'+user+'.com '+dest+' '+user+' -p futureio@active')
    retry(args.clfuture + 'system regproducer ' + user +' '+minerPK+' '+bls_key+' https://'+user+'.com '+dest+' '+user+' -p futureio@active')









# Command Line Arguments
commands = [
    ('T', 'transfer', transferReg, False, "transfer a producer to another chain"),
    # ('C', 'clearSubchain', clearSubchain, True, "clear subchain's block and users"),
];
parser = argparse.ArgumentParser()
parser.add_argument('-s', '--source', type=str, help="subchain name form")
parser.add_argument('-d', '--dest', type=str, help="subchain name to", required=True)
parser.add_argument('-u', '--user', help='producer name', required=True)
parser.add_argument('-p', '--programpath', metavar='', help="set programpath params")
parser.add_argument('--clfuture', metavar='', help="Clfuture command", default=defaultclu % '/root/workspace')
parser.add_argument('--kfutured', metavar='', help="Path to kfutured binary", default=defaultkul % '/root/workspace')
parser.add_argument('--contracts-dir', metavar='', help="Path to contracts directory",
                    default=defaultcontracts_dir % '/root/workspace')
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
    print('transfer_reg.py: Tell me what to do. -a does almost everything. -h shows options.')
