#!/usr/bin/env bash
#batch stop all related dockers
NAME=$1
docker stop $(docker ps -a | grep $NAME- | awk '{print $1}')