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
# $5 -> mode in which to replay
# The last argument is the pid of the parent script

#Note:
# We eval bash commands which are concatenated because 
# simply running the commands are not parsed in the desired manner
# example if you have to run ls -l, then you need to use eval
# other wise the shell would look for "ls -l" as a whole, which doesn't exist. 
#####################################

# source the config file
. ./device.config

id=${device[${2}Id]}
port=${device[${2}Port]}
xaxis=${device[${2}Xaxis]}
yaxis=${device[${2}Yaxis]}

serverVPNID=

nodeTIMEOUT=130

# echo "received arguments: " $@

# $1 -> port for the device
adb_prefix="adb </dev/null -s ${id}"
record_binary="/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-phone-webrecord-using-vpn"
RT_binary="/home/goelayu/research/hotOS/gnirehtet-rust-linux64/gnirehtet"

stock_chrome="am start -a android.intent.action.VIEW -n com.android.chrome/com.google.android.apps.chrome.Main -d about:blank"
custom_chrome="am start -a android.intent.action.VIEW -n org.chromium.chrome/com.google.android.apps.chrome.Main -d about:blank"

echo "DATA FLAGS: " $DATAFLAGS
if [[ $DATAFLAGS == *"testing"* ]]; then
    echo "Running in testing mode..."
    nodeTIMEOUT=1100000
fi

#Does the initial setting up for the script
#Forwards chrome remote port
#Clears Chrome
#Clears terminal emulator
#Gives root access to the emulator
init(){
    eval $adb_prefix forward tcp:$port localabstract:chrome_devtools_remote
    # disableCPU
    # eval $adb_prefix shell pm clear com.android.chrome
    # eval $adb_prefix shell pm clear jackpal.androidterm
    # enableSUAccess
    #make sure no previous instances are running
    # sudo pkill openvpn
    # sudo pkill mm-phone-webrecord-using-vpn

    #start reverse tethering for all the experiments
    # echo "Starting the reverse tethering which would persist throughout"
    # $RT_binary relay &> /dev/null & 
    # $RT_binary start $id &
}

killProcess(){
    ps aux | grep $1 | awk '{print $2}' | xargs sudo kill -2
}

cleanUp(){
    # sudo pkill openvpn
    # sudo pkill mm-phone-webrecord-using-vpn
    # eval $adb_prefix shell pm clear com.android.chrome
    eval $adb_prefix shell pm clear org.chromium.chrome

    # sudo iptables -t nat -F
    killProcess openvpn
    # killProcess /usr/sbin/apache2
    # ifconfig | grep veth* | awk '{print $1}' | cut -d: -f1  | xargs -I{} sudo ifconfig {} down

    toggleClientVpn
}

vpnIsRunning(){

    eval $adb_prefix shell ifconfig tun0
    vpnstatus=`echo $?`
    echo "vpnstatus is " $vpnstatus
    retryCount=0
    while [ $vpnstatus -eq 1 ]; do
        retryCount=`expr $retryCount + 1`
        echo "Current retryCount " $retryCount
        toggleClientVpn
        eval $adb_prefix shell ifconfig tun0
        vpnstatus=`echo $?`
        if [[ $retryCount -gt 11 ]]; then
            exit 1
            break;
        fi
    done
}

#SKips the welcome screen on chrome
#Only need it for Moto g5 as command line flags dont work
skipWelcomePage(){
    echo "skipping welcome page"
    eval $adb_prefix shell input tap 600 1670
    eval $adb_prefix shell input tap 190 1680
    sleep 1
}

# Arguments:
# $1: path to mahimahi dump
startServerVPN(){
    #instead of running mahimahi vpn simply do vpn
    # sudo systemctl start openvpn@server.service
    # $record_binary $1 disk ls 2>1 1>$2 &
    # $record_binary $1 disk ls & 
    sudo openvpn --config /etc/openvpn/server.conf.bck &
    # serverVPNID=$!
    sleep 1
}

toggleClientVpn(){
    # unlock the phone in case its already locked
    # adb shell input keyevent 82
    # adb shell input keyevent 82
    echo "Toggling client vpn"
    eval $adb_prefix shell "am start -a android.intent.action.VIEW -n net.openvpn.openvpn/net.openvpn.unified.MainActivity" 1>/dev/null
    sleep 1 #wait for the app to be displayed
    echo "tapping phone at $xaxis $yaxis"
    eval $adb_prefix shell input tap $xaxis $yaxis
    sleep 2 #wait while the vpn gets connected
}

# Arguments
# none
startChrome() {
    #forward the debugging port
    # eval $adb_prefix shell pm clear com.android.chrome
    # sleep 1
    echo "Starting Chrome on Client"
    eval $adb_prefix shell $stock_chrome 1>/dev/null
    sleep 1
    if [[ "$2" -eq "moto" ]]; then
        skipWelcomePage
    fi
}
#Arguments:
# $1: url
# $2: outputDir
# $3: port
# $4 : sim file
loadPage() {
    echo "Loading page"
    mkdir -p $2
    node inspectChrome.js -u $1 -m -o $2 -p $3 
}

#Arguments
dummyRun(){
    eval $adb_prefix shell "am start -a android.intent.action.VIEW -n com.android.chrome/com.google.android.apps.chrome.Main -d about:blank" 1>/dev/null
    sleep 2
    node inspectChrome.js -u http://google.com -m -o /tmp/randomDir -p $1
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
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 0\ \>\ /sys/devices/system/cpu/cpu0/online")"
    eval $adb_prefix shell input keyevent 66
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 0\ \>\ /sys/devices/system/cpu/cpu1/online")"
    eval $adb_prefix shell input keyevent 66
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 0\ \>\ /sys/devices/system/cpu/cpu2/online")"
    eval $adb_prefix shell input keyevent 66
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 0\ \>\ /sys/devices/system/cpu/cpu3/online")"
    eval $adb_prefix shell input keyevent 66
}

enableCPU(){
    eval $adb_prefix shell "am start -a android.intent.action.VIEW -n jackpal.androidterm/.Term"
    sleep 2
    eval "$(adb </dev/null -s FA79E1A03237 shell input text  "echo\ 1\ \>\ /sys/devices/system/cpu/cpu1/online")"
    eval $adb_prefix shell input keyevent 66
}

#Arguments
# $1: Config Number -> 1 : 3g, 2: 4g, 3: RT, 4: CPU disabled
# $2: url
# $3: path to the output directory
# $4: port
# $5 : mode in which run the app
rotateConfigs(){
    case $1 in
    1)
        echo "Loading page in 3g config"
        path=${3}/3g/
        mkdir -p $path
        startChrome
        node inspectChrome.js -u $2 -m -t -o $path -p $4 --sim 3g.config
        ;;
    2)
        echo "Loading page in 4g config"
        path=${3}/4g/
        mkdir -p $path
        startChrome
        node inspectChrome.js -u $2 -m -t -j -o $path -p $4 --sim 4g.config &
        waitForNode $4
        ;;
    3) 
        echo "Loading page in RT config"
        # path=${3}/rt/
        mkdir -p $3
        startChrome
        # node inspectChrome.js -u $2 -m -n --log -j -o $3 -p $4 --mode $5 &
        node inspectChrome.js -u $2 -m -o $3 -p $4 --mode $5 $DATAFLAGS &
        waitForNode $4
        ;;
    4)
        echo "Loading page in CPU disabled config"
        # path=${3}/cpuDis4/
        mkdir -p $3
        # disableCPU
        startChrome
        node inspectChrome.js -u $2 -m -o $3 -p $4 --mode $5 $DATAFLAGS &
        waitForNode $4
        # enableCPU
        ;;
    esac
}


# Waits for the port to be killed
# Arguments:
# $1: port
waitForNode(){
    count=0
    start_time=`date +'%s'`
    while [[ $count != 1 ]]; do
        count=`ps aux | grep -w $1 | wc | awk '{print $1}'` 
        echo "Current count is", $count
        curr_time=`date +'%s'`
        elapsed=`expr $curr_time - $start_time`
        echo $elapsed
        if [ $elapsed -gt $nodeTIMEOUT ]; then
            echo "TIMED OUT..."
            ps aux | grep $1 | awk '{print $2}' | xargs kill -9
        fi
        sleep 2
    done
}

trap ctrl_c INT

ctrl_c(){
    echo "phone_record_mahimahi exiting.."
    cleanUp
    sudo kill -9 ${BASH_ARGV}
    exit 1
}

#clear chrome once before the experiment
# eval $adb_prefix shell pm clear com.android.chrome

# init
# disableCPU

# for iter in $(seq 1 1); do 
#     while IFS='' read -r line || [[ -n "$line" ]]; do
#         echo "Iteration" $iter "replaying url: " $line 
#         url=`echo $line | cut -d'/' -f 3`
#         echo $url
#         mkdir -p "$3"/${iter}/
#         # for config in $(seq 1 4); do
#         for config in {2..3}; do
#             sleep 1
#             rotateConfigs $config $line ${4}/${iter}/"$url" $port 
#         done
#         sleep 1
#     done <"$1"
# done

# startServerVPN
# masquerade
# toggleClientVpn
init
# if [[ $5 == "record" || $5 == "std" ]]; then
#     echo "Record mode"
#     # if [[ $DATAFLAGS != *"testing"* ]]; then 
#     #     export DATAFLAGS=" --mode std -n --log -j"
#     # fi
#     toggleClientVpn
# fi
toggleClientVpn
sleep 2
vpnIsRunning
rotateConfigs $1 $3 $4 $port $5
sleep 1
toggleClientVpn
# cleanUp
# if [[ $5 == "replay" ]]; then
#     echo "Replay mode"
#     toggleClientVpn
# fi









