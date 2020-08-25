#!/usr/bin/env bash

echo "deploy all files"

# program
# nodfuture
echo "cp ~/miner_setup/files/program/nodfuture ~/"
cp ~/miner_setup/files/program/nodfuture ~/
chmod +x ~/nodfuture
# wss
echo "cp ~/miner_setup/files/program/wssfuture ~/"
cp ~/miner_setup/files/program/wssfuture ~/
chmod +x ~/wssfuture
# futuremng
echo "cp ~/miner_setup/files/futuremng/ ~/ -rf"
cp ~/miner_setup/files/futuremng/ ~/ -rf
chmod +x ~/futuremng/tool/
chmod +x ~/futuremng/src/sideChainService.js
# votingrand
echo "cp ~/miner_setup/files/voterand/ ~/ -rf"
cp ~/miner_setup/files/voterand/ ~/ -rf
chmod +x ~/voterand/migrations/votingRandService.js
sleep 1

#scripts
echo "cp ~/miner_setup/files/scripts/runfuture-h.sh ~/"
cp ~/miner_setup/files/scripts/runfuture-h.sh ~/
chmod +x ~/runfuture-h.sh

# config
# nodfuture
echo "mkdir ~/.local/share/futureio/nodfuture/config/ -p"
mkdir ~/.local/share/futureio/nodfuture/config/ -p
echo "cp ~/miner_setup/files/config/nodfuture/config.ini ~/.local/share/futureio/nodfuture/config/"
cp ~/miner_setup/files/config/nodfuture/config.ini ~/.local/share/futureio/nodfuture/config/
sleep 1
# wss
echo "mkdir ~/.local/share/futureio/wssfuture/config/ -p"
mkdir ~/.local/share/futureio/wssfuture/config/ -p
echo "cp ~/miner_setup/files/config/wssfuture/config.ini ~/.local/share/futureio/wssfuture/config/"
cp ~/miner_setup/files/config/wssfuture/config.ini ~/.local/share/futureio/wssfuture/config/
sleep 1
#futuremng
echo "mkdir ~/.local/share/futureio/futuremng/config/ -p"
mkdir ~/.local/share/futureio/futuremng/config/ -p
echo "cp ~/miner_setup/files/config/futuremng/config.ini ~/.local/share/futureio/futuremng/config/"
cp ~/miner_setup/files/config/futuremng/config.ini ~/.local/share/futureio/futuremng/config/
echo "cp ~/miner_setup/files/config/futuremng/seedconfig.json ~/.local/share/futureio/futuremng/config/"
cp ~/miner_setup/files/config/futuremng/seedconfig.json ~/.local/share/futureio/futuremng/config/
echo "cp ~/miner_setup/files/config/futuremng/group.json ~/.local/share/futureio/futuremng/config/"
cp ~/miner_setup/files/config/futuremng/group.json  ~/.local/share/futureio/futuremng/config/

#mongo-process
echo "cp ~/miner_setup/files/mongo/mongo_process.py ~/"
cp ~/miner_setup/files/mongo/mongo_process.py ~/
echo "chmod +x ~/mongo_process.py"
chmod +x ~/mongo_process.py

echo "deploy all files done."
