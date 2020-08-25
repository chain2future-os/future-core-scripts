#!/usr/bin/env bash
echo "killall nodfuture";
killall nodfuture
sleep 1
echo "killall wssfuture";
killall wssfuture
sleep 1
echo "pm2 stop sideChainService"
pm2 stop sideChainService
sleep 1
echo "pm2 delete sideChainService"
pm2 delete sideChainService
sleep 1
cp /root/workspace/transfer/runfuture-h.sh /root/
chmod +x /root/runfuture-h.sh
sleep 1
echo "cp /root/workspace/future-core/build/programs/nodfuture/nodfuture /root/"
cp /root/workspace/future-core/build/programs/nodfuture/nodfuture /root/
sleep 1
echo "chmod +x /root/nodfuture"
chmod +x /root/nodfuture
echo "cp /root/workspace/future-core/build/programs/wssfuture/wssfuture /root/"
cp /root/workspace/future-core/build/programs/wssfuture/wssfuture /root/
sleep 1
echo "chmod +x /root/wssfuture"
chmod +x /root/wssfuture
sleep 1
echo "mkdir /root/futuremng/src/ -p"
mkdir /root/futuremng/src/ -p
sleep 1
echo "cp /root/workspace/future-core/scripts/futuremng/deploy/sideChainService.js /root/futuremng/src/"
cp /root/workspace/future-core/scripts/futuremng/deploy/sideChainService.js /root/futuremng/src/
sleep 1
chmod +x /root/futuremng/src/sideChainService.js
echo "cp /root/workspace/future-core/scripts/futuremng/node_modules/ /root/futuremng/ -rf"
cp /root/workspace/future-core/scripts/futuremng/node_modules/ /root/futuremng/ -rf
sleep 1
echo "cp /root/workspace/future-core/scripts/voterand/ /root/ -rf"
cp /root/workspace/future-core/scripts/voterand/ /root/ -rf
sleep 1
echo "/root/runfuture-h.sh"
/root/runfuture-h.sh
sleep 1
echo "cp /root/workspace/transfer/config.ini /root/.local/share/futureio/futuremng/config/config.ini"
cp /root/workspace/transfer/config.ini /root/.local/share/futureio/futuremng/config/config.ini
echo "pm2 start /root/futuremng/src/sideChainService.js"
pm2 start /root/futuremng/src/sideChainService.js


