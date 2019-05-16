#!/bin/bash

set -e

##################
# This file processes data collected from recorded and replayed run
# 1) filter out recorded sites without errors
# 2) filter out replayed sites without errors
# 3) filter out websites with huge difference in the call graph invocation number
# Arguments: $1 -> The output directory containing data from modified page runs
#.           $2 -> The output directory containing data from unmodified page runs
########################


recordDir=$1/record
replayDir=$1/replay
tmpFile=tmp
tmpFile2=tmp2
errDir=errors
e2eTest="cacheSize_orig"
cgThreshold=0.2
resultFile=plt
cacheFile=cache

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
# $2 -> The file to exist in the path
getRelevantSites(){
    find $1 -iname $2 | cut -d/ -f7 > $tmpFile
    c=`cat $tmpFile | wc -l`
    echo "Sites with e2e working: " $c
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

     while read i; do node small.js -cg $1/$i/callGraph $2/$i/callGraph; echo " $i";done<$3  > $tmpFile2
     cat $tmpFile2 | awk '{if (NF == 2 && $1 < 0.2) print $2}' > $tmpFile

     c=`cat $tmpFile | wc -l`
    echo "[CG] Number of correct sites: " $c
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

getRelevantSites $recordDir $e2eTest
getCorrectSitesLOGS $recordDir $2 $tmpFile
getCorrectSitesLOGS $replayDir $recordDir $tmpFile
getCorrectSitesCG $recordDir $replayDir $tmpFile
getPLTResults $2 $recordDir $replayDir $tmpFile
getCacheResults $replayDir $tmpFile


