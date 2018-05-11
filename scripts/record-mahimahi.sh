
#set -e
url=`echo $1 | cut -d'/' -f 3` 
# $1 is the path to the list of pages
# $2 is the path to the output directory where the traces would be stored
waitForChrome(){
	count=0
	echo "waiting"
	curr_time=`date +'%s'`
	while [[  $count != 1 ]]; do
		count=`ps aux | grep chromium-browser | wc | awk '{print $1}'`
		echo "current count is" $count
		n_time=`date +'%s'`
		elapsed=`expr $n_time-$curr_time`
		if [ $elapsed > 15 ]; then
			ps aux | grep 9222 | awk '{print $2}' | xargs kill -9
		fi
		sleep 3;
	done
}



waitForNode(){
	count=0
	while [[ $count != 2 ]]; do
		count=`ps aux | grep timeline-trace.js | wc | awk '{print $1}'`
	done
}

record(){
	echo "Recording"  $1
	mm-webrecord $3/"$2"/ node inspectChrome.js "$1" CPU/"$2"/ &
	record_pid=$!
	#waitForNode
	waitForChrome
	kill -9 $record_pid
}


pid=0
while IFS='' read -r line || [[ -n "$line" ]]; do
	url=`echo $line | cut -d'/' -f 3`
	sleep 2
	record $line $url $2;
done < "$1"


