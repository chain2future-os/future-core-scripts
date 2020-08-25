#!/usr/bin/env python
import sys
sys.path.append("..")
from account_info import *

def generate_keypair():
    need_accounts = [
"tokenview.33",
"tokenview.35",
"tokenview.3h",
"tokenview.3j",
"tokenview.3k",
"tokenview.3o",
"tokenview.3q",
"tokenview.3u",
"tokenview.3v",
"tuyili",
"u.chenyanhui",
"u.tangyuyi",
"wangyang",
"wujie",
"wuxiaohang",
"xuefu.c",
"xuefu.f",
"xuefu.h",
"xuefu.i",
"xuefu.j",
"xuefu.m",
"xuefu.o",
"xukuiyun",
"xuxu.1a",
"xuxu.1b",
"xuxu.1c",
"xuxu.1d",
"xuxu.1e",
"yangcaizhi",
    ]
    with open('total_keypair.txt') as f:
        elements = f.read().splitlines()
    allAccounts = elements[6::8]
    allPriKeys = elements[0::8]
    allPubKeys = elements[1::8]
    allAsk = elements[2::8]
    allApk = elements[3::8]
    allBsk = elements[4::8]
    allBpk = elements[5::8]
    # print("allMinerPris length:",len(allMinerPris))
    # print("allMinerPubs length:",len(allMinerPubs))
    # print("allPriKeys length:",len(allPriKeys))
    # print("allPubKeys length:",len(allPubKeys))
    # print("blsPriKeys length:",len(bls_sk_list))
    # print("blsPubKeys length:",len(bls_pk_list))
    # print("allAccounts length:",len(allAccounts))
    # content = ""
    # for i in range(0,len(allMinerPris)):
    #      content=content+  allMinerPris[i] +"\n"\
    #                     + allMinerPubs[i] +"\n"\
    #                     + allPriKeys[i] +"\n"\
    #                     + allPubKeys[i] +"\n"\
    #                     + "bls_sk:"+bls_sk_list[i+1] +"\n"\
    #                     + "bls_pk:"+bls_pk_list[i+1] +"\n"\
    #                     + allAccounts[i] +"\n"+"\n"
    # writefile("newfile.txt",content)
    print(len(allAccounts))
    for j in range(0,len(need_accounts)):
        isExist = False
        for i in range(0,len(allAccounts)):
            curaccount = allAccounts[i]
            realaccount = curaccount[8:]
            realaccount = realaccount.strip()
            #print(realaccount)
            if realaccount == need_accounts[j]:
                isExist = True
                print(allPriKeys[i])
                print(allPubKeys[i])
                print(allAsk[i])
                print(allApk[i])
                print(allBsk[i])
                print(allBpk[i])
                print(allAccounts[i])
                print("")
                break
        assert isExist,"fail ,not found" + need_accounts[j]

def generate_mutiacclist():
    need_accounts = [
##hangzhou server pioneer node
"yufengshen",
"yangweijun",
##hangzhou server australia node
# "zhengxueqing",
# "magiczhao",
# "laifangxiao",
# "gaojunyou",
# "hanpeixing",
# "jianyingli",
# "liangmaoxing",
# "ningshuyun",
# "shunshengyu",
# "yumanqing",
# "luqianjing",
# "helianning",
# "fanchuxiao",
# "huyanyi",
# "lvkuifeng",
# "youqiaoying",
# "zhangshuyan",
# "australia.1a",
# "australia.1b",
# "australia.1c",
# "australia.1d",
# "australia.1e",
# "nishuihan",
# "qianxianlan",
    ]
    with open('total_keypair.txt') as f:
        elements = f.read().splitlines()
    allAccounts = elements[6::8]
    allPriKeys = elements[0::8]
    allPubKeys = elements[1::8]
    allAsk = elements[2::8]
    allApk = elements[3::8]
    allBsk = elements[4::8]
    allBpk = elements[5::8]
    print(len(allAccounts))
    account_as_committeelist = "my-account-as-committee = "
    sk_as_committeelist = "my-sk-as-committee = "
    sk_as_accountlist = "my-sk-as-account = "
    bls_as_sklist = "my-bls-sk = "
    for j in range(0,len(need_accounts)):
        isExist = False
        for i in range(0,len(allAccounts)):
            curaccount = allAccounts[i]
            realaccount = curaccount[8:]
            realaccount = realaccount.strip()
            #print(realaccount)
            if realaccount == need_accounts[j]:
                isExist = True
                print(allPriKeys[i])
                print(allPubKeys[i])
                print(allAsk[i])
                print(allApk[i])
                print(allBsk[i])
                print(allBpk[i])
                print(allAccounts[i])
                print("")
                account_as_committeelist += allAccounts[i][8:]+","
                sk_as_committeelist += allPriKeys[i][4:] + ","
                sk_as_accountlist += allAsk[i][4:] + ","
                bls_as_sklist += allBsk[i][7:]+","
                break
        assert isExist,"fail ,not found" + need_accounts[j]
    print("\n\n")
    print(account_as_committeelist[:-1])
    print(sk_as_committeelist[:-1])
    print(sk_as_accountlist[:-1])
    print(bls_as_sklist[:-1])

def generate_newkeypair():
    content = ""
    for i in range(0,len(accounts)):
         content=content+ "pri:"+sk_list[i] +"\n"\
                        + "pub:"+pk_list[i] +"\n"\
                        + "ask:"+account_sk_list[i] +"\n"\
                        + "apk:"+account_pk_list[i] +"\n"\
                        + "bls_sk:"+bls_sk_list[i] +"\n"\
                        + "bls_pk:"+bls_pk_list[i] +"\n"\
                        + "account:"+accounts[i] +"\n"+"\n"\

    writefile("newfile.txt",content)
def readfile(fname):
	fileold = open(fname, "r")
	content = fileold.readlines()
	fileold.close()
	return content

def writefile(fname,content):
	filenew = open(fname, "w")
	filenew.writelines(content)
	filenew.close()

generate_mutiacclist()

