#!/usr/bin/env python

"""
This module runs the log-trace-metrics.js node file
param1: Path to the top level directory containing all the traces
param2: path of the output directory

"""

__license__ = "GPL"
__version__ = "1.0.1"
__maintainer__ = "Ayush Goel"
__email__ = "goelayu@umich.edu"

import os
import json
import argparse
import subprocess
from Naked.toolshed.shell import execute_js
import pandas as pd
import re

CSV_OUTPUT_FILE_category = "category.csv"
CSV_OUTPUT_FILE_activity = "activity.csv"

def extractWebsiteName(path):
    print path
    # print "/".join(path.split('/')[3:-1])
    return path.split('/')[3],"/".join(path.split('/')[4:])


def dictFromFile(filename):
    categoryDict = {}
    with open(filename, 'r') as f:
        content = f.readlines()
        for line in content:
            data = line.split("=>")
            if len(data) > 1:
                categoryDict[data[0].strip().replace("'", "")] = re.findall(
                    r'\d+', data[1])[0]
    return categoryDict

def getTimingInformation(timeFile):
    with open(timeFile ,"r") as f:
        timeDictString = f.readlines()[0].split()[1]
        print timeDictString
        timeDict = eval(timeDictString)
        print timeDict
        try: 
            plt = timeDict["loadTime"]
        except KeyError as e:
            print "Error extract timing information, returning none"
            return 0
        return plt

def dumpCSVFromDict(dict, fout):
    csvData = pd.DataFrame(dict)
    with open(args.output + "/" + args.trace + "/" + fout,"w") as f:
        f.write("url")
        csvData.to_csv(f)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the list of traces")
    parser.add_argument('output', help="path to the output directory")
    args = parser.parse_args()

    for root, folder, file in os.walk(args.trace):
        if len(file) >= 2 and file[0] != "chrome.pid":
            # print root, file
            file.sort()
            print file
            with open(os.path.join(root, file[0]), 'r') as traceFile:
                try:
                    # json.load(traceFile)
                    namesplit = traceFile.name.split("/")
                    execute_js("log-trace-metrics.js",
                               "-p " + traceFile.name + " -o " +
                               os.path.join(args.output, traceFile.name.split('/')[-2]))
                    subprocess.Popen("cp " + os.path.join(root, file[1]) + " " + os.path.join(args.output, traceFile.name.split('/')[-2]), shell=True)

                except ValueError, e:
                    print "Invalid json file " + os.path.join(
                        root, file[0]) + " hencing skipping"

    print "Done parsing trace..\nGenerating csv file now..\n"

    computationDistributionCat = {}
    computationDistributionAct = {}
    computationDistributionCat["plt"] = {}
    computationDistributionCat["index"] = {}
    computationDistributionAct["index"] = {}

    #Creating csv file to generate plots
    for root, folder, files in os.walk(args.output + "/" + args.trace):
        files.sort()
        print root, files
        if len(files) > 2 and files[2] == "page_load_time":
            categoryDict = dictFromFile(os.path.join(root, files[1]))
            print categoryDict
            activityDict = dictFromFile(os.path.join(root, files[0]))
            index,website = extractWebsiteName(root)
            print "index extraced", index, website
            plt = getTimingInformation(os.path.join(root, files[2]))
            
            computationDistributionCat["plt"][website] = plt
            computationDistributionCat["index"][website] = index
            computationDistributionAct["index"][website] = index
            for category, time in categoryDict.items():
                if category not in computationDistributionCat:
                    computationDistributionCat[category] = {}
                computationDistributionCat[category][website] = time

            for activity, time in activityDict.items():
                if activity not in computationDistributionAct:
                    computationDistributionAct[activity] = {}
                computationDistributionAct[activity][website] = time
    dumpCSVFromDict(computationDistributionCat, CSV_OUTPUT_FILE_category)
    dumpCSVFromDict(computationDistributionAct, CSV_OUTPUT_FILE_activity)
