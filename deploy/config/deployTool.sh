#!/usr/bin/env bash
# 服务器上部署，创世前动作
echo "clear old dir========"
echo "rm /root/deploy -rf"
rm /root/deploy -rf
echo "rm /root/workspace/future-core/ -rf"
rm /root/workspace/future-core/ -rf


echo "tar -xvf deploy.tar to /root========"
tar -xvf deploy.tar -C /root/

echo "make new dir========"
echo "mkdir /root/workspace/future-core -p"
mkdir /root/workspace/future-core -p
mkdir /root/workspace/future-core/scripts -p


echo "cp /root/deploy/build /root/workspace/future-core/build -r"
cp /root/deploy/build /root/workspace/future-core/build -r
echo "cp /root/deploy/scripts/ /root/workspace/future-core/scripts -r"
cp /root/deploy/scripts/ /root/workspace/future-core/scripts -r
cd /root/workspace/future-core/scripts/

/root/workspace/future-core/build/programs/clfuture/clfuture system listproducers


