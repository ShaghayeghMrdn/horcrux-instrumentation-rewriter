

mmwebrecord=/home/goelayu/research/hotOS/origMahimahi/mahimahi/buildDir/bin/mm-webrecord
#set -e
url=`echo $1 | cut -d'/' -f 3` 
# $1 is the path to the list of pages
# $2 is the path to the output directory where the traces would be stored
# $3 is the path to the output directory with devtools info dump
# $4 is the port for chrome

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
		if [ $elapsed -gt 30 ]; then
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
		echo "Current count is", $count
		curr_time=`date +'%s'`
		elapsed=`expr $curr_time - $start_time`
		echo $elapsed
		if [ $elapsed -gt 120 ]; then
			echo "TIMED OUT..."
			ps aux | grep $1 | awk '{print $2}' | xargs kill -9
		fi
		sleep 2
	done
}

# Arguments:
# $1 -> Navigatable url (ie with the prefix: http://)
# $2 -> url without the prefix, used to create the output directory dynamically
# $3 -> path to the trace directory
# $4 -> path to the devtools info dump directory
# $5 -> port for chrome debugging protocol
record(){
	echo "$@"
	echo "Recording"  $1
	mkdir -p $4/"$2"/
	mkdir -p $3
	$mmwebrecord $3/"$2"/ node inspectChrome.js --log -l -j -n -u "$1" -p $5 -o $4/"$2"/ --mode record
	# node inspectChrome.js --log -l -j -n -u "$1" -p $5 -o $4/"$2"/ --mode record
	# chromium-browser --ignore-certificate-errors --user-data-dir=/tmp/nonexistent$(date +%s%N) --remote-debugging-port=$4 &>/dev/null &
	#mkdir -p $3/"$2"/
	#sleep 2
	#node inspectChrome.js -t --sim 3g.config -u "$1" -p $4 -o $3/"$2"/ &
	record_pid=$!
	#waitForNode
	# waitForNode $5
	# ps aux | grep recordshell | awk '{print $2}' | xargs kill -9
	#kill -9 $record_pid
}
# Arguments
# $1 -> url to be rewritten
rewriteUrlToPath(){
	_path=`echo $1 | awk -F"://" '{print $2}'`
	modpath=`echo $_path | sed -e 's/\//_/g'`
}
pid=0
while IFS='' read -r line || [[ -n "$line" ]]; do
	echo $line
	rewriteUrlToPath $line
	# sleep 2
	record "$line" "$modpath" "$2" "$3" "$4";
done < "$1"


