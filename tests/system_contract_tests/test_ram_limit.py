import unittest
import subprocess
#import time
import requests
#import json
import sys
import string
sys.path.append("..")
from config import Config
from general_func import *

class MultiSig(unittest.TestCase):
    alice_acc = "alice"
    alice_pk = "FUT5566tjgd54VQVXbxSndBjTq3Xcg4UnvqGuTiR7uExaGHx3XLwY"
    alice_sk = "5KCWGqGiNJWVadCTTLUEf6RJZMyBHqNpEvG1MzL4Y93p7xEbT3Y"

    def create_account( self ):
        execcommand = Config.clfuture_path + 'create account futureio %s %s %s ' % (self.alice_acc, self.alice_pk, self.alice_pk)
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'transfer futureio %s "5.0000 FGAS"' %self.alice_acc
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'system resourcelease futureio %s 1 1 futureio' %self.alice_acc
        cmd_exec( execcommand )
        sleep(15)

    def destroy_account( self ):
        execcommand = Config.clfuture_path + 'push action futureio  delaccount \'["%s"]\' --delay-sec 30 -p futureio' % ( self.alice_acc )
        cmd_exec( execcommand )
        sleep(10)

    def import_key( self ):
        execcommand = Config.clfuture_path + 'wallet import --private-key %s' %self.alice_sk
        cmd_exec( execcommand )

    def test_forward( self ):
        execcommand = Config.clfuture_path + 'set contract %s /root/workspace/future-core/build/contracts/test_ram_limit/' % ( self.alice_acc )
        cmd_exec(execcommand)
        sleep(15)
        execcommand = Config.clfuture_path + 'push action %s setentry \'{"from":"1", "to":"100", "size":"32"}\' ' % ( self.alice_acc )
        cmd_exec(execcommand)
        sleep(15)
        execcommand = Config.clfuture_path + 'push action %s printentry \'{"from":"1", "to":"100"}\' ' % ( self.alice_acc )
        cmd_exec(execcommand)
        sleep(15)
        execcommand = Config.clfuture_path + 'push action %s rmentry \'{"from":"1", "to":"100"}\' ' % ( self.alice_acc )
        cmd_exec(execcommand)
        sleep(15)

    def setUp( self ):
        print('\n====Test inline forward init====')
        self.create_account()
        self.import_key()

    def tearDown( self ):
        print('\n====Test inline forward destroy====')
        #self.destroy_account()
