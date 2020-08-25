#!/bin/bash
# 例子：sh /home/sidechain/future-core/scripts/deploy.sh /home/sidechain/future-core/ /home/sidechain/
FUTURE_PATH=$1
DEPLOY_PATH=$2

# 删除原文件
rm $DEPLOY_PATH/deploy -rf

# 拷贝build目录
mkdir $DEPLOY_PATH/deploy -p
cp $FUTURE_PATH/build $DEPLOY_PATH/deploy/build -r

# 拷贝scripts
mkdir $DEPLOY_PATH/deploy/scripts -p
cp $FUTURE_PATH/scripts/bios-test.py $DEPLOY_PATH/deploy/scripts/bios-test.py
cp $FUTURE_PATH/scripts/bios-subchain.py $DEPLOY_PATH/deploy/scripts/bios-subchain.py
cp $FUTURE_PATH/scripts/account_info.py $DEPLOY_PATH/deploy/scripts/account_info.py
cp $FUTURE_PATH/scripts/sidechain_schedule.py $DEPLOY_PATH/deploy/scripts/sidechain_schedule.py

# 拷贝futuremng
cp $FUTURE_PATH/scripts/futuremng $DEPLOY_PATH/deploy/futuremng -r
cd $DEPLOY_PATH/deploy && tar -czvf futuremng.tar ./futuremng/
rm $DEPLOY_PATH/deploy/futuremng -rf

# 打包deploy.tar
cd $DEPLOY_PATH && tar -czvf deploy.tar ./deploy






