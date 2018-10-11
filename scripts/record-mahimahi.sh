
#set -e
url=`echo $1 | cut -d'/' -f 3` 
# $1 is the path to the list of pages
# $2 is the path to the output directory where the traces would be stored
# $3 is the port for chrome
waitForChrome(){
	count=0
	echo "waiting"
	curr_time=`date +'%s'`
	while [[  $count != 1 ]]; do
		count=`ps aux | grep chromium-browser | wc | awk '{print $1}'`
		echo "current count is" $count
		n_time=`date +'%s'`
		elapsed=`expr $n_time - $curr_time`
		echo "Elapsed time since: ", $elapsed
		if [ $elapsed -gt 20 ]; then
			echo "TIMED OUT..."
			ps aux | grep 9222 | awk '{print $2}' | xargs kill -9
		fi
		sleep 3;
	done
}



waitForNode(){
	count=0
 	start_time=`date +'%s'`
	while [[ $count != 1 ]]; do
		count=`ps aux | grep $1 | wc | awk '{print $1}'`
		echo "current count", $count
		curr_time=`date +'%s'`
		elapsed=`expr $curr_time - $start_time`
		if [ $elapsed -gt 50 ]; then
			echo "TIMED OUT..."
			ps aux | grep $1 | awk '{print $2}' | xargs kill -9
		fi
		sleep 2;

	done
}

record(){
	echo "Recording"  $1
	mm-webrecord $3/"$2"/ node inspectChrome.js -l -t -u "$1" -p $4 -o $3/"$2"/ &
	record_pid=$!
	#waitForNode
	waitForNode $4
	#kill -9 $record_pid
}


pid=0
while IFS='' read -r line || [[ -n "$line" ]]; do
	url=`echo $line | cut -d'/' -f 3`
	sleep 2
	record $line $url $2 $3;
done < "$1"


