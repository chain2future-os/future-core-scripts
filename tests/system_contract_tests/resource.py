#coding=utf-8
import unittest
import subprocess
import time
import requests
import json
import sys
import datetime
import string
sys.path.append("..")

from config import *
from general_func import *

class Resource(unittest.TestCase):
    name_A = "restest1"
    pk_A = "FUT75rwpPD8YSTuT2vfVH1DgxiCve4YusCBKwEExZtHJHoVAjQj4a"
    sk_A = "5KE91hYFAraYuK7tqJaknPPBNUbvsToZgNCLAXpK8cnJ4W5czKN"

    name_B = "restest2"
    pk_B = "FUT5566tjgd54VQVXbxSndBjTq3Xcg4UnvqGuTiR7uExaGHx3XLwY"
    sk_B = "5KCWGqGiNJWVadCTTLUEf6RJZMyBHqNpEvG1MzL4Y93p7xEbT3Y"

    #创建账号
    def create_account( self ):
        execcommand = Config.clfuture_path + 'create account futureio %s %s %s ' % (self.name_A, self.pk_A, self.pk_A)
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'transfer futureio %s "100.0000 FGAS"' %self.name_A
        cmd_exec( execcommand )
        sleep(10)

        execcommand = Config.clfuture_path + 'create account futureio %s %s %s ' % (self.name_B, self.pk_B, self.pk_B)
        cmd_exec( execcommand )
        sleep(20)

    #销毁账号
    def destroy_account( self ):
        execcommand = Config.clfuture_path + 'push action futureio  delaccount \'["%s"]\' --delay-sec 30 -p futureio' % ( self.name_A )
        print( execcommand )
        return subprocess.call( execcommand, shell=True )

        execcommand = Config.clfuture_path + 'push action futureio  delaccount \'["%s"]\' --delay-sec 30 -p futureio' % ( self.name_B )
        print( execcommand )
        return subprocess.call( execcommand, shell=True )
        sleep(15)

    def create_sidechain( self ):
        execcommand = Config.clfuture_path + 'push action futureio regchaintype \'{"type_id":"1", "min_producer_num":"4", "max_producer_num":"30", "sched_step":"4", "consensus_period":"10", "min_activated_stake": "0"}\'  -p futureio@active'
        cmd_exec( execcommand )

        for chain in Config.chain_name:
            j = json.loads(requests.get(Config.get_table_url, data = json.dumps({"code":"futureio","scope":"futureio","table":"chains","json":"true","table_key":chain})).text)
            if len(j["rows"]) == 1:
                print('\n chain %s has been created' %chain)
            else:
                execcommand = Config.clfuture_path + 'push action futureio regsubchain \'{"chain_name":"%s", "chain_type":"1", "genesis_producer_pubkey":"369c31f242bfc5093815511e4a4eda297f4b8772a7ff98f7806ce7a80ffffb35"}\' -p futureio@active' % (chain)
                cmd_exec( execcommand )
        sleep(25)

    def empower_tester( self):
        for chain in Config.chain_name:
            execcommand = Config.clfuture_path + 'system empoweruser %s %s %s %s 1' % (self.name_A, chain, self.pk_A, self.pk_A)
            cmd_exec( execcommand )
            execcommand = Config.clfuture_path + 'system empoweruser %s %s %s %s 1' % (self.name_B, chain, self.pk_B, self.pk_B)
            cmd_exec( execcommand )
        sleep(20)

    # 测试账号是否正确
    def test_resource( self ):
        sleep( 20 )
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":self.name_A})).text)
        self.assertIn( "account_name" , j )
        self.assertEqual( j["account_name"] , self.name_A )
        self.assertEqual( j["updateable"], True )
        self.assertEqual( j["privileged"], False )
        self.assertEqual( j["permissions"][0]["required_auth"]["keys"][0]["key"] , self.pk_A )
        self.assertEqual( j["permissions"][1]["required_auth"]["keys"][0]["key"] , self.pk_A )
        has_res = False
        for location in j["chain_resource"]:
            if location["chain_name"] == Config.chain_name[0]:
                if location["lease_num"] > 0:
                   has_res = True 
                break

        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":self.name_B})).text)
        self.assertIn( "account_name" , j )
        self.assertEqual( j["account_name"] , self.name_B )
        self.assertEqual( j["updateable"], True )
        self.assertEqual( j["privileged"], False )
        self.assertEqual( j["permissions"][0]["required_auth"]["keys"][0]["key"] , self.pk_B )
        self.assertEqual( j["permissions"][1]["required_auth"]["keys"][0]["key"] , self.pk_B )
        #apply resource lease
        if has_res == False:
            execcommand = Config.clfuture_path + 'system resourcelease futureio %s 100 365 %s' % ( self.name_A, Config.chain_name[0] )
            cmd_exec( execcommand )
        else:
            execcommand = Config.clfuture_path + 'system resourcelease futureio %s 20 0 %s' % ( self.name_A, Config.chain_name[0] )
            cmd_exec( execcommand )
            
        sleep(25)
        #check resource of A
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":self.name_A})).text)
        self.assertIn("account_name", j)
        self.assertEqual( j["account_name"] , self.name_A )
        found = False
        for location in j["chain_resource"]:
            if location["chain_name"] == Config.chain_name[0]:
                found = True
                self.assertGreaterEqual( location["lease_num"], 100 )
                d_end = datetime.datetime.strptime(location["end_time"][:-4], "%Y-%m-%dT%H:%M:%S")
                d_start = datetime.datetime.strptime(location["start_time"][:-4], "%Y-%m-%dT%H:%M:%S")
                delta = d_end - d_start
                self.assertGreaterEqual( delta.days, 365)
                break
        self.assertTrue(found)
        #transfer resource lease from A to B
        execcommand = Config.clfuture_path + 'system transferresource %s %s 20 %s' %(self.name_A, self.name_B, Config.chain_name[0])
        cmd_exec( execcommand )
        sleep(25)
        #check resource of A
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":self.name_A})).text)
        self.assertIn("account_name", j)
        self.assertEqual( j["account_name"] , self.name_A )
        found = False
        for location in j["chain_resource"]:
            if location["chain_name"] == Config.chain_name[0]:
                found = True
                self.assertGreaterEqual( location["lease_num"], 80 )
                d_end_A = datetime.datetime.strptime(location["end_time"][:-4], "%Y-%m-%dT%H:%M:%S")
                d_start_A = datetime.datetime.strptime(location["start_time"][:-4], "%Y-%m-%dT%H:%M:%S")
                delta_A = d_end_A - d_start_A
                self.assertEqual( delta_A.days, 365)
                break
        self.assertTrue(found)
        #check resource of B
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":self.name_B})).text)
        self.assertIn("account_name", j)
        self.assertEqual( j["account_name"] , self.name_B )
        found = False
        for location in j["chain_resource"]:
            if location["chain_name"] == Config.chain_name[0]:
                found = True
                self.assertGreaterEqual( location["lease_num"], 20 )
                d_end_B = datetime.datetime.strptime(location["end_time"][:-4], "%Y-%m-%dT%H:%M:%S")
                d_start_B = datetime.datetime.strptime(location["start_time"][:-4], "%Y-%m-%dT%H:%M:%S")
                delta_B = d_end_B - d_start_B
                self.assertLessEqual( delta_B.days, 365)
                self.assertEqual(d_end_B, d_end_A)
                break
        self.assertTrue(found)

    def setUp( self ):
        print('\n====Resource test init====')
        self.create_account()
        self.create_sidechain()
        self.empower_tester()

    def tearDown( self ):
        print('\n====Resource test destroy====')
        self.destroy_account()
