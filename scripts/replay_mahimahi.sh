# $1 -> path to the list of pages
# $2 -> path to the recorded pages
# $3 -> path to the output directory
# $4 -> port for chrome
# $5 -> number of iterations

# set -v

mmwebreplay=/home/goelayu/research/hotOS/origMahimahi/mahimahi/buildDir/bin/mm-webreplay
mmwebreplay=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-webreplay
mmwebrecord=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-webrecord
mmdelay=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-delay

# ipfilePrefix=/home/goelayu/research/WebPeformance/output/unmodified/trace_5_15_record_v76_ssl1.0_c69/
ipfilePrefix=/home/goelayu/research/WebPeformance/traces/vaspol/record/devtools_logs/0/
ipfileDst=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/delay_ip_mapping.txt

echo "DATA FLAGS: " $DATAFLAGS

help(){
	echo "Note: The 3rd argument (path to the output directory) shouldn't contain a backslash at the end"
}

clean(){
	rm fetchErrors
	rm loadErrors
}

# @params: <path to recorded page> <url> <output directory> <chrome port> <mode> <url>
replay(){
	echo "$@"
	echo "url is",$url
	# ls $ipfilePrefix/$url/ip2time
	mkdir -p $3
	# copy the ip time file
	# sudo cp /dev/null $ipfileDst
	# sudo cp $ipfilePrefix/$url/ip2time $ipfileDst
	echo "Launching chrome"
	sleep 3
    # $mmwebreplay $1 $mmdelay 3 node inspectChrome.js -u $2 -l -n --log -o $3 -p $4 --mode $5
    $mmwebreplay $1 node inspectChrome.js -u $2 -o $3 -p $4 --mode $5 $DATAFLAGS
    # node inspectChrome.js -u $2 -o $3 -p $4 $DATAFLAGS
	replay_pid=$!
	#waitForNode
	waitForNode $4
	echo "Done waiting"
	sleep 1
	# ps aux | grep replayshell | awk '{print $2}' | xargs kill -9
	# kill -9 $replay_pid
}


# The comparison of count variable is with 2, because for some reason there is an additional 
# process started by root on the same node port
waitForNode(){
	count=0
	start_time=`date +'%s'`
	while [[ $count != 1 ]]; do
		count=`ps aux | grep $1 | wc | awk '{print $1}'` 
		echo "Current count is", $count
		curr_time=`date +'%s'`
		elapsed=`expr $curr_time - $start_time`
		echo $elapsed
		if [ $elapsed -gt 100 ]; then
			echo "TIMED OUT..."
			ps aux | grep $1 | awk '{print $2}' | xargs kill -9
		fi
		sleep 2
	done
}


waitForChrome(){
	count=0
	echo "waiting["
	curr_time=`date +'%s'`
	while [[  $count != 3 ]]; do
		count=`ps aux | grep chromium-browser | wc | awk '{print $1}'`
		echo "current count is" $count
		n_time=`date +'%s'`
		elapsed=`expr $n_time - $curr_time`
		echo "Elapsed time since: ", $elapsed
		if [ $elapsed -gt 30 ]; then
			echo "TIMED OUT..."
			ps aux | grep 9222 | awk '{print $2}' | xargs kill -9
		fi
		sleep 1;
	done
}

help
clean

# for ti in b2b; do
	# while IFS='' read -r line || [[ -n "$line" ]]; do
	while read line; do
		echo "replaying url: " $line
		url=`echo $line | cut -d'/' -f3-`
		url=`echo $url | sed 's/\//_/g' | sed 's/\&/-/g'`
		echo "mode is " $mode
		if [[ $run == "original" ]]; then
			path="$2"//"$url"
		fi
		if [[ $mode == "original" ]]; then 
			path=../traces/mobile/alexa_1000/"$url"
			# path=$2///"$url"
		fi
		#for cgtime mode is in not in the path
		# path="$2"/"$url"
		for iter in $(seq $5 $5); do 
			# mkdir -p $2/$ti/$iter/
			path="$2"/$ti//"$url"
			mkdir -p $2/$ti/
			mkdir -p $3/$ti/$url
			replay $path $line ${3}/$ti//"$url"/ $4 $mode $url
			# replay $path $line ${3}/replay/"$url"/ $4 replay;
			# replay $path $line ${3}2/"$url" $4;
			sleep 2
		done
	done<"$1"
# done
