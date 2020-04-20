#!/usr/bin/env bash
#This module copies the relevant files to wolverines server
srcPath=/home/goelayu/research/WebPeformance
dstPath=/home/goelayu/BACKUP/WebPeformance

#Arguments
#$1 -> the file to be scp'd 
#$2 -> the destination 
scp2wolverine(){
	scp  $srcPath/$1 wolverines:/$dstPath/$2
}

scp2wolverine JSAnalyzer/*js JSAnalyzer
scp2wolverine instrumentation/record.js instrumentation
scp2wolverine instrumentation/genInstrumentationFiles.py instrumentation
