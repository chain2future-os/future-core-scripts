#!/usr/bin/env python
# -*- coding:utf-8 -*-
from pymongo import MongoClient
import sys
settings = {
    "ip":'120.92.211.42',   #mongo ip
    "port":27017,           #端口
    "db_name" : "future",    #数据库名字
    "actions" : "actions",  #集合名字
    "sys_actions" : "sys_actions",   #集合名字
    "action_traces" : "action_traces",  #集合名字
    "sys_action_traces" : "sys_action_traces",   #集合名字
    "transaction_traces" : "transaction_traces",  #集合名字
    "sys_transaction_traces" : "sys_transaction_traces",   #集合名字
    "transactions" : "transactions",  #集合名字
    "sys_transactions" : "sys_transactions",   #集合名字

}

class MyMongoDB(object):
    def __init__(self):
        try:
            self.conn = MongoClient(settings["ip"], settings["port"])
            self.db = self.conn[settings["db_name"]]
            self.db.authenticate("root", "Uranus")
            self.old_actions = self.db[settings["actions"]]
            self.sys_actions = self.db[settings["sys_actions"]]
            self.action_traces = self.db[settings["action_traces"]]
            self.sys_action_traces = self.db[settings["sys_action_traces"]]
            self.transaction_traces = self.db[settings["transaction_traces"]]
            self.sys_transaction_traces = self.db[settings["sys_transaction_traces"]]
            self.transactions = self.db[settings["transactions"]]
            self.sys_transactions = self.db[settings["sys_transactions"]]
        except Exception as e:
            print(e)

    def insert(self,dic):
        print("inser...")
        self.old_actions.insert(dic)

    def update(self,dic,newdic):
        print("update...")
        self.old_actions.update(dic,newdic)

    def delete(self,dic):
        print("delete...")
        self.old_actions.remove(dic)

    def dbfind(self,dic):
        print("find...")
        data = self.old_actions.find(dic)
        for result in data:
            print(result)
            self.sys_actions.insert(result)

    def db_move_actions(self,dic):
        try:
            actioncount = 0
            print("db_move_actions find actions...")
            data = self.old_actions.find(dic)
            print("result length:",data)
            for result in data:
                actioncount += 1
                print("actions id:",result['_id']," actioncount:",actioncount)
                self.sys_actions.insert(result)
                self.old_actions.remove({'_id':result['_id']})
            print("db_move_actions end...")
        except Exception as e:
            print("db_move_actions exception exit...")
            print(e)
            sys.exit(1)

    def db_move_action_traces(self,dic):
        try:
            actiontracescount = 0
            print("db_move_action_traces start find action_traces...")
            data = self.action_traces.find(dic)
            print("result :",data)
            for result in data:
                actiontracescount += 1
                print("db_move_action_traces actins id:",result['_id']," actiontracescount:",actiontracescount)
                self.sys_action_traces.insert(result)
                self.action_traces.remove({'_id':result['_id']})
                # break
            print("db_move_action_traces end...")
        except Exception as e:
            print("db_move_action_traces exception exit...")
            print(e)
            sys.exit(1)

    def db_move_transactions_and_traces(self,dic):
        try:
            trxcount = 0
            trxtracescount = 0
            print("db_move_transactions_and_traces find trx...")
            data = self.transaction_traces.find(dic)
            print("result length:",data)
            for result in data:
                trxtracescount += 1
                # print("transaction_traces data:",result)
                print("transaction_traces trx_id:",result["id"]," trxtracescount:",trxtracescount)
                self.sys_transaction_traces.insert(result)
                self.transaction_traces.remove({'_id':result['_id']})
                
                trx_datas = self.transactions.find({'trx_id':result["id"]})
                for trx_d in trx_datas:
                    trxcount += 1
                    print("transactions id:",trx_d["trx_id"]," trxcount:",trxcount)
                    self.sys_transactions.insert(trx_d)
                    self.transactions.remove({'trx_id':trx_d["trx_id"]})
                    
            print("db_move_transactions_and_traces end... trxtracescount:",trxtracescount," trxcount:",trxcount)
        except Exception as e:
            print("db_move_transactions_and_traces exception exit...")
            print(e)
            sys.exit(1)
        

def main():
    mongo = MyMongoDB()
    #迁移 action_traces
    mongo.db_move_action_traces({"act.account":"futureio",'$or': [ { "act.name":"acceptmaster" },{ "act.name":"acceptheader" },{ "act.name":"prodheartbeat" },{ "act.name":"reportsubchainhash" } ] })##({"trx_id":"292e4fc3271f751fb4eb7fabfc9d807663868b8cb1642996ff5a81c7646a99ba"})#

    # # ##迁移 actions
    mongo.db_move_actions({"account":"futureio",'$or': [ { "name":"acceptmaster" },{ "name":"acceptheader" },{ "name":"prodheartbeat" },{ "name":"reportsubchainhash" } ] })##({"account":"futio.token"})

    # ##迁移 transaction_traces and transactions
    mongo.db_move_transactions_and_traces({"action_traces.0.act.account":"futureio",'$or': [ { "action_traces.0.act.name":"acceptmaster" },{ "action_traces.0.act.name":"acceptheader" },{ "action_traces.0.act.name":"prodheartbeat" },{ "action_traces.0.act.name":"reportsubchainhash" } ] })##({"account":"futio.token"})

if __name__ == "__main__":
    main()