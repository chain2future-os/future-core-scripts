from fabric.api import *
from fabric.contrib.files import exists

with open('hosts.txt') as f:
    env.hosts = f.read().splitlines()
env.user = 'root'
env.password = 'Uranus12#$'
env.warn_only = True


def deployblocks():
    run("rm /root/.local/share/futureio/nodfuture/data -rf")
    run("mkdir /root/.local/share/futureio/nodfuture/data -p")
    put("blocks.tar","/root/.local/share/futureio/nodfuture/data/")
    run("cd /root/.local/share/futureio/nodfuture/data/ && tar -xvf blocks.tar")

def updateetchost():
    put("hosts","/etc/hosts");

def echochainname():
    run("cat /root/.local/share/futureio/nodfuture/config/config.ini  | grep chain-name");


def pm2stop():
    run("pm2 stop all");

def restartmng():
    run("pm2 restart /root/futuremng/src/sideChainService.js && sleep 1");

def startnod():
    run("/root/runfuture-h.sh && sleep 1");

def killnod():
    run("killall nodfuture");

def echoSeed():
    run("cat /root/.local/share/futureio/nodfuture/config/config.ini  | grep udp-seed");

def echoAccountInfo():
    run("cat /root/.local/share/futureio/nodfuture/config/config.ini  | grep my-account-as-committee -A 5");

def updateVoteFile():
    put("voting.js","/root/voterand/migrations/voting.js");

def catHostIinfo():
    run("cat /proc/sys/kernel/hostname");

def stopNodAndMng():
    run("pm2 stop all && killall nodfuture");

def uploadNodConfig():
    put("config/%s/*" % env.host,"/root/.local/share/futureio/nodfuture/config/config.ini");

def updateMngIni():
    put("seedconfig.json","/root/.local/share/futureio/futuremng/config/seedconfig.json")

def clearLog():
    run('find /log -mindepth 1 -mtime +1 -delete')

def installMinerFile():
    run('sh /root/install.sh')

def deployMinerFile():
    put("miner_setup.tar","/root/")
    run("tar xf miner_setup.tar")
    run("chmod +x ~/miner_setup/install.sh")
    run("~/miner_setup/install.sh")



def deployall():
#    run('mkdir log')
#    put("/root/logrotate.sh","/root/")
#    run('chmod +x /root/logrotate.sh')
#    put("/root/runlogr.sh","/root/")
#    run('chmod +x /root/runlogr.sh')
    put("/root/runfuture-h.sh","/root/")
    run('chmod +x /root/runfuture-h.sh')

def updatefile():
    put("nodfuture","/root/")
    run('chmod +x /root/nodfuture')
    put("sideChainService.js","/root/futuremng/src/")
    run('chmod +x /root/futuremng/src/')

#@parallel
def updateVotingfile():
    put("voting.js","/root/voterand/migrations/")

#@parallel
def deployfile():
    #run("mkdir -p /root/config")
    #put("/root/uploadconfig.sh","/root/config")
    put("nodfuture","/root/")
    run('chmod +x /root/nodfuture')
    put("wssfuture","/root/")
    run('chmod +x /root/wssfuture')
    run("rm -rf /root/futuremng")
    put("futuremng.tar","/root/")
    run("tar xf futuremng.tar")
    run("chmod +x /root/futuremng/tool/_runfuture.sh")
    run("chmod +x /root/futuremng/tool/_runworldstate.sh")
    put("voterand.tar","/root/")
    run("tar xf voterand.tar")
    run("chmod +x /root/voterand/scripts/rand/vrf_client")
    run("chmod +x /root/voterand/scripts/rand/b58.pl")
    #put("futuremng","/root/")
    #put("/root/restartdockers.sh","/root/")
    #run('chmod +x /root/restartdockers.sh')
    #put("/root/startdockers.sh","/root/")
    #run('chmod +x /root/startdockers.sh')
    #run('mkdir log')
    #put("/root/logrotate.sh","/root/")
    #run('chmod +x /root/logrotate.sh')
    #put("/root/runlogr.sh","/root/")
    #run('chmod +x /root/runlogr.sh')
    #put("/root/runfuture-h.sh","/root/")
    #run('chmod +x /root/runfuture-h.sh')
    #put("/root/runeos.sh","/root/")
    #put("/root/stopNod.sh","/root/")
    #put("/root/installsoft.sh","/root/")
    #run('chmod +x /root/installsoft.sh')
    #run('/root/installsoft.sh')
    #run('brctl stp docker_gwbridge on')
    #run('brctl stp docker0 on')
    #put('/root/libstdc++.so.6.0.25','/usr/lib/x86_64-linux-gnu/')
    #run('rm /usr/lib/x86_64-linux-gnu/libstdc++.so.6')
    #run('ln /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.25 /usr/lib/x86_64-linux-gnu/libstdc++.so.6')
    #run('cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime')

@parallel
def updatelogrotate():
    put("/root/runlogr.sh","/root/")
    run('chmod +x /root/runlogr.sh')
    run("killall logrotate.sh")
    put("/root/logrotate.sh","/root/")
    run('chmod +x /root/logrotate.sh')
    run("/root/runlogr.sh && sleep 1")


@parallel
def clearhostlog():
    with cd('/log'):
         run('rm -rf *')

@parallel
def clearhostdata():
    run('rm -rf /root/.local/share/futureio/nodfuture/data/')
    run('rm -rf /root/.local/share/futureio/wssfuture/data/worldstate')
    run('rm -rf /mongodb/data && rm -rf /mongodb/log')

@parallel
def clearhostenv():
    clearhostlog()
    clearhostdata()

@parallel
def starthosts():
    run("mkdir /log && sleep 1")
    run("/root/runfuture-h.sh && sleep 1")
    run("/root/runlogr.sh && sleep 1")

    #run("pm2 start /root/futuremng/src/sideChainService.js && sleep 1")

@parallel
def startmng():
    run("pm2 start /root/futuremng/src/sideChainService.js -o /log/sideChainService.pm2.log -e /log/sideChainService.pm2.error.log && sleep 1")

@parallel
def stopmng():
    run("pm2 stop sideChainService")

@parallel
def deletemng():
    run("pm2 delete sideChainService")

@parallel
def startvoterand():
    run("pm2 start /root/voterand/migrations/votingRandService.js -o /log/votingRandService.pm2.log -e /log/votingRandService.pm2.error.log && sleep 1")

@parallel
def stopvoterand():
    run("pm2 stop votingRandService")

@parallel
def deletevoterand():
    run("pm2 delete votingRandService")

@parallel
def savepm2startup():
    run("pm2 save && sleep 1 && pm2 startup && sleep 1 && pm2 save && sleep 1")

@parallel
def upgrademng():
    run("rm -rf /root/futuremng")
    put("futuremng.tar","/root/")
    run("tar xf futuremng.tar")
    run("chmod +x /root/futuremng/tool/_runfuture.sh")
    run("chmod +x /root/futuremng/tool/_runworldstate.sh")
    put("futuremng/seedconfig.json", "/root/.local/share/futureio/futuremng/config/seedconfig.json")
    put("futuremng/config.ini", "/root/.local/share/futureio/futuremng/config/config.ini")
    run("pm2 restart /root/futuremng/src/sideChainService.js && sleep 1")

@parallel
def stophosts():
    run('killall -2 nodfuture')
    run('killall -2 wssfuture')
    run("killall logrotate.sh")
    run("pm2 stop sideChainService")
    run("pm2 delete sideChainService")
    run("pm2 stop votingRandService")
    run("pm2 delete votingRandService")

@parallel
def getIPs():
    run("for i in `docker ps | grep uranus | awk '{print $1}'`; \
            do echo $i; \
            docker inspect $i -f '{{.Config.Hostname}}';\
            docker inspect $i -f '{{.NetworkSettings.Networks.globalnet.IPAddress}}';\
            done > %s.txt" % env.host)
    get("%s.txt" % env.host,"IPs")

#@parallel
def startdockers():
    run("/root/startdockers.sh 2")

#@parallel
def restartdockers():
    run("/root/restartdockers.sh")

@parallel
def stopdockers():
    run("/root/stopdockers.sh")

@parallel
def startnods():
    run("/root/startNod.sh")
    run("/root/runlogr.sh && sleep 1")

@parallel
def stopnods():
    run("/root/stopNod.sh")
    run("killall logrotate.sh")

@parallel
def clearnodsdata():
    run("/root/cleardata.sh")

@parallel
def deploynewproducer():
    put("/root/miner_setup.tar","/root/")
    put("/root/install.sh","/root/")
    run('chmod +x /root/install.sh')
    run('/root/install.sh')
    put("config/%s/config.ini" % env.host, "/root/.local/share/futureio/nodfuture/config")

@parallel
def updatenod():
    run('cp /root/miner_setup/files/program/nodfuture /root/')
    run('chmod +x /root/nodfuture')

@parallel
def impconfig():
    run("rm /root/config/*.ini")
    put("config/%s/*" % env.host,"/root/config/")
    put("/root/config/uploadconfig.sh","/root/config/")
    run('chmod +x /root/config/uploadconfig.sh')
    run("/root/config/uploadconfig.sh")

@parallel
def uploadconfig():
    run("mkdir -p /root/.local/share/futureio/nodfuture/config")
    put("config/%s/config.ini" % env.host, "/root/.local/share/futureio/nodfuture/config")
    run("mkdir -p /root/.local/share/futureio/wssfuture/config")
    put("wssconfig.ini", "/root/.local/share/futureio/wssfuture/config/config.ini")
    run("mkdir -p /root/.local/share/futureio/futuremng/config")
    put("futuremng/config.ini", "/root/.local/share/futureio/futuremng/config/config.ini")
    put("futuremng/seedconfig.json", "/root/.local/share/futureio/futuremng/config/seedconfig.json")
    run("mkdir -p /mongodb/data && mkdir -p /mongodb/log")

@parallel
def uploadmngconfig():
    put("futuremng/config.ini", "/root/.local/share/futureio/futuremng/config/config.ini")
    put("futuremng/seedconfig.json", "/root/.local/share/futureio/futuremng/config/seedconfig.json")

@parallel
def joinswarm():
    run("docker swarm leave")
    put("/root/joinswarm.sh","/root/")
    run('chmod +x /root/joinswarm.sh')
    run("/root/joinswarm.sh")

def getlogs():
    get("/root/log/2018*","/root/logs")

def rename():
    run("mv /root/startEOS.sh /root/startNod.sh")
    run("mv /root/stopEOS.sh /root/stopNod.sh")

@parallel
def startlogr():
    run("/root/runlogr.sh && sleep 1")

@parallel
def stoplogr():
    run("killall logrotate.sh")

def setmss():
     run("sysctl net.ipv4.tcp_app_win=31")

def settcpwin():
     run("sysctl net.ipv4.tcp_app_win=31")
     run("sysctl net.core.wmem_max=4194304")
     run("sysctl net.core.rmem_max=4194304")
     run("sysctl -p")

def unsettcpwin():
     run("sysctl net.core.wmem_max=212992")
     run("sysctl net.core.rmem_max=212992")
     run("sysctl -p")

def getmss():
     run("sysctl -a|grep tcp_app_win")

def turnoffloadoff():
     run("ethtool -K eth0 tso off")
     run("ethtool -K eth0 gso off")
     run("ethtool -K eth0 gro off")

def turnoffloadon():
     run("ethtool -K ens5 tso on")
     run("ethtool -K ens5 gso on")
     run("ethtool -K ens5 gro on")

#@parallel
def installdep():
    run("apt update && apt install -y nodejs npm")
    run("npm install pm2 -g")

@parallel
def urgentmode():
    put("urgent.sh", "/root/")
    run('chmod +x /root/urgent.sh')
    run("/root/urgent.sh")

@parallel
def upreplayconfig():
    print("upload replay config");
    run("rm -f /root/replayfuture.sh")
    put("replayfuture.sh","/root/")
    run('chmod +x /root/replayfuture.sh')

@parallel
def replay(bn):
    print("replay to %s" % (bn))
    run("/root/replayfuture.sh %s && sleep 1" % (bn))
    run("/root/runlogr.sh && sleep 1")
