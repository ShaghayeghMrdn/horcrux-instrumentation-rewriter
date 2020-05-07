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
mmdelay=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-delay

ipfilePrefix=/home/goelayu/research/WebPeformance/output/unmodified/mobile/record/alexa_1000/
ipfileDst=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/delay_ip_mapping.txt

adb_prefix="adb </dev/null"

echo "received arguments: " $@

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

enableSUAccess() {
    eval $adb_prefix shell "am start -a android.intent.action.VIEW -n jackpal.androidterm/.Term"
    sleep 2
    eval $adb_prefix shell input text su
    eval $adb_prefix shell input keyevent 66
}

disableCPU(){
    eval $adb_prefix shell "am start -a android.intent.action.VIEW -n jackpal.androidterm/.Term"
    sleep 2
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 1\ \>\ /sys/devices/system/cpu/cpu0/online")"
    eval $adb_prefix shell input keyevent 66
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 1\ \>\ /sys/devices/system/cpu/cpu1/online")"
    eval $adb_prefix shell input keyevent 66
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 1\ \>\ /sys/devices/system/cpu/cpu2/online")"
    eval $adb_prefix shell input keyevent 66
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 1\ \>\ /sys/devices/system/cpu/cpu3/online")"
    eval $adb_prefix shell input keyevent 66
}

cleanUp(){
    echo "cleaning up.."
    # sudo pkill mm-phone-webrecord-using-vpn
    # eval $adb_prefix shell pm clear com.android.chrome
    # eval $adb_prefix shell pm clear org.chromium.chrome
    # eval $adb_prefix shell pm clear jackpal.androidterm

    # sudo iptables -t nat -F
    killProcess openvpn
    sleep 1
    # killProcess replayshell
    # sanity check killing
    # ideally all replay shell instances should be destroyed by killing openvpn itself
    # killProcess replayshell
    # killProcess /usr/sbin/apache2
    # ifconfig | grep veth* | awk '{print $1}' | cut -d: -f1  | xargs -I{} sudo ifconfig {} down
}

cleanChrome(){
    # eval $adb_prefix shell pm clear org.chromium.chrome
    eval $adb_prefix shell pm clear com.android.chrome
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
    echo "run_phone_record exiting.."
    cleanUp
    exit 1
}

rm fetchErrors
rm loadErrors
cleanChrome
# cleanUp

# enableSUAccess
# disableCPU

for iter in $(seq 0 0); do 
    echo "current iteration is " $iter 
    # while IFS='' read -r line || [[ -n "$line" ]]; do
    while read line; do
        echo "Iteration" $iter "replaying url: " $line 
        url=`echo $line | cut -d'/' -f 3- | sed 's/\//_/g'`
        echo $url
        # mkdir -p "$4"/${iter}/record/
        # mkdir -p "$4"/${iter}/replay/
        # for config in $(seq 1 4); do
        # for mode in record replay; do
             mahimahi_dir=$3/$url
             # if [[ $mode == "replay" ]]; then
             #    mahimahi_dir=$3/$mode/skip/$url
             #    # mahimahi_dir=../traces/mobile/alexa_1000/$url/
             #    # mahimahi_dir=../modified/mobile/sig/alexa_1000/0/replay/skip/$url
             # fi
             echo "Running in mode",$mode," in directory ", $mahimahi_dir
             $phone_replay_bin $mahimahi_dir 1194 regular_replay none &> /dev/null & 
             # $phone_replay_bin $mahimahi_dir 1194 regular_replay none &
             # $phone_record_bin $3//$url none none & 
             sleep 2
            # iptableSetup
             ./$phone_record_file 3 $2 $line ${4}//"$url"/ $mode "$$"
             # ./$phone_record_file 3 $2 $line ${4}/$mode/"$url"/ std "$$"
             echo "Returned from phone_record_file, since parent wasn't killed"
            # ./$phone_record_file $config $2 $line ${4}/$iter/replay/"$url"/ replay
             # adb </dev/null shell am force-stop com.android.chrome
            # ./$phone_record_file $config $2 $line ${4}/replay/"$url"/ replay
            # killProcess replayshell
            cleanUp
            sleep 2
        # done
        cleanChrome
        sleep 1
    done<"$1"
done

cleanChrome
