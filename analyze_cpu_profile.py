
import argparse
import json
import os
import operator
import pandas as pd

keyToNode = {}

def computeOccurances(obj):
    functionToInvocation = {}
    length = len(obj["nodes"])
    for i in range(0,length):
        key = obj["nodes"][i]["callFrame"]["functionName"] + "_" + str(obj["nodes"][i]["callFrame"]["lineNumber"]) + "_" + str(obj["nodes"][i]["callFrame"]["columnNumber"])
        if key not in functionToInvocation:
            functionToInvocation[key] = []
        functionToInvocation[key].extend([j for j,x in enumerate(obj["samples"]) if x == obj["nodes"][i]["id"] ])
    return functionToInvocation

def computeTTime(obj, functionToInvocation):
    functionToTTime = {}
    length = len(obj["nodes"])
    scriptingTime = 0
    for i in range(length):
        ttime = 0
        key = obj["nodes"][i]["callFrame"]["functionName"] + "_" + str(obj["nodes"][i]["callFrame"]["lineNumber"]) + "_" + str(obj["nodes"][i]["callFrame"]["columnNumber"])
        for ind in functionToInvocation[key]:
            tInd = ind if ind == len(obj["timeDeltas"]) - 1 else ind + 1
            ttime = ttime + obj["timeDeltas"][tInd]
        scriptingTime = scriptingTime + ttime
        if key not in keyToNode:
            keyToNode[key] = obj["nodes"][i]
        if key not in functionToTTime:
            functionToTTime[key] = ttime
        else:
            functionToTTime[key] = functionToTTime[key] + ttime
        # functionToTTime[obj["nodes"][i]['id'],obj["nodes"][i]["callFrame"]["functionName"]] = [ttime, obj["nodes"][i]["callFrame"]["url"]]
    functionToTTime["TOTAL"] = scriptingTime
    functionToTTime = sorted(functionToTTime.items(), key=lambda x: x[1], reverse = True)
    return functionToTTime


def maxScriptPerUrl(obj):
    urlToTime = {}
    for fn in obj:
        if fn[1][1] not in urlToTime:
            # print "Site is: ", fn[1][1]
            urlToTime[fn[1][1]] = 0
        urlToTime[fn[1][1]] = urlToTime[fn[1][1]] + int(fn[1][0])
    sortedUrlToTime = sorted(urlToTime.items(), key=operator.itemgetter(1), reverse = True)
    return sortedUrlToTime

def _calcFunctionDistribution(data, percentage):
    total = data[0][1][0]
    print "total time is", total
    print "Number of entires", len(data)
    nFunctions = []
    cTime = 0
    fIterator = 1
    limit = total*percentage/100.0
    while cTime < limit and fIterator < len(data):
        if "idle" in data[fIterator][0][1]: 
            cTime = cTime + data[fIterator][1][0]
            limit = limit + data[fIterator][1][0]
            fIterator = fIterator + 1
            continue
        cTime = cTime + data[fIterator][1][0]
        # print "ctime is", cTime
        nFunctions.append(data[fIterator][0])
        fIterator = fIterator+1
    print "Number of functions: {} for {} percentage".format(nFunctions, percentage)
    return len(nFunctions)

def calcFunctionDistribution(obj):
    dist = {}
    for key in obj:
        print "current site {}".format(key)
        # dist[key] = {}
        percentages = [60,70,80,90]
        for p in percentages:
            if p not in dist:
                dist[p] = {}
            nFunctions = _calcFunctionDistribution(obj[key], p)
            dist[p][key] = nFunctions

    return dist

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the list of traces")
    parser.add_argument('output', help="path to the output directory")
    parser.add_argument('parse',help='true for parsing, false for analyzing')
    parser.add_argument('distribution', help='true for computing function time distribution')
    args = parser.parse_args()
    childPids = []
    if (int(args.parse)):
        stats = {}
        for root, folder, files in os.walk(args.trace):
            if "jsProfile" in files:
                file = files.index("jsProfile")
                print "handling {}".format(os.path.join(root,file))
                profile = os.path.join(root , file)
                with open(profile, 'r') as f:
                    jsprofile = json.loads(f.read())
                    functionToInvocation = computeOccurances(jsprofile)
                    functionToTTime = computeTTime(jsprofile, functionToInvocation)

                    stats[root] = functionToTTime
                    print "Done processing {}".format(os.path.join(root,file))
                    # os._exit(0)

        # for pid in childPids:
        #     os.waitpid(pid,0)
        print "Dumping stats into file: ", args.output
        with open(args.output,'w') as f:
            f.write(json.dumps(stats))
    else:
        data = json.loads(open(args.trace,'r').read())
        if (int(args.distribution)):
            dist = calcFunctionDistribution(data)
            csv = pd.DataFrame(dist)
            with open(args.output, 'w') as f:
                f.write("url")
                csv.to_csv(f)
        else:
            stats = {}
            for site in data: 
                urlToTime = maxScriptPerUrl(data[site])
                stats[site] = urlToTime
            # print stats
            with open(args.output,'w') as f:
                f.write(json.dumps(stats))

    