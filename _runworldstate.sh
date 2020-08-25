#!/bin/bash
FUTURE_PATH=$1
rm -f /log/ws-${HOSTNAME}.log
$FUTURE_PATH/future-core/build/programs/wssfuture/wssfuture --http-server-address 127.0.0.1:7777 > /log/ws-${HOSTNAME}.log  2>&1 &

