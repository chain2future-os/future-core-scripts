#!/bin/bash
# 例子：sh /home/sidechain/future-core/scripts/deploy/deploy.sh /home/sidechain/future-core/ /home/sidechain/
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
cp $FUTURE_PATH/scripts/deploy/futuremng/config.ini $DEPLOY_PATH/deploy/futuremng/config.ini
cp $FUTURE_PATH/scripts/deploy/futuremng/seedconfig.json $DEPLOY_PATH/deploy/futuremng/seedconfig.json
cd $DEPLOY_PATH/deploy && tar -czvf futuremng.tar ./futuremng/
rm $DEPLOY_PATH/deploy/futuremng -rf

# 打包deploy.tar
cd $DEPLOY_PATH && tar -czvf deploy.tar ./deploy






