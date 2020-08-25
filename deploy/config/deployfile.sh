#!/bin/bash
set -x
#./stopchains.sh
rm -rf deploy
tar xf deploy.tar
# update deploy config
sh /root/deploy/scripts/deploy/config/updateConfig.sh deploy-master
sh /root/deploy/scripts/deploy/config/updateConfig.sh deploy-env01
sh /root/deploy/scripts/deploy/config/updateConfig.sh deploy-env02
sh /root/deploy/scripts/deploy/config/updateConfig.sh deploy-env03
# deploy file
cp deploy/build/programs/nodfuture/nodfuture deploy-master
cp deploy/build/programs/wssfuture/wssfuture deploy-master
cp deploy/futuremng.tar deploy-master
cp deploy/voterand.tar deploy-master
cp deploy/futuremng/seedconfig.json deploy-master/futuremng/seedconfig.json
cp deploy/futuremng/config.ini deploy-master/futuremng/config.ini
cd deploy-master && python controller.py deploy
cd ..
cp deploy/build/programs/nodfuture/nodfuture deploy-env01
cp deploy/build/programs/wssfuture/wssfuture deploy-env01
cp deploy/futuremng.tar deploy-env01
cp deploy/voterand.tar deploy-env01
cp deploy/futuremng/seedconfig.json deploy-env01/futuremng/seedconfig.json
cp deploy/futuremng/config.ini deploy-env01/futuremng/config.ini
cd deploy-env01 && python controller.py deploy
cd ..
cp deploy/build/programs/nodfuture/nodfuture deploy-env02
cp deploy/build/programs/wssfuture/wssfuture deploy-env02
cp deploy/futuremng.tar deploy-env02
cp deploy/voterand.tar deploy-env02
cp deploy/futuremng/seedconfig.json deploy-env02/futuremng/seedconfig.json
cp deploy/futuremng/config.ini deploy-env02/futuremng/config.ini
cd deploy-env02 && python controller.py deploy
cd ..
cp deploy/build/programs/nodfuture/nodfuture deploy-env03
cp deploy/build/programs/wssfuture/wssfuture deploy-env03
cp deploy/futuremng.tar deploy-env03
cp deploy/voterand.tar deploy-env03
cp deploy/futuremng/seedconfig.json deploy-env03/futuremng/seedconfig.json
cp deploy/futuremng/config.ini deploy-env03/futuremng/config.ini
cd deploy-env03 && python controller.py deploy
cd ..
fab -f sendfile.py deploy
