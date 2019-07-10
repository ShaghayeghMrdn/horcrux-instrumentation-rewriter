#!/bin/bash

# This script checks whether the given directory
# has any errors or not

#Argguments: $1 -> Directory/file to check for errors

find $1 -iname errors | xargs grep -inr 'error' | grep -vi "token"
find $1 -iname errors | xargs grep -inr 'exception'
find $1 -iname errors | xargs grep -inr 'unknown'
