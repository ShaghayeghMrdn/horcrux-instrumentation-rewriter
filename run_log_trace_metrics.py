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

CSV_OUTPUT_FILE_category = "computation_breakdown_category.csv"
CSV_OUTPUT_FILE_activity = "computation_breakdown_activity.csv"
def extractWebsiteName(path):
    return "/".join(path.split('/')[2:-1])


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
            plt = timeDict["endTime"] - timeDict["startTime"]
            upt = timeDict["domContentLoaded"] - timeDict["startTime"]
        except KeyError as e:
            print "Error extract timing information, returning none"
            return 0,0
        return plt, upt

def dumpCSVFromDict(dict, output):
    csvData = pd.DataFrame(dict)
    with open(args.output + "/" + output,"w") as f:
        f.write("url")
        csvData.to_csv(f)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the list of traces")
    parser.add_argument('output', help="path to the output directory")
    args = parser.parse_args()

    for root, folder, file in os.walk(args.trace):
        if len(file) >= 1 and file[0] != "chrome.pid":
            with open(os.path.join(root, file[0]), 'r') as traceFile:
                try:
                    json.load(traceFile)
                    namesplit = traceFile.name.split("/")
                    execute_js("log-trace-metrics.js",
                               "-p " + traceFile.name + " -o " +
                               os.path.join(args.output, traceFile.name))
                    subprocess.Popen("cp " + os.path.join(root, file[1]) + " " + os.path.join(args.output, traceFile.name), shell=True)

                except ValueError, e:
                    print "Invalid jason file " + root + "/" + os.path.join(
                        root, file[0]) + " hencing skipping"

    print "Done parsing trace..\nGenerating csv file now..\n"

    computationDistributionCat = {}
    computationDistributionAct = {}
    # computationDistribution["plt"] = {}
    # computationDistribution["upt"] = {}

    #Creating csv file to generate plots
    for root, folder, files in os.walk(args.output):
        if len(files) > 2 and files[0] == "page_load_time":
            categoryDict = dictFromFile(os.path.join(root, files[2]))
            activityDict = dictFromFile(os.path.join(root, files[1]))
            website = extractWebsiteName(root)
            plt, upt = getTimingInformation(os.path.join(root, files[0]))
            
            # computationDistribution["plt"][website] = plt
            # computationDistribution["upt"][website] = upt
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