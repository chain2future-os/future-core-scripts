#!/usr/bin/env bash

echo "deploy all files"

# program
# nodfuture
echo "cp /root/mongo_setup/files/program/nodfuture /root/"
cp /root/mongo_setup/files/program/nodfuture /root/
chmod +x /root/nodfuture
# wss
echo "cp /root/mongo_setup/files/program/wssfuture /root/"
cp /root/mongo_setup/files/program/wssfuture /root/
chmod +x /root/wssfuture
# futuremng
echo "cp /root/mongo_setup/files/futuremng/ /root/ -rf"
cp /root/mongo_setup/files/futuremng/ /root/ -rf
chmod +x /root/futuremng/tool/
chmod +x /root/futuremng/src/sideChainService.js
# votingrand
echo "cp /root/mongo_setup/files/voterand/ /root/ -rf"
cp /root/mongo_setup/files/voterand/ /root/ -rf
chmod +x /root/voterand/migrations/votingRandService.js
sleep 1

#scripts
echo "cp /root/mongo_setup/files/scripts/runfuture-h.sh /root/"
cp /root/mongo_setup/files/scripts/runfuture-h.sh /root/
chmod +x /root/runfuture-h.sh
echo "cp /root/mongo_setup/files/scripts/logrotate.sh /root/"
cp /root/mongo_setup/files/scripts/logrotate.sh /root/
chmod +x /root/logrotate.sh
echo "cp /root/mongo_setup/files/scripts/runlogr.sh /root/"
cp /root/mongo_setup/files/scripts/runlogr.sh /root/
chmod +x /root/runlogr.sh


# config
# nodfuture
echo "mkdir /root/.local/share/futureio/nodfuture/config/ -p"
mkdir /root/.local/share/futureio/nodfuture/config/ -p
echo "cp /root/mongo_setup/files/config/nodfuture/config.ini /root/.local/share/futureio/nodfuture/config/"
cp /root/mongo_setup/files/config/nodfuture/config.ini /root/.local/share/futureio/nodfuture/config/
sleep 1
# wss
echo "mkdir /root/.local/share/futureio/wssfuture/config/ -p"
mkdir /root/.local/share/futureio/wssfuture/config/ -p
echo "cp /root/mongo_setup/files/config/wssfuture/config.ini /root/.local/share/futureio/wssfuture/config/"
cp /root/mongo_setup/files/config/wssfuture/config.ini /root/.local/share/futureio/wssfuture/config/
sleep 1
#futuremng
echo "mkdir /root/.local/share/futureio/futuremng/config/ -p"
mkdir /root/.local/share/futureio/futuremng/config/ -p
echo "cp /root/mongo_setup/files/config/futuremng/config.ini /root/.local/share/futureio/futuremng/config/"
cp /root/mongo_setup/files/config/futuremng/config.ini /root/.local/share/futureio/futuremng/config/
echo "cp /root/mongo_setup/files/config/futuremng/seedconfig.json /root/.local/share/futureio/futuremng/config/"
cp /root/mongo_setup/files/config/futuremng/seedconfig.json /root/.local/share/futureio/futuremng/config/

# start nod by ws
echo "start nod by ws"
echo "nohup /root/nodfuture --worldstate /root/mongo_setup/files/ws/1f1155433d9097e0f67de63a48369916da91f19cb1feff6ba8eca2e5d978a2b2-312000.ws &"
rm /root/.local/share/futureio/nodfuture/data/ -rf
nohup /root/nodfuture --worldstate /root/mongo_setup/files/ws/1f1155433d9097e0f67de63a48369916da91f19cb1feff6ba8eca2e5d978a2b2-312000.ws &>> /log/${DATE}-${HOSTNAME}.log &
sleep 1

# start futuremng
echo "pm2 start /root/futuremng/src/sideChainService.js"
pm2 start /root/futuremng/src/sideChainService.js

echo "deploy all files done."
