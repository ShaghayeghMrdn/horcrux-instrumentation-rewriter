#! /bin/bash


# Takes as input two directories
# Dumps all the JS content in a directory
# Iterative compares the raw js files and outputs the number of matching files

outputDir=$3

rm -rf $outputDir/*
mkdir -p $outputDir/1
mkdir -p $outputDir/2

python ../instrumentation/inspectMahiMahiProto.py $1 $outputDir/1
python ../instrumentation/inspectMahiMahiProto.py $2 $outputDir/2

total=0
match=0
for i in `ls $outputDir/1`; do
    total=`expr $total + 1`
    for j in `ls $outputDir/2`; do 
        diff $outputDir/1/$i $outputDir/2/$j > out
        if [ ! -s out ]; then
            match=`expr $match + 1`
            break
        fi
    done
done

# echo "total is ", $total
# echo "matches ", $match
echo "scale=2 ; $match / $total" | bc