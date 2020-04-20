#!/bin/bash

set -e

##################
# This file processes data collected from recorded and replayed run
# 1) filter out recorded sites without errors
# 2) filter out replayed sites without errors
# 3) filter out websites with huge difference in the call graph invocation number
# Arguments: $1 -> The output directory containing data from modified page runs
#.           $2 -> The output directory containing data from unmodified page runs
#            $3 -> File containing list of urls
#            $4 -> Output file
########################


recordDir=$1/record
replayDir=$1/replay
tmpFile=$4
tmpFile2=${4}_
errDir=errors
cacheExists=cacheExists
cgThreshold=0.2
resultFile=plt
cacheFile=cache
leafNodes=instLeaves_actual
cgDir=../output/modified/mobile/cgtime/1/replay/

init(){
    rm -f $tmpFile
    rm -r $errDir
    mkdir $errDir
}

#Returns the location of url in a path
#output could be used by cut and delimiter to obtain the url name
# Arguments:
# $1 -> The 
# getLocUrl(){

# }

# Returns sites based on existence of file type in their path
# Argument:
# $1 -> The directory to search for relevant files
# $2 -> File containing urls
getRelevantSites(){
    # find $1 -iname $2 | cut -d/ -f7 > $tmpFile
    # c=`cat $tmpFile | wc -l`
    # echo "Sites with e2e working: " $c
    while read i; do
        cacheExists=`cat $1/$i/cacheExists 2>/dev/null | jq '.value'`
        if [[ "$cacheExists" = '"1"' ]]; 
            then echo $i;
        fi
    done<$2 >$tmpFile
    c=`cat $tmpFile | wc -l`
    echo "[Cache] Number of files with cache " $c 
}


#Arguments: 1-> Directory containing cache file
#           2-> File containing list of urls
printCacheStats(){
    while read i; do 
        hits=`cat $1/$i/cacheStats 2>/dev/null | jq '.value.hits | length'`
        misses=`cat $1/$i/cacheStats 2>/dev/null | jq '.value.misses.mismatch | length'`
        empty=`cat $1/$i/cacheStats 2>/dev/null | jq '.value.misses.empty | length'`
        echo "hits: " $hits " misses: " $misses " empty: " $misses
    done<$2
}

# Takes two set of websites and returns list of urls of sites without errors
# Arguments: 
# $1 -> path to the first set of sites
# $2 -> path to the second set of sites
# $3 -> file to read the urls from
getCorrectSitesLOGS(){
    if [[ ! -d $1 || ! -d $2 ]]; then
        echo "Input paths not valid directories"
        exit 1
    fi
    while read i; do node logs.js -e $1/$i/logs $2/$i/logs 2>$errDir/$i; echo " $i";done<$3 > $tmpFile2
    cat $tmpFile2 | awk '{if (NF == 4 && $1 == 0) print $4}' > $tmpFile

    echo "Found correct sites between " $1 " and " $2
    c=`cat $tmpFile | wc -l`
    echo "[LOGS] Number of correct sites: " $c

}

# Takes two set of websites and returns list of urls of sites without errors
# Arguments: 
# $1 -> path to the first set of sites
# $2 -> path to the second set of sites
# $3 -> file to read the urls from
getCorrectSitesCG(){
    if [[ ! -d $1 || ! -d $2 ]]; then
        echo "Input paths not valid directories"
        exit 1
    fi
     while read i; do  node small.js -invoc $1/$i/invocations $1/$i/$leafNodes; node small.js -invoc $cgDir/$i/invocations $1/$i/$leafNodes $2/; echo " $i";done<$3  > $tmpFile2
     cat $tmpFile2 | awk '{if (NF == 3 && $1/$2 > 0.75) print $3}' > $tmpFile

     c=`cat $tmpFile | wc -l`
    echo "[CG] Number of correct sites: " $c
}

#using the original leaf nodes instrumented get
# the actual leaf node data
#Arguments: 1-> dstDir
#           2->File with list of urls
getProcessedLeafNodes(){
    while read i; do node small.js -map $cgDir/$i/$leafNodes $1/$i/timingInfo1 $1/$i/$leafNodes; done<$2
}

# Produces cache statistics
# Arguments
# $1 -> path to the replay set of sites
# $2 -> file to read the urls from
getCacheResults(){
    if [[ ! -d $1 ]]; then
        echo "Input paths not valid directories"
        exit 1
    fi

    while read i; do node small.js -cache $1/$i/cacheStats; echo "";done<$2 > $tmpFile2
    cat $tmpFile2 | awk '{print $1/($1+$2)}' > results/$cacheFile

    echo "Cache result written to: results/$cacheFile"

}

# Produces the final page load time information for the sites the passed all the filters 
# Arguments: 
# $1 -> path to the original set of sites
# $2 -> path to the record set of sites
# $3 -> path to the replay set of sites
# $4 -> file to read the urls from
getPLTResults(){
    if [[ ! -d $1 || ! -d $2 ]]; then
        echo "Input paths not valid directories"
        exit 1
    fi

    while read i; do node small.js -plt $1/$i/plt_cold; node small.js -plt $2/$i/plt_cold; node small.js -plt $3/$i/plt_cold; echo " $i"; done<$4 > results/$resultFile

    echo "PLT result written to: results/$resultFile"

}

init

cp $3 __f

getRelevantSites $replayDir __f
# printCacheStats $replayDir __f
# getCorrectSitesLOGS $recordDir $2 $tmpFile
getCorrectSitesLOGS $replayDir $2 $tmpFile
#before comparing invocations create the processed leaf nodes file
getProcessedLeafNodes $replayDir $tmpFile
getCorrectSitesCG $replayDir $2 $tmpFile
# getPLTResults $2 $recordDir $replayDir $tmpFile
# getCacheResults $replayDir $tmpFile


