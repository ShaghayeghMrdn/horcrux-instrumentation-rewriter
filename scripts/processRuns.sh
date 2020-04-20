#!/bin/bash

# set -ve



#Arguments:
# $1- > Root replay directory
# $2 -> Root original directory
# $3 -> List of sites
# $4 -> True if trim jsProfiles
# $5 -> prefix for output files

# $1 -> File to clean 
# $2 -> number of fields per row
clean(){
    cat $1 | awk -v nf=$2 '{if (NF == int(nf)) print $0}' > _t_
    f=`cat _t_ | wc -l`
    i=`cat $1 | wc -l`
    echo "Pruned " `expr $i - $f` entries " from " $1
    cat _t_ > $1
    rm _t_

}

prefix=$5

while read i; do c=`cat $1/$i/cacheExists 2>/dev/null | jq '.value'`;  if [[ $c == *"1"* ]];then echo $i; fi; done<$3 > ph/$5"cacheExists"

echo "Cache exists : " `cat ph/$prefix"cacheExists" | wc -l `

while read i; do node logs.js -m $1/$i/logs -o $2/$i/logs -t e  2>errors/replay/$i; echo " "$i; done<ph/$prefix"cacheExists" > ph/$prefix"_logs"

echo "Syntax errors in record"
grep -inr "syntax" errors/record

echo "Syntax errors in replay"
grep -inr "syntax" errors/replay

#Compute record logs as well
recordDir=`echo $1 | sed 's/replay/record/g'`
while read i; do node logs.js -m $recordDir/$i/logs -o $2/$i/logs -t e 2>errors/record/$i; echo " "$i; done<ph/$prefix"cacheExists" > ph/$prefix"rlogs"


clean ph/$prefix"_logs" 4
cat ph/$prefix"_logs" | grep -vw na > ph/$prefix"logs" 



cat ph/$prefix"logs" | awk '{if ($1 == 0) print $4}' > ph/$prefix"correct"

echo "Correct sites: " `cat ph/$prefix"correct" | wc -l`

if [[ $4 == "trim" ]]; then 
    # create trimmed jsProfiles just in case they are not already there
    # Don't need to trim the original jsProfiles
    while read i; do node cpuProfile.js -i $1/$i/jsProfile -p $1/$i/plt; done<ph/$prefix"correct";
    # while read i; do node cpuProfile.js -i $2/$i/jsProfile -p $2/$i/plt; done<ph/$prefix"correct";

    echo "Created trimmed jsProfiles "
else
    echo "Skipping jsProfile trimming.."
fi

# Now get plt, program, user and savings numbers

while read i;do p=`node small.js -plt $1/$i/plt`; s=`node small.js -reduce $1/$i/setupStateTime`; node small.js -plt $2/$i/plt; echo $p $s $i| awk '{print $1 - $2,$3}'; done<ph/$prefix"correct" > ph/$prefix"plt"

echo "Plt Done.."

# clean ph/plt 3

while read i; do p=`node cpuProfile -i $1/$i/jsProfile.trim -t u`;   s=`node small.js -reduce $1/$i/setupStateTime`; node cpuProfile.js -i $2/$i/jsProfile.trim -t u; echo $p $s $i | awk '{print $1 - $2,$3}'; done<ph/$prefix"correct" > ph/$prefix"userd"

echo "UserD Done.."

# clean ph/userd 3

while read i; do p=`node cpuProfile -i $1/$i/jsProfile.trim -t p`;   s=`node small.js -reduce $1/$i/setupStateTime`; node cpuProfile.js -i $2/$i/jsProfile.trim -t p; echo " "$p $i; done<ph/$prefix"correct" > ph/$prefix"program"

while read i; do p=`node cpuProfile -i $1/$i/jsProfile.trim -t i`;   s=`node small.js -reduce $1/$i/setupStateTime`; node cpuProfile.js -i $2/$i/jsProfile.trim -t i; echo " "$p $i; done<ph/$prefix"correct" > ph/$prefix"idle"

echo "Program Done.."

while read i; do p=`node cpuProfile -i $1/$i/jsProfile.trim -s "cacheandreplay"`; echo " "$p $i; done<ph/$prefix"correct" > ph/$prefix"overhead"
# clean ph/program 3

while read i; do echo -n " $i " ; node processCacheStats.js -c $1/$i/cacheStats -t instNodes/$i".nodes.trim" -r $1/$i/timingInfo1 --type savings -o cacheStats/$i ; done<ph/$prefix"correct" >ph/$prefix"savings"

echo "Savings Done.."
# clean ph/savings 4

paste ph/$prefix"savings" ph/$prefix"plt" ph/$prefix"userd" ph/$prefix"overhead"

