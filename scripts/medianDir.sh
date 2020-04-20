#!/bin/sh

############
# Input: 
# - List of directories each containing data from individual runs
# - Metric to be used to compute median 
# Output:
# - New directory with the median data files
#############


# Arguments: $1-> prefix directory containing the data files
# $2 -> file containing list of sites 
# $3 -> Metric 

#hard Coding the input command, should depending on the metric argument
procMetric(){
    echo "Computing plt of file " $1 
    met=`node small.js -plt $1`
}

subDir="std"

median(){
    while read i; do 
        procMetric $1/0//$subDir/$i/$3
        data1=$met
        procMetric $1/1/$subDir/$i/$3
        data2=$met
        procMetric $1/2//$subDir/$i/$3
        data3=$met
        echo "3 plts:" $data1 $data2 $data3
        med=`echo $data1 $data2 $data3 | ./median.R`;
        echo "median is" $med
        medDir=`echo $data1 $data2 $data3 | awk -v med=$med '{ if (int($1) == int(med)) {print 0} else if (int($2)== int(med)) {print 1} else if (int($3) == int(med)) {print 2} }'`; 
        echo "Median is from directory " $medDir
        # cdir $1/ $1/med/record/$i/ $medDir/record/$i
        cdir $1/ ../outputm/modified/mobile//orig/med/std/$i/ $medDir/std/$i
    done<$2
}

#$1 -> prefix path
#$1 -> path to output directory
#$2 -> median directory number
cdir(){
    echo "Creating directory" $2
    mkdir -p $2
    echo "Copying data from " $1/$3 " to " $2
    # cp $1//$3/Timeline.trace $2/
    # cp $1//$3/network $2/
    # cp $1//$3/jsProfile $2/
    # cp $1//$3/cacheExists $2/
    # cp $1//$3/setupStateTime $2/
    cp $1//$3/logs $2/
}


median $1 $2 $3