#!/bin/bash

# set -v
######################################
#Records webpages in mahimahi format
#Arguments:
# $1 : page_list device_type recordDir dataDir
#   page_list - txt file containing list of urls separated by newlines
# $2 device_type - takes only the following values: pixel,samsung, moto
# $3 recordDir - path to the recorded webpages
# 44 dataDir - path to devtools output like plt, Network, js, logs
# $5 -> port
phone_record_file='phone_record_mahimahi.sh'
script_inside_mahimahi='run_inside_mahimahi.sh'
phone_replay_bin='/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-http1-proxyreplay'
phone_record_bin='/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-phone-webrecord-using-vpn'

ipfilePrefix=/home/goelayu/research/WebPeformance/output/unmodified/mobile/record/trace_5_15_rt/
ipfileDst=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/delay_ip_mapping.txt

adb_prefix="adb </dev/null"

waitForNode(){
    count=0
    start_time=`date +'%s'`
    while [[ $count != 1 ]]; do
        count=`ps aux | grep $1 | wc | awk '{print $1}'` 
        echo "Current count is", $count
        curr_time=`date +'%s'`
        elapsed=`expr $curr_time - $start_time`
        echo $elapsed
        if [ $elapsed -gt 200 ]; then
            echo "TIMED OUT..."
            ps aux | grep $1 | awk '{print $2}' | xargs kill -9
        fi
        sleep 2
    done
}

killProcess(){
    ps aux | grep $1 | awk '{print $2}' | xargs sudo kill -9
}

#$1-> mahimahi veth addr
setForwardingRules(){
    echo "setting up iptable rules"
    sudo iptables  -w -t nat -I PREROUTING 1 -p UDP --dport 1194 -j DNAT --to-destination $1:1194
}

iptableSetup(){
    interface=`ip link list type veth | grep UP | awk -F" |@" '{print $2}'`
    # addr=`ifconfig | grep 100.64.0 | awk '{print $2}'`
    addr=`ip addr list $interface | grep peer | awk '{print $4}' | cut -d/ -f1`
    echo "Mahimahi addr: $addr"
    setForwardingRules $addr
}

cleanUp(){
    echo "cleaning up.."
    # sudo pkill mm-phone-webrecord-using-vpn
    eval $adb_prefix shell pm clear com.android.chrome
    # eval $adb_prefix shell pm clear org.chromium.chrome
    # eval $adb_prefix shell pm clear jackpal.androidterm

    # sudo iptables -t nat -F
    killProcess openvpn
    # sanity check killing
    # ideally all replay shell instances should be destroyed by killing openvpn itself
    # killProcess replayshell
    # killProcess /usr/sbin/apache2
    # ifconfig | grep veth* | awk '{print $1}' | cut -d: -f1  | xargs -I{} sudo ifconfig {} down
}

#Arguments: 
# $1 -> url 
cpdelayFile(){
    sudo cp /dev/null $ipfileDst
    sudo cp $ipfilePrefix/$1/ip2time $ipfileDst
    echo "Copied delay file to dst.."
}

trap ctrl_c INT1

ctrl_c(){
    echo "Handling process exit.."
    cleanUp
    exit 1
}

rm fetchErrors
rm loadErrors
cleanUp

for iter in $(seq 1 1); do 
    echo "current iteration is " $iter 
    while IFS='' read -r line || [[ -n "$line" ]]; do
        echo "Iteration" $iter "replaying url: " $line 
        url=`echo $line | cut -d'/' -f 3`
        echo $url
        mkdir -p "$4"/${iter}/record/
        mkdir -p "$4"/${iter}/replay/
        # for config in $(seq 1 4); do
        for config in {3..3}; do
            # mm-webrecord $3/${iter}/"$url"/ ./$script_inside_mahimahi &
             # cpdelayFile $url
             $phone_replay_bin $3/$url 1194 regular_replay none &
             # $phone_record_bin $3/$url none none & 
             sleep 3 
            # iptableSetup
            ./$phone_record_file $config $2 $line ${4}/$iter/record/"$url"/ record
            ./$phone_record_file $config $2 $line ${4}/$iter/replay/"$url"/ replay
             # adb </dev/null shell am force-stop com.android.chrome
            # ./$phone_record_file $config $2 $line ${4}/replay/"$url"/ replay
            # killProcess replayshell
            cleanUp
        done
        sleep 1
    done <"$1"
done
