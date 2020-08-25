#coding=utf-8
import unittest
import time
import requests
import json
import sys
sys.path.append("..")
from config import *
from general_func import *
class BuyResourceLease(unittest.TestCase):
    _name = "root3"
    _receivername = "root4"
    _curperiods = 0
    _is_bought_curperiod = False
    _free_num = 30

    # 测试当期购买资源
    def test1_buy_resource_lease( self ):
        self.getCurPeriods()
        cmd_exec(Config.clfuture_path + '''  transfer futureio %s "10 FGAS" ''' % self._name)
        time.sleep( 11 )
        print(self._is_bought_curperiod)
        if self._is_bought_curperiod == True:
            return
        cmd_exec(Config.clfuture_path + ''' push action futio.res  resourcelease '["futureio","%s",10000,%d,"futureio"]' -p  futureio ''' % ( self._name, self._curperiods ))
        time.sleep( 20 )
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":self._curperiods,"table":"reslease","json":"true","scope_type":"uint64"})).text)
        self.assertEqual( len(j["rows"]), 1 )
        self.assertTrue( j["rows"][0]["owner"], self._name )
        self.assertEqual( 10000, int(j["rows"][0]["lease_num"]))
        self.assertEqual( 500000, int(j["rows"][0]["free_account_number"]))
    # 测试转让当期购买资源
    def test2_trans_resource( self ):
        self.getCurPeriods()
        if self._is_bought_curperiod == True:
            return
        cmd_exec(Config.clfuture_path + '''  push action  futio.res  transresource '["%s","%s","1","%d"]'  -p %s ''' % ( self._name, self._receivername, self._curperiods, self._name ))
        time.sleep( 20 )
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":self._curperiods,"table":"reslease","json":"true","scope_type":"uint64"})).text)
        print(j)
        self.assertEqual( len(j["rows"]), 2 )
        for u in j["rows"]:
            if u["owner"] == self._receivername:
                self.assertEqual( 1, int(u["lease_num"]))

    # 测试购买下一期资源
    def test3_buy_next_resource( self ):
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":"futureio","table":"resperiods","json":"true","scope_type":"name","limit":1000})).text)
        newPeriods = j["rows"][-1]["periods"] + 1
        cmd_exec(Config.clfuture_path + ''' push action futio.res  resourcelease '["futureio","%s",10000,%d,"futureio"]' -p  futureio ''' % ( self._name, newPeriods ))
        time.sleep( 20 )
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":newPeriods,"table":"reslease","json":"true","scope_type":"uint64"})).text)
        self.assertEqual( len(j["rows"]), 1 )
        self.assertTrue( j["rows"][0]["owner"], self._name )
        self.assertEqual( 10000, int(j["rows"][0]["lease_num"]))
        self.assertEqual( 0, int(j["rows"][0]["free_account_number"]))
    # 测试转让下一期资源
    def test4_trans_next_resource( self ):
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":"futureio","table":"resperiods","json":"true","scope_type":"name","limit":1000})).text)
        newPeriods = j["rows"][-1]["periods"]
        cmd_exec(Config.clfuture_path + '''  push action  futio.res  transresource '["%s","%s","1","%d"]'  -p %s ''' % ( self._name, self._receivername, newPeriods, self._name ))
        time.sleep( 20 )
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":newPeriods,"table":"reslease","json":"true","scope_type":"uint64"})).text)
        print(j)
        self.assertEqual( len(j["rows"]), 2 )
        for u in j["rows"]:
            if u["owner"] == "root4":
                self.assertEqual( 1, int(u["lease_num"]))

    # 测试转让免费账号
    def test5_trans_next_account( self ):
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":"futio.res","table":"resfreeacc","json":"true","scope_type":"name","limit":1000})).text)
        root3num = 0
        root4num = 0
        for resacc in j["rows"]:
            if resacc["owner"] == "root3":
                root3num = resacc["free_account_number"]
            if resacc["owner"] == "root4":
                root4num = resacc["free_account_number"]
        cmd_exec(Config.clfuture_path + '''  push action  futio.res  transaccount '["%s","%s","%d"]'  -p %s ''' % ( self._name, self._receivername, self._free_num, self._name ))
        time.sleep( 20 )
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":"futio.res","table":"resfreeacc","json":"true","scope_type":"name","limit":1000})).text)
        for resacc in j["rows"]:
            if resacc["owner"] == "root3":
                self.assertEqual( root3num, resacc["free_account_number"] + self._free_num)
            if resacc["owner"] == "root4":
                self.assertEqual( root4num + self._free_num, resacc["free_account_number"])

    # 修改免费账号
    def test6_modify_freeaccount( self ):
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":"futio.res","table":"resfreeacc","json":"true","scope_type":"name","limit":1000})).text)
        root4num = 0
        for resacc in j["rows"]:
            if resacc["owner"] == "root4":
                root4num = resacc["free_account_number"]
        cmd_exec(Config.clfuture_path + '''  push action  futio.res  modifyfreeaccount '["%s","%d"]'  -p %s ''' % ( self._receivername, 1, "futio.res"))
        time.sleep( 20 )
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":"futio.res","table":"resfreeacc","json":"true","scope_type":"name","limit":1000})).text)
        for resacc in j["rows"]:
            if resacc["owner"] == "root4":
                self.assertEqual( root4num, resacc["free_account_number"] + 1)

    #获取当前期数，及是否购买
    def getCurPeriods( self ):
        j = json.loads(requests.get(Config.get_table_url,data = json.dumps({"code":"futio.res","scope":"0","table":"reslease","json":"true","scope_type":"uint64"})).text)
        if len(j["rows"]) != 0:
            self._is_bought_curperiod = True
        print(len(j["rows"]))
        print(self._is_bought_curperiod)

    def setUp( self ):
        print('\n====BuyResourceLease init====')

    def tearDown( self ):
        print('\n====BuyResourceLease destroy====')
