#!/bin/bash
# achive all required files to a tar
# sample：sh /home/sidechain/future-core/scripts/deploy/archive.sh /home/sidechain/future-core/ /root/
# sample(docker): sh /root/workspace/future-core/scripts/deploy/archive.sh /root/workspace/future-core/ /root/
FUTURE_PATH=$1
DEPLOY_PATH=$2

# 删除原文件
rm $DEPLOY_PATH/deploy -rf

# 拷贝build目录
mkdir $DEPLOY_PATH/deploy -p
cp $FUTURE_PATH/build $DEPLOY_PATH/deploy/build -r

# 拷贝scripts
mkdir $DEPLOY_PATH/deploy/scripts -p
cp $FUTURE_PATH/scripts $DEPLOY_PATH/deploy/ -r

# 拷贝futuremngU
cp $FUTURE_PATH/scripts/futuremng $DEPLOY_PATH/deploy/futuremng -r
rm $DEPLOY_PATH/deploy/futuremng/deploy -rf
cp $FUTURE_PATH/scripts/deploy/futuremng/config.ini $DEPLOY_PATH/deploy/futuremng/config.ini
cp $FUTURE_PATH/scripts/deploy/futuremng/seedconfig.json $DEPLOY_PATH/deploy/futuremng/seedconfig.json
cp $FUTURE_PATH/scripts/deploy/futuremng/_runfuture.sh $DEPLOY_PATH/deploy/futuremng/tool/_runfuture.sh
cd $DEPLOY_PATH/deploy && tar -czvf futuremng.tar ./futuremng/
rm $DEPLOY_PATH/deploy/futuremng -rf
mkdir $DEPLOY_PATH/deploy/futuremng -p
cp $FUTURE_PATH/scripts/deploy/futuremng/config.ini $DEPLOY_PATH/deploy/futuremng/config.ini
cp $FUTURE_PATH/scripts/deploy/futuremng/seedconfig.json $DEPLOY_PATH/deploy/futuremng/seedconfig.json

# 打包deploy.tar
cd $DEPLOY_PATH && tar -czvf deploy.tar ./deploy






