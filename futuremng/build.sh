#!/usr/bin/env bash

# futuremng tar
downloadUrl="http://40.73.35.128:7656/download/node_module/futuremng/node-modules.tar"
echo "start to download ultramng modules..."
base_dir=$(cd "$(dirname "$0")";pwd)
echo "base dir is :"
echo $base_dir
tarDir=$base_dir/node-modules.tar

if [ ! -f  $tarDir ];then
echo "node-modules.tar is not exist，need not delete"
else
rm -f $tarDir
fi
echo "start to download.."
wget -P $base_dir $downloadUrl

modulesDir=$base_dir/node-modules/
if [ -d $modulesDir ];then
echo "node-modules is exist,need remove"
rm -rf $modulesDir
else
echo "node-modules is not exist"
fi
echo "tar -xvf node-modules.tar"
cd $base_dir && tar -xvf node-modules.tar








