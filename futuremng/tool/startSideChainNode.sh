#!/bin/bash
NAME=$1
FUTURE_PATH=$2
docker ps | grep $NAME- | awk '{print $1}' | xargs -i docker exec -d {} bash -c "/usr/local/bin/pm2 start $FUTURE_PATH/future-core-scripts/futuremng/src/sideChainService.js"

