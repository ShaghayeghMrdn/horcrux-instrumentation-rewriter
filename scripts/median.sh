#!/bin/sh
# set -ev 
#process the data for all the different iterations
#Arguments:
# $1-> the subdirectory on which to run the command
# $2 -> output file to save the result
runCommand(){
    for i in `ls $MODPATH/1/$1/`; do node computeUpperBound.js -r $MODPATH/1/$1/$i/jsProfile; 
        node computeUpperBound.js -r $MODPATH/2/$1/$i/jsProfile;  node computeUpperBound.js -r $MODPATH/3/$1/$i/jsProfile; echo "$i"; done > $2
}

#Arguments:
#$1-> input file
#$2-> output file
computeMedian(){
    while read i; do val=`echo $i | awk '{print $1, $2, $3}' | ./median.R` ; echo -n $val; echo $i | awk '{print " "$4}'; done<$1 > $2
}

#Move the median data to a new directory
#Arguments:
#$1 -> input median file
#$2 -> input origin file
#$2 -> output file
#$3 -> dir to be moved into
mvMedian(){
    while read i; do med=`echo $i | awk '{print $1}'`; site=`echo $i | awk '{print $2}'`; 
        orig=`cat $2| grep $site | awk -v med=$med '{ if (int($1) == int(med)) {print 1} else if (int($2)== int(med)) {print 2} else if (int($3) == int(med)) {print 3} }'`; 
        echo $orig $site; done<$1 > $3

    while read i; do med=`echo $i | awk '{print $1}'`; site=`echo $i | awk '{print $2}'`;  
        mkdir -p $MODPATH/0/$4/$site/; 
        cp -r $MODPATH/$med/$4/$site $MODPATH/0/$4/; done<$3
}

compareRecordReplayOrig(){
    echo $MODPATH
    for i in `ls $MODPATH/1/record/`; do node computeUpperBound.js -r ${MODPATH}/0/record/${i}/jsProfile;
        node computeUpperBound.js -r ${MODPATH}/0/replay/${i}/jsProfile; node computeUpperBound.js -r $ORIGPATH/$i/jsProfile; echo ""; done >> $OUTPUT
}

rm $OUTPUT

# runCommand replay results/cpu_replay
# runCommand record results/cpu_record

# computeMedian results/cpu_replay results/cpu_replay_median
# computeMedian results/cpu_record results/cpu_record_median

# mvMedian results/cpu_record_median results/cpu_record results/seq record
# mvMedian results/cpu_replay_median results/cpu_replay results/seq replay


compareRecordReplayOrig