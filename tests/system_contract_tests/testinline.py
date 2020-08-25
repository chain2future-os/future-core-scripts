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
        sleep(20)
        execcommand = Config.clfuture_path + 'system resourcelease futureio jack 1 1 futureio'
        cmd_exec( execcommand )
        execcommand = Config.clfuture_path + 'system resourcelease futureio bob 1 1 futureio'
        cmd_exec( execcommand )
        sleep(15)

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

    def test_forward( self ):
        execcommand = Config.clfuture_path + 'set contract jack /root/workspace/future-core/build/contracts/test.inline/'
        cmd_exec(execcommand)
        execcommand = Config.clfuture_path + 'set contract bob /root/workspace/future-core/build/contracts/test.inline/'
        cmd_exec(execcommand)
        sleep(15)
        execcommand = Config.clfuture_path + 'push action jack forward \'{"reqauth":"jack", "forward_code":"bob", "forward_auth":"alice" }\' '
        cmd_exec(execcommand)

    def setUp( self ):
        print('\n====Test inline forward init====')
        self.create_account()
        self.import_key()

    def tearDown( self ):
        print('\n====Test inline forward destroy====')
        #self.destroy_account()
