#!/bin/bash
# achive all required files to a tar
# sample：sh /home/sidechain/future-core/scripts/deploy/archive-prod.sh /home/sidechain/future-core/ /root/
# sample(docker): sh /root/workspace/future-core/scripts/deploy/archive-prod.sh /root/workspace/future-core/ /root/
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
mkdir $DEPLOY_PATH/deploy/futuremng -p
cp $FUTURE_PATH/scripts/futuremng/node_modules $DEPLOY_PATH/deploy/futuremng/node_modules -r
cp $FUTURE_PATH/scripts/deploy/futuremng/config.ini $DEPLOY_PATH/deploy/futuremng/config.ini
cp $FUTURE_PATH/scripts/deploy/futuremng/seedconfig.json $DEPLOY_PATH/deploy/futuremng/seedconfig.json
cp $FUTURE_PATH/scripts/futuremng/tool $DEPLOY_PATH/deploy/futuremng/tool -rf
cp $FUTURE_PATH/scripts/deploy/futuremng/_runfuture.sh $DEPLOY_PATH/deploy/futuremng/tool/_runfuture.sh
mkdir $DEPLOY_PATH/deploy/futuremng/src
cp $FUTURE_PATH/scripts/futuremng/deploy/sideChainService.js $DEPLOY_PATH/deploy/futuremng/src/sideChainService.js
cd $DEPLOY_PATH/deploy && tar -czvf futuremng.tar ./futuremng/
rm $DEPLOY_PATH/deploy/futuremng -rf
mkdir $DEPLOY_PATH/deploy/futuremng -p
cp $FUTURE_PATH/scripts/deploy/futuremng/config.ini $DEPLOY_PATH/deploy/futuremng/config.ini
cp $FUTURE_PATH/scripts/deploy/futuremng/seedconfig.json $DEPLOY_PATH/deploy/futuremng/seedconfig.json

#打包voterand
cp $FUTURE_PATH/scripts/voterand $DEPLOY_PATH/deploy/voterand -r
mkdir $DEPLOY_PATH/deploy/voterand/scripts/rand -p
cp $FUTURE_PATH/scripts/rand/vrf_client $DEPLOY_PATH/deploy/voterand/scripts/rand/vrf_client
cp $FUTURE_PATH/scripts/rand/b58.pl $DEPLOY_PATH/deploy/voterand/scripts/rand/b58.pl
cd $DEPLOY_PATH/deploy && tar -czvf voterand.tar ./voterand/
rm $DEPLOY_PATH/deploy/voterand -rf

# 打包deploy.tar
cd $DEPLOY_PATH && tar -czvf deploy.tar ./deploy






