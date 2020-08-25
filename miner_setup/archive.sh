#!/usr/bin/env bash
# please move the folder to ~/miner_setup
echo "start to archive files...."

#files
echo "rm ~/miner_setup/files -rf"
rm ~/miner_setup/files -rf
sleep 1

echo "mkdir ~/miner_setup/files -p"
mkdir ~/miner_setup/files -p
sleep 1

#program
echo "mkdir ~/miner_setup/files/program -p"
mkdir ~/miner_setup/files/program -p
sleep 1

#nodfuture
echo "cp ~/nodfuture ~/miner_setup/files/program/"
cp ~/nodfuture ~/miner_setup/files/program/
sleep 1

#wssfuture
echo "cp ~/wssfuture ~/miner_setup/files/program/"
cp ~/wssfuture ~/miner_setup/files/program/
sleep 1

#futuremng
echo "cp ~/futuremng ~/miner_setup/files/ -rf"
cp ~/futuremng ~/miner_setup/files/ -rf
sleep 1

#votingrand
echo "cp ~/voterand ~/miner_setup/files/ -rf"
cp ~/voterand ~/miner_setup/files/ -rf
sleep 1

#config
echo "mkdir ~/miner_setup/files/config -p"
mkdir ~/miner_setup/files/config -p
echo "mkdir ~/miner_setup/files/config/futuremng -p"
mkdir ~/miner_setup/files/config/futuremng -p
echo "cp ~/.local/share/futureio/futuremng/config/config.ini ~/miner_setup/files/config/futuremng/"
cp ~/.local/share/futureio/futuremng/config/config.ini ~/miner_setup/files/config/futuremng/
echo "cp ~/.local/share/futureio/futuremng/config/seedconfig.json ~/miner_setup/files/config/futuremng/"
cp ~/.local/share/futureio/futuremng/config/seedconfig.json ~/miner_setup/files/config/futuremng/
echo "cp ~/.local/share/futureio/futuremng/config/group.json ~/miner_setup/files/config/futuremng/"
cp ~/.local/share/futureio/futuremng/config/group.json ~/miner_setup/files/config/futuremng/
sleep 1
echo "mkdir ~/miner_setup/files/config/wssfuture -p"
mkdir ~/miner_setup/files/config/wssfuture -p
echo "cp ~/.local/share/futureio/wssfuture/config/config.ini ~/miner_setup/files/config/wssfuture/"
cp ~/.local/share/futureio/wssfuture/config/config.ini ~/miner_setup/files/config/wssfuture/
echo "mkdir ~/miner_setup/files/config/nodfuture -p"
mkdir ~/miner_setup/files/config/nodfuture -p
echo "cp ~/.local/share/futureio/nodfuture/config/config.ini ~/miner_setup/files/config/nodfuture/"
cp ~/.local/share/futureio/nodfuture/config/config.ini ~/miner_setup/files/config/nodfuture/
sleep 1

#scripts
echo "mkdir ~/miner_setup/files/scripts -p"
mkdir ~/miner_setup/files/scripts -p
echo "cp ~/runfuture-h.sh ~/miner_setup/files/scripts/"
cp ~/runfuture-h.sh ~/miner_setup/files/scripts/

#mongo-process
echo "mkdir ~/miner_setup/files/mongo"
mkdir ~/miner_setup/files/mongo
echo "cp ~/mongo_process.py ~/miner_setup/files/mongo/"
cp ~/mongo_process.py ~/miner_setup/files/mongo/













