#!/bin/bash
FUTURE_PATH=$1
WSSPATH=$2
DATE=`date +%Y-%m-%d-%H-%M`
nohup $FUTURE_PATH/nodfuture $WSSPATH &>> /log/${DATE}-${HOSTNAME}.log  &
