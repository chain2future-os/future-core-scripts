#!/bin/bash
NAME=$1
FUTURE_PATH=$2
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "cp $FUTURE_PATH/future-core-scripts/futuremng/deploy/sideChainService.js  /root/futuremng/src/"