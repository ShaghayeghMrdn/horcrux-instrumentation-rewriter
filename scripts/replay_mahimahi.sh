# $1 -> path to the list of pages
# $2 -> path to the recorded pages
# $3 -> path to the output directory
# $4 -> Mode ( record or replay)

# set -v

mmwebreplay=/home/goelayu/research/hotOS/origMahimahi/mahimahi/buildDir/bin/mm-webreplay
mmwebreplay=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-webreplay
mmwebrecord_old=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-webrecord
mmwebrecord=/home/goelayu/research/mahimahi/build/bin/mm-webrecord
mmdelay=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/mm-delay

# ipfilePrefix=/home/goelayu/research/WebPeformance/output/unmodified/trace_5_15_record_v76_ssl1.0_c69/
ipfilePrefix=/home/goelayu/research/WebPeformance/traces/vaspol/record/devtools_logs/0/
ipfileDst=/home/goelayu/research/hotOS/Mahimahi/buildDir/bin/delay_ip_mapping.txt

echo "DATA FLAGS: " $DATAFLAGS
nodeTIMEOUT=100

if [[ $DATAFLAGS == *"testing"* ]]; then
    echo "Running in testing mode..."
    nodeTIMEOUT=1100000
fi

help(){
	echo "Note: The 3rd argument (path to the output directory) shouldn't contain a backslash at the end"
}

clean(){
	rm fetchErrors
	rm loadErrors
}

# @params: <path to mm dir> <url> <output directory> <url>
replay(){
	echo "$@"
	echo "url is",$url
	mkdir -p $3
	echo "Launching chrome"
	mmtool=$mmwebrecord
	if [[ $5 == "replay" ]]; then
		mmtool=mm-webreplay
		echo "REPLAY MODE"
	else echo "RECORD MODE";
	fi;
	port=`shuf -i 9400-9800 -n 1`
	echo "Running on port" $port
    $mmtool $1 node inspectChrome.js -u $2 -o $3 -p $port --mode $mode $DATAFLAGS
    # node inspectChrome.js -u $2 -o $3 -p $4 $DATAFLAGS
	replay_pid=$!
	#waitForNode
	waitForNode $port
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
		count=`ps aux | grep -w $1 | wc | awk '{print $1}'` 
		echo "Current count is", $count
		curr_time=`date +'%s'`
		elapsed=`expr $curr_time - $start_time`
		echo $elapsed
		if [ $elapsed -gt $nodeTIMEOUT ]; then
			echo "TIMED OUT..."
			ps aux | grep -w $1 | awk '{print $2}' | xargs kill -9
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

# help
# clean

while read url; do
	echo "replaying url: " $url
	clean_url=`echo $url | cut -d'/' -f3-`
	clean_url=`echo ${clean_url} | sed 's/\//_/g' | sed 's/\&/-/g'`
	mmpath=$2//${clean_url}
	out=$3/${clean_url}
	echo "clean url is " ${clean_url}
	mkdir -p $out
	replay $mmpath $url $out $clean_url $4
	sleep 2
done<"$1"
