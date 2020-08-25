#!/bin/bash
NAME=$1
FUTURE_PATH=$2
cmd="$FUTURE_PATH/future-core-scripts/_runfuture.sh "
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "killall  nodfuture"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "killall  wssfuture"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "$cmd $FUTURE_PATH"
wscmd="$FUTURE_PATH/future-core/build/programs/wssfuture/wssfuture --http-server-address 127.0.0.1:7777 > /log/ws-\${HOSTNAME}.log 2>&1 &"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "$wscmd"
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "/usr/local/bin/pm2 restart votingRandService"
