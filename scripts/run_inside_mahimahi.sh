#!/bin/bash
# set -v


masquerade(){
    sudo iptables -t nat -A POSTROUTING  -j MASQUERADE -s 10.8.0.0/8
}


startServerVPN(){
    #instead of running mahimahi vpn simply do vpn
    # sudo systemctl start openvpn@server.service
    # $record_binary $1 disk ls 2>1 1>$2 &
    # $record_binary $1 disk ls & 
    echo "Starting vpn server"
    sudo openvpn --config /etc/openvpn/server.conf.bck &>/dev/null &
    # serverVPNID=$!
    sleep 1
}

startServerVPN
masquerade

sudo iptables -t nat -L

while true; do sleep 1; done
