#!/bin/bash
FUTURE_PATH=$1
nohup $FUTURE_PATH/wssfuture --http-server-address 127.0.0.1:7777 &>> /log/wss-${DATE}-${HOSTNAME}.log  &

