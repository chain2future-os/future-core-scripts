#!/usr/bin/env python
#coding=utf-8

mongochain = {"11":{
    "ip":'172.16.10.6',   #ip
    "port":27018,           #端口
    "db_name" : "future",    #数据库名字
    "set_name" : "blocks",   #集合名字
    "account" : "root",
    "passward" : "Uranus",
}
,"12":{
    "ip":'172.16.10.6',   #ip
    "port":27019,           #端口
    "db_name" : "future",    #数据库名字
    "set_name" : "blocks",   #集合名字
    "account" : "root",
    "passward" : "Uranus",
}
}

testNetmasterHttp = {
    "futureio":"http://172.16.10.6:8888", #主链
}
testNetsideHttp = {
    "11":"http://172.16.10.6:8889",  #先锋链
    "12":"http://172.16.10.6:8890",  #动力链
}
masterNetHttp = {
    "futureio":"http://40.121.11.165:8888",#  "futureio":"https://future.services",
    "pioneer":"http://139.217.87.141:8888",#  "pioneer":"https://pioneer.future.services",
    "unitopia":"http://40.121.21.140:8888",#  "unitopia":"https://unitopia.future.services",
    "newretail":"http://139.217.96.141:8888",#  "newretail":"https://new-retail.future.services",
    "australia":"http://120.92.210.60:8888",#"australia":"https://australia.future.services"
}