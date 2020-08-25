#!/usr/bin/env bash
echo "killall nodfuture";
killall nodfuture
sleep 1
echo "killall wssfuture";
killall wssfuture
sleep 1
echo "pm2 stop votingRandService"
pm2 stop votingRandService
sleep 1
echo "pm2 delete votingRandService"
pm2 delete votingRandService
sleep 1
cp ./runfuture-h.sh /root/
chmod +x /root/runfuture-h.sh
sleep 1
echo "/root/runfuture-h.sh"
/root/runfuture-h.sh
sleep 1
echo "cp ./config.ini /root/.local/share/futureio/futuremng/config/config.ini"
cp ./config.ini /root/.local/share/futureio/futuremng/config/config.ini
echo "pm2 start /root/futuremng/src/sideChainService.js"
pm2 start /root/futuremng/src/sideChainService.js


