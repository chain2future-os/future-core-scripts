#!/bin/bash
NAME=$1
FUTURE_PATH=$2
if [ ! -d "config/IPs" ]; then
  mkdir -p config/IPs
fi
for i in `docker ps  --filter  name=$NAME- | grep $NAME-  | awk '{print $1}'`;
do echo $i;
docker inspect $i -f '{{.Config.Hostname}}';
docker inspect $i -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}';#'{{.NetworkSettings.IPAddress}}' # '{{.NetworkSettings.Networks.globalnet.IPAddress}}';
done > config/IPs/dockerinfo.txt
python2 generateconfig.py $3 $4 $5 $6 $7 $8 $9 ${10} ${11} ${12} ${13} &>generateconfig.log  &
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "mkdir -p /root/.local/share/futureio/nodfuture/config"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "cp $FUTURE_PATH/future-core-scripts/config/config/{}.ini /root/.local/share/futureio/nodfuture/config/config.ini"
cmd="$FUTURE_PATH/future-core-scripts/_runfuture.sh "
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "rm -rf /tmp/* "
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "mkdir -p /tmp/ "
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "$cmd $FUTURE_PATH"
cmd="nohup $FUTURE_PATH/future-core-scripts/logrotate.sh &"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "$cmd"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "mkdir -p /root/.local/share/futureio/wssfuture/config"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "cp $FUTURE_PATH/future-core-scripts/ws/config.ini /root/.local/share/futureio/wssfuture/config/config.ini"
wscmd="$FUTURE_PATH/future-core/build/programs/wssfuture/wssfuture --http-server-address 127.0.0.1:7777 > /log/ws-\${HOSTNAME}.log 2>&1 &"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "$wscmd"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "mkdir -p /root/.local/share/futureio/futuremng/config"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "cp $FUTURE_PATH/future-core-scripts/futuremng/config.ini /root/.local/share/futureio/futuremng/config/config.ini"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "cp $FUTURE_PATH/future-core-scripts/futuremng/seedconfig.json /root/.local/share/futureio/futuremng/config/seedconfig.json"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "cp $FUTURE_PATH/future-core-scripts/futuremng/group.json /root/.local/share/futureio/futuremng/config/group.json"
#docker ps |\ grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "/usr/local/bin/pm2 start $FUTURE_PATH/future-core-scripts/futuremng/src/sideChainService.js"
#docker ps | grep $NAME-[1-7]$ | awk '{print $1}' | xargs -i docker exec -d {} bash -c "/usr/local/bin/pm2 start $FUTURE_PATH/future-core-scripts/voterand/migrations/votingRandService.js -o /log/votingRandService.pm2.log -e /log/votingRandService.pm2.error.log"

