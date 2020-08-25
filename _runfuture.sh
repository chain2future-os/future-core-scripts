#!/bin/bash
FUTURE_PATH=$1
rm -f /log/${HOSTNAME}.log
nohup $FUTURE_PATH/future-core-scripts/_runfuture.py $FUTURE_PATH/future-core/build &>> /log/${HOSTNAME}.log  &
