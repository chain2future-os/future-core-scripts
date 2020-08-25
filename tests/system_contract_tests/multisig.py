import unittest
import subprocess
import time
import requests
import json
import sys
import string
sys.path.append("..")
from config import Config
from general_func import *

class MultiSig(unittest.TestCase):
    jack_acc = "jack"
    jack_pk = "FUT75rwpPD8YSTuT2vfVH1DgxiCve4YusCBKwEExZtHJHoVAjQj4a"
    jack_sk = "5KE91hYFAraYuK7tqJaknPPBNUbvsToZgNCLAXpK8cnJ4W5czKN"
    alice_acc = "alice"
    alice_pk = "FUT5566tjgd54VQVXbxSndBjTq3Xcg4UnvqGuTiR7uExaGHx3XLwY"
    alice_sk = "5KCWGqGiNJWVadCTTLUEf6RJZMyBHqNpEvG1MzL4Y93p7xEbT3Y"
    bob_acc = "bob"
    bob_pk = "FUT5Jq3BunAwFi7s7woBqa8dwcYGMbffuNyBEEwEyuwgGpnQamqWa"
    bob_sk = "5JaX93VhPa3grcH6y2n3T6TX5RYJTyqeutyLfyJ74METu3MysfL"

    name = "tom"
    pk = "FUT5nriDjfZWS8kNCZXKWLBPz9cMN7BA2YdgL89tDokmLAyQD4vto"
    sk = "5Jwc9cRfsFYDeK3Wt8qtDZ2x5fU63HaB3uJf7qrbvmoRV34Z8iQ"

    def create_account( self ):
        execcommand = Config.clfuture_path + 'create account futureio %s %s %s ' % (self.name, self.pk, self.pk)
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'create account futureio %s %s %s ' % (self.jack_acc, self.jack_pk, self.jack_pk)
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'create account futureio %s %s %s ' % (self.alice_acc, self.alice_pk, self.alice_pk)
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'create account futureio %s %s %s ' % (self.bob_acc, self.bob_pk, self.bob_pk)
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'create account futureio futiomsig %s %s ' % (self.pk, self.pk)
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'transfer futureio %s "5.2000 FGAS"' %self.jack_acc
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'transfer futureio futiomsig "5.0000 FGAS"'
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'transfer futureio %s "5.0000 FGAS"' %self.alice_acc
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'transfer futureio %s "5.0000 FGAS"' %self.bob_acc
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'transfer futureio %s "5.0000 FGAS"' %self.name
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'system resourcelease futureio tom 1 1 futureio'
        cmd_exec( execcommand )
        sleep(30)

    def destroy_account( self ):
        execcommand = Config.clfuture_path + 'push action futureio  delaccount \'["%s"]\' --delay-sec 30 -p futureio' % ( self.bob_acc )
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'push action futureio  delaccount \'["%s"]\' --delay-sec 30 -p futureio' % ( self.alice_acc )
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'push action futureio  delaccount \'["%s"]\' --delay-sec 30 -p futureio' % ( self.jack_acc )
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'push action futureio  delaccount \'["%s"]\' --delay-sec 30 -p futureio' % ( self.name )
        cmd_exec( execcommand )
        sleep(10)

    def import_key( self ):
        execcommand = Config.clfuture_path + 'wallet import --private-key %s' %self.sk
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'wallet import --private-key %s' %self.jack_sk
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'wallet import --private-key %s' %self.alice_sk
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'wallet import --private-key %s' %self.bob_sk
        cmd_exec( execcommand )

    def auth_permission( self ):
        execcommand = Config.clfuture_path + 'set account permission %s owner  \'{"threshold":2,"keys":[],"accounts":[{"permission":{"actor":"%s","permission":"owner"},"weight":1},{"permission":{"actor":"%s","permission":"owner"},"weight":1}],"waits":[]}\' -p %s@owner' %(self.jack_acc, self.alice_acc, self.bob_acc, self.jack_acc)
        cmd_exec( execcommand )
        sleep(20)

    def un_auth_permission( self ):
        execcommand = Config.clfuture_path + 'set account permission jack owner  %s -p jack@owner' %self.jack_pk
        cmd_exec( execcommand )
        sleep(15)

    def test_multi_sig( self ):
        tom_token = 0
        jack_token = 0
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":"tom"})).text)
        self.assertIn("account_name", j)
        if "core_liquid_balance" in j:
            space_index = j["core_liquid_balance"].find(' ')
            tom_token = float(j["core_liquid_balance"][:space_index])
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":"jack"})).text)
        self.assertIn("account_name", j)
        self.assertIn("core_liquid_balance", j)
        space_index = j["core_liquid_balance"].find(' ')
        jack_token = float(j["core_liquid_balance"][:space_index])

        execcommand = Config.clfuture_path + 'multisig propose nojack \'[{"actor":"alice","permission":"owner"},{"actor":"bob","permission":"owner"}]\' \'[{"actor":"jack","permission":"owner"}]\' futio.token transfer \'{"from":"jack","to":"tom","quantity":"2.0000 FGAS","memo":"test multisig"}\'  -p futiomsig'
        cmd_exec( execcommand )
        sleep(20)
        j = json.loads(requests.get(Config.get_table_url, data = json.dumps({"code":"futio.msig","scope":"futiomsig","table":"proposal","json":"true","table_key":"nojack"})).text)
        self.assertEqual(len(j["rows"]), 1)
        execcommand = Config.clfuture_path + 'multisig approve futiomsig nojack \'{"actor":"alice","permission":"owner"}\' -p alice@owner'
        cmd_exec( execcommand )
        sleep(30)
        execcommand = Config.clfuture_path + 'multisig exec futiomsig nojack -p tom'
        cmd_exec( execcommand )
        sleep(30)
        j = json.loads(requests.get(Config.get_table_url, data = json.dumps({"code":"futio.msig","scope":"futiomsig","table":"proposal","json":"true","table_key":"nojack"})).text)
        self.assertEqual(len(j["rows"]), 1)
        execcommand = Config.clfuture_path + 'multisig approve futiomsig nojack \'{"actor":"bob","permission":"owner"}\' -p bob@owner'
        cmd_exec( execcommand )
        sleep(30)
        execcommand = Config.clfuture_path + 'multisig exec futiomsig nojack -p tom'
        cmd_exec( execcommand )
        sleep(30)
        j = json.loads(requests.get(Config.get_table_url, data = json.dumps({"code":"futio.msig","scope":"futiomsig","table":"proposal","json":"true","table_key":"nojack"})).text)
        self.assertEqual(len(j["rows"]), 0)
        jack_new_token = 0
        tom_new_token = 0
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":"jack"})).text)
        self.assertIn("account_name", j)
        if "core_liquid_balance" in j:
            space_index = j["core_liquid_balance"].find(' ')
            jack_new_token = float(j["core_liquid_balance"][:space_index])
        else:
            jack_new_token = 0
        j = json.loads(requests.get(Config.get_account_info_url,data = json.dumps({"account_name":"tom"})).text)
        self.assertIn("account_name", j)
        self.assertIn("core_liquid_balance", j)
        space_index = j["core_liquid_balance"].find(' ')
        tom_new_token = float(j["core_liquid_balance"][:space_index])

        self.assertLessEqual(jack_new_token - (jack_token - 2.2), 0.01)
        self.assertLessEqual(abs(tom_new_token - tom_token - 2), 1)

    def setUp( self ):
        print('\n====MultiSig init====')
        self.create_account()
        self.import_key()
        self.auth_permission()

    def tearDown( self ):
        print('\n====MultiSig destroy====')
        #self.destroy_account()
        #self.un_auth_permission() 
